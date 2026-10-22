use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tracing::{error, info, warn};
use uuid::Uuid;

// ── Domain types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Webhook {
    pub id: String,
    pub url: String,
    pub events: Vec<WebhookEvent>,
    pub active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub secret: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WebhookEvent {
    WasteRegistered,
    WasteTransferred,
    WasteVerified,
    IncentiveCreated,
    IncentiveUpdated,
    RewardDistributed,
    ParticipantRegistered,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookPayload {
    pub id: String,
    pub event: WebhookEvent,
    pub timestamp: DateTime<Utc>,
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWebhookRequest {
    pub url: String,
    pub events: Vec<WebhookEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateWebhookRequest {
    pub url: Option<String>,
    pub events: Option<Vec<WebhookEvent>>,
    pub active: Option<bool>,
}

// ── Dead-letter queue entry ───────────────────────────────────────────────────

/// A delivery attempt that exhausted all retries and was moved to the DLQ.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeadLetter {
    /// The webhook that was being delivered to.
    pub webhook_id: String,
    /// Target URL at the time of failure.
    pub url: String,
    /// The payload that could not be delivered.
    pub payload: WebhookPayload,
    /// Human-readable description of the final error.
    pub last_error: String,
    /// When the delivery was first attempted.
    pub first_attempt_at: DateTime<Utc>,
    /// When the final (failed) attempt was made.
    pub failed_at: DateTime<Utc>,
    /// Total number of attempts made.
    pub attempts: u32,
}

// ── Retry configuration ───────────────────────────────────────────────────────

/// Controls the exponential-backoff retry strategy.
///
/// Default matches the policy described in `docs/WEBHOOK_SYSTEM.md`:
/// - 1st retry : 5 s
/// - 2nd retry : 30 s
/// - 3rd retry : 5 min (300 s)
/// - 4th retry : 30 min (1 800 s)
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Delays between successive attempts (length = max retries).
    pub delays: Vec<Duration>,
    /// Maximum number of delivery attempts, including the initial attempt.
    pub max_attempts: usize,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            delays: vec![
                Duration::from_secs(5),
                Duration::from_secs(30),
                Duration::from_secs(300),
                Duration::from_secs(1_800),
            ],
            max_attempts: 5,
        }
    }
}

// ── WebhookManager ────────────────────────────────────────────────────────────

pub struct WebhookManager {
    webhooks: Arc<Mutex<HashMap<String, Webhook>>>,
    /// Dead-letter queue — populated when all retries are exhausted.
    pub dlq: Arc<Mutex<Vec<DeadLetter>>>,
    retry_config: RetryConfig,
}

impl WebhookManager {
    pub fn new() -> Self {
        Self::with_retry_config(RetryConfig::default())
    }

