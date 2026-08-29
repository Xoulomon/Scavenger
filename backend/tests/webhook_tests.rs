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

use crate::services::webhook::{CreateWebhookRequest, DeadLetter, RetryConfig, WebhookEvent, WebhookManager};

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

    // 2 delays → 3 total attempts (initial + 2 retries)
    let manager = WebhookManager::with_retry_config(RetryConfig {
        delays: vec![Duration::from_millis(10), Duration::from_millis(10)],
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
        3,
        "should try initial + 2 retries = 3 total"
    );

    let dlq = manager.dead_letters();
    assert_eq!(dlq.len(), 1, "exactly one entry in DLQ");
    let entry = &dlq[0];
    assert_eq!(entry.url, addr);
    assert_eq!(entry.attempts, 3);
    assert!(!entry.last_error.is_empty());
}

/// Connection refused (no server) — unreachable host also ends up in DLQ.
#[tokio::test]
async fn webhook_unreachable_host_goes_to_dlq() {
    let manager = WebhookManager::with_retry_config(RetryConfig {
        delays: vec![Duration::from_millis(5)],
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
    });

    let wh = manager.create(CreateWebhookRequest {
        url: "http://127.0.0.1:19997".to_string(),
        events: vec![WebhookEvent::WasteRegistered],
    });
    manager.update(
        &wh.id,
        crate::services::webhook::UpdateWebhookRequest {
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
