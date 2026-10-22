//! Tests for webhook retry-with-backoff and dead-letter queue (#916).
//!
//! We spin up a tiny in-process HTTP server (using `tokio::net::TcpListener`)
//! so no external service is required.  The server is configured to succeed or
//! fail on demand, letting us exercise every retry path.

use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use std::time::Duration;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use hmac::{Hmac, Mac};
use sha2::Sha256;

use scavenger_backend::services::webhook::{
    CreateWebhookRequest, RetryConfig, UpdateWebhookRequest, WebhookEvent, WebhookManager,
};

// ── Test HTTP server helpers ──────────────────────────────────────────────────

/// Bind to an ephemeral port and return (address, listener).
async fn bind_server() -> (String, TcpListener) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    (format!("http://{addr}"), listener)
}

/// Serve `succeed_after` failures then always succeed.
/// Counts total calls via `hit_count`.
async fn serve(listener: TcpListener, succeed_after: usize, hit_count: Arc<AtomicUsize>) {
    let mut call = 0usize;
    loop {
        let Ok((mut stream, _)) = listener.accept().await else {
            break;
        };
        call += 1;
        hit_count.fetch_add(1, Ordering::SeqCst);

        // Drain the request (needed so the client doesn't see connection reset).
        let mut buf = [0u8; 4096];
        let _ = stream.read(&mut buf).await;

        let response = if call > succeed_after {
            b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n" as &[u8]
        } else {
            b"HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\n\r\n" as &[u8]
        };
        let _ = stream.write_all(response).await;
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

/// With no retries and a server that always succeeds, the webhook is delivered
/// on the first attempt and the DLQ stays empty.
#[tokio::test]
async fn webhook_delivered_on_first_attempt() {
    let (addr, listener) = bind_server().await;
    let hit_count = Arc::new(AtomicUsize::new(0));

    let hits = hit_count.clone();
    tokio::spawn(async move {
        serve(listener, 0 /* always succeed */, hits).await
    });

    // Zero-delay retries for fast tests.
    let manager = WebhookManager::with_retry_config(RetryConfig {
        delays: vec![Duration::from_millis(10)],
        max_attempts: 2,
    });

    let wh = manager.create(CreateWebhookRequest {
        url: addr,
        events: vec![WebhookEvent::WasteRegistered],
    });

    manager
        .trigger(WebhookEvent::WasteRegistered, serde_json::json!({"test": true}))
        .await;

    // Give the spawned task time to complete.
    tokio::time::sleep(Duration::from_millis(200)).await;

    assert_eq!(hit_count.load(Ordering::SeqCst), 1, "should hit server exactly once");
    assert!(manager.dead_letters().is_empty(), "DLQ should be empty on success");
}

/// Server fails the first 2 calls then succeeds — delivery should succeed after
/// 2 retries with no DLQ entry.
#[tokio::test]
async fn webhook_succeeds_after_retries() {
    let (addr, listener) = bind_server().await;
    let hit_count = Arc::new(AtomicUsize::new(0));

    let hits = hit_count.clone();
    tokio::spawn(async move {
        serve(listener, 2 /* fail first 2 */, hits).await
    });

    let manager = WebhookManager::with_retry_config(RetryConfig {
        delays: vec![
            Duration::from_millis(10),
            Duration::from_millis(10),
            Duration::from_millis(10),
        ],
        max_attempts: 4,
    });

    manager.create(CreateWebhookRequest {
        url: addr,
        events: vec![WebhookEvent::WasteTransferred],
    });

    manager
        .trigger(WebhookEvent::WasteTransferred, serde_json::json!({"waste_id": "42"}))
        .await;

    tokio::time::sleep(Duration::from_millis(300)).await;

    assert_eq!(
        hit_count.load(Ordering::SeqCst),
        3,
        "should attempt 3 times (2 failures + 1 success)"
    );
    assert!(manager.dead_letters().is_empty(), "no DLQ entry after eventual success");
}

/// Server always returns 500 — delivery exhausts all retries and lands in DLQ.
#[tokio::test]
async fn webhook_moved_to_dlq_after_all_retries_exhausted() {
    let (addr, listener) = bind_server().await;
    let hit_count = Arc::new(AtomicUsize::new(0));

    let hits = hit_count.clone();
    // succeed_after = usize::MAX → never succeeds
    tokio::spawn(async move { serve(listener, usize::MAX, hits).await });

    // The configured two-attempt cap wins even though more retry delays exist.
    let manager = WebhookManager::with_retry_config(RetryConfig {
        delays: vec![
            Duration::from_millis(10),
            Duration::from_millis(10),
            Duration::from_millis(10),
        ],
        max_attempts: 2,
    });

    manager.create(CreateWebhookRequest {
        url: addr.clone(),
        events: vec![WebhookEvent::RewardDistributed],
    });

    manager
        .trigger(WebhookEvent::RewardDistributed, serde_json::json!({"reward": 100}))
        .await;

    tokio::time::sleep(Duration::from_millis(400)).await;

    assert_eq!(
        hit_count.load(Ordering::SeqCst),
        2,
        "should stop at the configured maximum of 2 total attempts"
    );

    let dlq = manager.dead_letters();
    assert_eq!(dlq.len(), 1, "exactly one entry in DLQ");
    let entry = &dlq[0];
    assert_eq!(entry.url, addr);
    assert_eq!(entry.attempts, 2);
    assert!(!entry.last_error.is_empty());
}

/// Connection refused (no server) — unreachable host also ends up in DLQ.
#[tokio::test]
async fn webhook_unreachable_host_goes_to_dlq() {
    let manager = WebhookManager::with_retry_config(RetryConfig {
        delays: vec![Duration::from_millis(5)],
        max_attempts: 2,
    });

    manager.create(CreateWebhookRequest {
        url: "http://127.0.0.1:19999".to_string(), // nothing listening here
        events: vec![WebhookEvent::ParticipantRegistered],
    });

    manager
        .trigger(
            WebhookEvent::ParticipantRegistered,
            serde_json::json!({"participant": "G123"}),
        )
        .await;

    tokio::time::sleep(Duration::from_millis(300)).await;

    let dlq = manager.dead_letters();
    assert_eq!(dlq.len(), 1);
    assert_eq!(dlq[0].attempts, 2); // 1 initial + 1 retry
}

/// `drain_dlq` removes and returns all entries.
#[tokio::test]
async fn drain_dlq_clears_entries() {
    let manager = WebhookManager::with_retry_config(RetryConfig {
        delays: vec![Duration::from_millis(5)],
        max_attempts: 2,
    });

    manager.create(CreateWebhookRequest {
        url: "http://127.0.0.1:19998".to_string(),
        events: vec![WebhookEvent::IncentiveCreated],
    });

    manager
        .trigger(WebhookEvent::IncentiveCreated, serde_json::json!({}))
        .await;

    tokio::time::sleep(Duration::from_millis(300)).await;

    assert_eq!(manager.dead_letters().len(), 1);

    let drained = manager.drain_dlq();
    assert_eq!(drained.len(), 1);
    assert!(manager.dead_letters().is_empty(), "DLQ should be empty after drain");
}

/// Triggering an event with no registered webhooks should be a no-op.
#[tokio::test]
async fn trigger_with_no_webhooks_is_noop() {
    let manager = WebhookManager::new();
    // No webhooks registered — should not panic or produce DLQ entries.
    manager
        .trigger(WebhookEvent::WasteVerified, serde_json::json!({}))
        .await;
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert!(manager.dead_letters().is_empty());
}

/// An inactive webhook is not triggered.
#[tokio::test]
async fn inactive_webhook_is_not_triggered() {
    let manager = WebhookManager::with_retry_config(RetryConfig {
        delays: vec![Duration::from_millis(5)],
        max_attempts: 2,
    });

    let wh = manager.create(CreateWebhookRequest {
        url: "http://127.0.0.1:19997".to_string(),
        events: vec![WebhookEvent::WasteRegistered],
    });
    manager.update(
        &wh.id,
        UpdateWebhookRequest {
            url: None,
            events: None,
            active: Some(false),
        },
    );

    manager
        .trigger(WebhookEvent::WasteRegistered, serde_json::json!({}))
        .await;

    tokio::time::sleep(Duration::from_millis(200)).await;

    // No delivery attempts → nothing in DLQ
    assert!(
        manager.dead_letters().is_empty(),
        "inactive webhook should produce no DLQ entries"
    );
}

/// A local reference receiver validates the signature over the exact body and
/// checks that the idempotency key remains the payload's stable event ID.
#[tokio::test]
async fn webhook_signature_and_idempotency_key_are_verified_by_receiver() {
    let (addr, listener) = bind_server().await;
    let manager = WebhookManager::with_retry_config(RetryConfig {
        delays: vec![],
        max_attempts: 1,
    });
    let secret = "configured-test-subscription-secret".to_string();
    manager.create_with_secret(
        CreateWebhookRequest {
            url: addr,
            events: vec![WebhookEvent::WasteRegistered],
        },
        secret.clone(),
    );
    let (result_tx, result_rx) = tokio::sync::oneshot::channel();

    tokio::spawn(async move {
        let Ok((mut stream, _)) = listener.accept().await else {
            return;
        };
        let request = read_http_request(&mut stream).await;
        let request = String::from_utf8_lossy(&request);
        let (headers, body) = request.split_once("\r\n\r\n").unwrap();
        let signature = headers
            .lines()
            .find_map(|line| {
                let (name, value) = line.split_once(':')?;
                name.eq_ignore_ascii_case("X-Webhook-Signature")
                    .then_some(value.trim())
            })
            .unwrap();
        let idempotency_key = headers
            .lines()
            .find_map(|line| {
                let (name, value) = line.split_once(':')?;
                name.eq_ignore_ascii_case("Idempotency-Key")
                    .then_some(value.trim())
            })
            .unwrap();
        let payload: serde_json::Value = serde_json::from_str(body).unwrap();
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(body.as_bytes());
        let signature = signature.strip_prefix("sha256=").unwrap();
        let signature = hex::decode(signature).unwrap();
        let verified = mac.verify_slice(&signature).is_ok();
        let event_id_matches = payload["id"].as_str() == Some(idempotency_key);

        let _ = stream
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n")
            .await;
        let _ = result_tx.send((verified, event_id_matches));
    });

    manager
        .trigger(WebhookEvent::WasteRegistered, serde_json::json!({"test": true}))
        .await;

    let (signature_verified, event_id_matches) = tokio::time::timeout(
        Duration::from_secs(2),
        result_rx,
    )
    .await
    .expect("receiver should get the webhook")
    .expect("receiver task should report its verification result");
    assert!(signature_verified, "receiver should verify the HMAC signature");
    assert!(event_id_matches, "idempotency key should equal the payload event ID");
}

async fn read_http_request(stream: &mut tokio::net::TcpStream) -> Vec<u8> {
    let mut request = Vec::new();
    let mut chunk = [0u8; 2048];
    loop {
        let count = stream.read(&mut chunk).await.unwrap();
        if count == 0 {
            break;
        }
        request.extend_from_slice(&chunk[..count]);

        if let Some(header_end) = request.windows(4).position(|window| window == b"\r\n\r\n") {
            let headers = String::from_utf8_lossy(&request[..header_end]);
            let content_length = headers
                .lines()
                .find_map(|line| {
                    let (name, value) = line.split_once(':')?;
                    name.eq_ignore_ascii_case("content-length")
                        .then(|| value.trim().parse::<usize>().ok())
                        .flatten()
                })
                .unwrap_or(0);
            if request.len() >= header_end + 4 + content_length {
                break;
            }
        }
    }
    request
}