    /// Build a manager with a custom retry configuration (useful in tests).
    pub fn with_retry_config(retry_config: RetryConfig) -> Self {
        Self {
            webhooks: Arc::new(Mutex::new(HashMap::new())),
            dlq: Arc::new(Mutex::new(Vec::new())),
            retry_config,
        }
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    pub fn create(&self, req: CreateWebhookRequest) -> Webhook {
        self.create_with_secret(req, Uuid::new_v4().to_string())
    }

    /// Create a subscription using its configured per-subscription signing secret.
    pub fn create_with_secret(&self, req: CreateWebhookRequest, secret: String) -> Webhook {
        let webhook = Webhook {
            id: Uuid::new_v4().to_string(),
            url: req.url,
            events: req.events,
            active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            secret,
        };
        let mut webhooks = self.webhooks.lock().unwrap();
        webhooks.insert(webhook.id.clone(), webhook.clone());
        webhook
    }

    pub fn get(&self, id: &str) -> Option<Webhook> {
        let webhooks = self.webhooks.lock().unwrap();
        webhooks.get(id).cloned()
    }

    pub fn list(&self) -> Vec<Webhook> {
        let webhooks = self.webhooks.lock().unwrap();
        webhooks.values().cloned().collect()
    }

    pub fn update(&self, id: &str, req: UpdateWebhookRequest) -> Option<Webhook> {
        let mut webhooks = self.webhooks.lock().unwrap();
        webhooks.get_mut(id).map(|webhook| {
            if let Some(url) = req.url {
                webhook.url = url;
            }
            if let Some(events) = req.events {
                webhook.events = events;
            }
            if let Some(active) = req.active {
                webhook.active = active;
            }
            webhook.updated_at = Utc::now();
            webhook.clone()
        })
    }

    pub fn delete(&self, id: &str) -> bool {
        let mut webhooks = self.webhooks.lock().unwrap();
        webhooks.remove(id).is_some()
    }

    pub fn get_active_webhooks(&self, event: &WebhookEvent) -> Vec<Webhook> {
        let webhooks = self.webhooks.lock().unwrap();
        webhooks
            .values()
            .filter(|w| w.active && w.events.contains(event))
            .cloned()
            .collect()
    }

    // ── DLQ inspection ────────────────────────────────────────────────────────

    /// Return a snapshot of all dead-lettered deliveries.
    pub fn dead_letters(&self) -> Vec<DeadLetter> {
        self.dlq.lock().unwrap().clone()
    }

    /// Drain (clear) the DLQ and return the removed entries.
    pub fn drain_dlq(&self) -> Vec<DeadLetter> {
        let mut dlq = self.dlq.lock().unwrap();
        std::mem::take(&mut *dlq)
    }

    // ── Trigger ───────────────────────────────────────────────────────────────

    /// Fire-and-forget: dispatches one tokio task per matching webhook.
    /// Each task retries with the configured backoff before giving up and
    /// writing to the DLQ.
    pub async fn trigger(&self, event: WebhookEvent, data: serde_json::Value) {
        let webhooks = self.get_active_webhooks(&event);
        let payload = WebhookPayload {
            id: Uuid::new_v4().to_string(),
            event,
            timestamp: Utc::now(),
            data,
        };

        for webhook in webhooks {
            let payload = payload.clone();
            let dlq = self.dlq.clone();
            let delays = self.retry_config.delays.clone();
            let max_attempts = self.retry_config.max_attempts;

            tokio::spawn(async move {
                deliver_with_retry(&webhook, &payload, &delays, max_attempts, dlq).await;
            });
        }
    }
}

// ── Delivery with retry + DLQ ─────────────────────────────────────────────────

/// Attempt to deliver `payload` to `webhook`, retrying with `delays` between
/// each attempt.  On final failure the payload is moved to `dlq`.
async fn deliver_with_retry(
    webhook: &Webhook,
    payload: &WebhookPayload,
    delays: &[Duration],
    max_attempts: usize,
    dlq: Arc<Mutex<Vec<DeadLetter>>>,
) {
    let first_attempt_at = Utc::now();
    let max_attempts = max_attempts.max(1).min(delays.len().saturating_add(1));

    let mut last_error = String::new();

    for attempt in 0..max_attempts {
        match send_webhook(webhook, payload).await {
            Ok(()) => {
                info!(
                    webhook_id = %webhook.id,
                    attempt    = attempt + 1,
                    "Webhook delivered successfully"
                );
                return; // success — nothing more to do
            }
            Err(e) => {
                last_error = e.to_string();
                if attempt + 1 < max_attempts {
                    let delay = delays[attempt];
                    warn!(
                        webhook_id = %webhook.id,
                        attempt    = attempt + 1,
                        delay_secs = delay.as_secs(),
                        error      = %last_error,
                        "Webhook delivery failed, will retry"
                    );
                    tokio::time::sleep(delay).await;
                } else {
                    error!(
                        webhook_id = %webhook.id,
                        attempts   = max_attempts,
                        error      = %last_error,
                        "Webhook delivery exhausted all retries — moving to DLQ"
                    );
                }
            }
        }
    }

    // All attempts exhausted — push to DLQ.
    let entry = DeadLetter {
        webhook_id: webhook.id.clone(),
        url: webhook.url.clone(),
        payload: payload.clone(),
        last_error,
        first_attempt_at,
        failed_at: Utc::now(),
        attempts: max_attempts as u32,
    };
    dlq.lock().unwrap().push(entry);
}

/// Single HTTP POST attempt.
async fn send_webhook(
    webhook: &Webhook,
    payload: &WebhookPayload,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(10)).build()?;

    let body = serde_json::to_string(payload)?;
    let signature = sign_payload(&webhook.secret, body.as_bytes())?;

    let response = client
        .post(&webhook.url)
        .header("Content-Type", "application/json")
        .header("X-Webhook-Signature", format!("sha256={signature}"))
        .header("Idempotency-Key", &payload.id)
        .body(body)
        .send()
        .await?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!("HTTP {}", response.status()).into())
    }
}

fn sign_payload(
    secret: &str,
    body: &[u8],
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())?;
    mac.update(body);
    Ok(hex::encode(mac.finalize().into_bytes()))
}

#[cfg(test)]
mod tests {
    use super::sign_payload;

    #[test]
    fn signs_payload_with_hmac_sha256() {
        let signature = sign_payload(
            "key",
            b"The quick brown fox jumps over the lazy dog",
        )
        .unwrap();

        assert_eq!(
            signature,
            "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8"
        );
    }
}
