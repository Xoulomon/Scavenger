use chrono::{DateTime, Utc};
/// #802 - Notification Delivery Service
/// Multi-channel (email, SMS, push) with retry logic, delivery tracking, and templates.
///
/// #1087: this module owns *how* a notification reaches a channel — the wire
/// protocol / provider API call, retry policy, and delivery-status tracking
/// for each `ChannelSender`. Deciding *what* to send and *when* (device
/// registration, user preferences, scheduling) lives in `notifications.rs`,
/// which delegates the actual send to a `ChannelSender` from this module.
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use thiserror::Error;
use uuid::Uuid;

// ── Errors ────────────────────────────────────────────────────────────────────

#[derive(Debug, Error, Clone)]
pub enum DeliveryError {
    #[error("Channel error [{channel}]: {msg}")]
    ChannelError { channel: String, msg: String },
    #[error("Template not found: {0}")]
    TemplateNotFound(String),
    #[error("Template render error: {0}")]
    TemplateRender(String),
    #[error("Invalid recipient: {0}")]
    InvalidRecipient(String),
    #[error("Max retries exceeded for notification {0}")]
    MaxRetriesExceeded(String),
}

// ── Channel types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Channel {
    Email,
    Sms,
    Push,
}

// ── Templates ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationTemplate {
    pub id: String,
    pub name: String,
    /// Subject line (email) or title (push/SMS prefix).
    /// Supports `{{key}}` placeholders.
    pub subject: String,
    /// Body text. Supports `{{key}}` placeholders.
    pub body: String,
    pub channels: Vec<Channel>,
}

impl NotificationTemplate {
    fn render(&self, vars: &HashMap<String, String>) -> Result<(String, String), DeliveryError> {
        let render = |template: &str| -> String {
            vars.iter().fold(template.to_string(), |acc, (k, v)| {
                acc.replace(&format!("{{{{{}}}}}", k), v)
            })
        };
        Ok((render(&self.subject), render(&self.body)))
    }
}

// ── Delivery record ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryStatus {
    Pending,
    Sent,
    Failed,
    Retrying,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryRecord {
    pub id: String,
    pub notification_id: String,
    pub channel: Channel,
    pub recipient: String,
    pub subject: String,
    pub body: String,
    pub status: DeliveryStatus,
    pub attempts: u32,
    pub last_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Request / Response ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationRequest {
    /// Which channels to deliver over.
    pub channels: Vec<Channel>,
    /// Recipient address per channel (email addr, phone number, device token).
    pub recipients: HashMap<Channel, String>,
    /// Template ID to use (or provide `subject`+`body` directly).
    pub template_id: Option<String>,
    /// Substitution variables for the template.
    pub template_vars: HashMap<String, String>,
    /// Direct subject (used if no template_id).
    pub subject: Option<String>,
    /// Direct body (used if no template_id).
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationResult {
    pub notification_id: String,
    pub records: Vec<DeliveryRecord>,
}

// ── Channel sender trait ──────────────────────────────────────────────────────

#[async_trait::async_trait]
pub trait ChannelSender: Send + Sync {
    fn channel(&self) -> Channel;
    async fn send(&self, recipient: &str, subject: &str, body: &str) -> Result<(), DeliveryError>;
}

// ── Concrete senders ──────────────────────────────────────────────────────────

pub struct EmailSender {
    pub api_key: String,
    pub from_email: String,
}

#[async_trait::async_trait]
impl ChannelSender for EmailSender {
    fn channel(&self) -> Channel {
        Channel::Email
    }

    async fn send(&self, recipient: &str, subject: &str, body: &str) -> Result<(), DeliveryError> {
        if !recipient.contains('@') {
            return Err(DeliveryError::InvalidRecipient(recipient.to_string()));
        }
        // In production: call SendGrid / SES. Here we validate and succeed.
        let _ = (&self.api_key, &self.from_email, subject, body);
        Ok(())
    }
}

pub struct SmsSender {
    pub account_sid: String,
    pub auth_token: String,
    pub from_number: String,
}

#[async_trait::async_trait]
impl ChannelSender for SmsSender {
    fn channel(&self) -> Channel {
        Channel::Sms
    }

    async fn send(&self, recipient: &str, _subject: &str, body: &str) -> Result<(), DeliveryError> {
        if !recipient.starts_with('+') || recipient.len() < 8 {
            return Err(DeliveryError::InvalidRecipient(recipient.to_string()));
        }
        // In production: call Twilio API.
        let _ = (&self.account_sid, &self.auth_token, &self.from_number, body);
        Ok(())
    }
}

pub struct PushSender {
    pub firebase_project_id: String,
}

#[async_trait::async_trait]
impl ChannelSender for PushSender {
    fn channel(&self) -> Channel {
        Channel::Push
    }

    async fn send(&self, recipient: &str, subject: &str, body: &str) -> Result<(), DeliveryError> {
        if recipient.len() < 10 {
            return Err(DeliveryError::InvalidRecipient(recipient.to_string()));
        }

        // #1087: moved from notifications.rs::FirebaseNotificationService,
        // which now delegates here instead of calling FCM itself — this is
        // the single place push notifications actually go out over the wire.
        let client = reqwest::Client::new();
        let payload = serde_json::json!({
            "message": {
                "token": recipient,
                "notification": {
                    "title": subject,
                    "body": body
                }
            }
        });

        let response = client
            .post(format!(
                "https://fcm.googleapis.com/v1/projects/{}/messages:send",
                self.firebase_project_id
            ))
            .json(&payload)
            .send()
            .await
            .map_err(|e| DeliveryError::ChannelError {
                channel: "push".to_string(),
                msg: e.to_string(),
            })?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(DeliveryError::ChannelError {
                channel: "push".to_string(),
                msg: format!("FCM request failed with status {}", response.status()),
            })
        }
    }
}

// ── Delivery service ──────────────────────────────────────────────────────────

pub struct NotificationDeliveryService {
    senders: HashMap<Channel, Arc<dyn ChannelSender>>,
    templates: Mutex<HashMap<String, NotificationTemplate>>,
    records: Mutex<Vec<DeliveryRecord>>,
    max_retries: u32,
}

impl NotificationDeliveryService {
    pub fn new(max_retries: u32) -> Self {
        Self {
            senders: HashMap::new(),
            templates: Mutex::new(HashMap::new()),
            records: Mutex::new(Vec::new()),
            max_retries,
        }
    }

    pub fn register_sender(mut self, sender: Arc<dyn ChannelSender>) -> Self {
        self.senders.insert(sender.channel(), sender);
        self
    }

    // ── Template management ────────────────────────────────────────────────

    pub fn add_template(&self, template: NotificationTemplate) {
        self.templates.lock().unwrap().insert(template.id.clone(), template);
    }

    pub fn get_template(&self, id: &str) -> Option<NotificationTemplate> {
        self.templates.lock().unwrap().get(id).cloned()
    }

    // ── Delivery tracking ──────────────────────────────────────────────────

    pub fn get_record(&self, record_id: &str) -> Option<DeliveryRecord> {
        self.records.lock().unwrap().iter().find(|r| r.id == record_id).cloned()
    }

    pub fn get_records_by_notification(&self, notification_id: &str) -> Vec<DeliveryRecord> {
        self.records
            .lock()
            .unwrap()
            .iter()
            .filter(|r| r.notification_id == notification_id)
            .cloned()
            .collect()
    }

    fn upsert_record(&self, record: DeliveryRecord) {
        let mut records = self.records.lock().unwrap();
        if let Some(existing) = records.iter_mut().find(|r| r.id == record.id) {
            *existing = record;
        } else {
            records.push(record);
        }
    }

    // ── Core send logic ────────────────────────────────────────────────────

    /// Send a notification across all requested channels with retry logic.
    pub async fn send(&self, req: NotificationRequest) -> Result<NotificationResult, DeliveryError> {
        let notification_id = Uuid::new_v4().to_string();

        // Resolve subject+body (template or direct)
        let (subject, body) = if let Some(tid) = &req.template_id {
            let tmpl = self
                .templates
                .lock()
                .unwrap()
                .get(tid.as_str())
                .cloned()
                .ok_or_else(|| DeliveryError::TemplateNotFound(tid.clone()))?;
            tmpl.render(&req.template_vars)?
        } else {
            (
                req.subject.clone().unwrap_or_default(),
                req.body.clone().unwrap_or_default(),
            )
        };

        let mut results = Vec::new();

        for channel in &req.channels {
            let recipient = req.recipients.get(channel).cloned().unwrap_or_default();

            let record_id = Uuid::new_v4().to_string();
            let mut record = DeliveryRecord {
                id: record_id.clone(),
                notification_id: notification_id.clone(),
                channel: channel.clone(),
                recipient: recipient.clone(),
                subject: subject.clone(),
                body: body.clone(),
                status: DeliveryStatus::Pending,
                attempts: 0,
                last_error: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };
            self.upsert_record(record.clone());

            let sender = match self.senders.get(channel) {
                Some(s) => s.clone(),
                None => {
                    record.status = DeliveryStatus::Failed;
                    record.last_error = Some(format!("No sender registered for {:?}", channel));
                    record.updated_at = Utc::now();
                    self.upsert_record(record.clone());
                    results.push(record);
                    continue;
                }
            };

            // Retry loop
            let mut last_err: Option<String> = None;
            for attempt in 0..=self.max_retries {
                record.attempts = attempt + 1;
                record.status = if attempt == 0 {
                    DeliveryStatus::Pending
                } else {
                    DeliveryStatus::Retrying
                };
                record.updated_at = Utc::now();
                self.upsert_record(record.clone());

                match sender.send(&recipient, &subject, &body).await {
                    Ok(_) => {
                        record.status = DeliveryStatus::Sent;
                        record.last_error = None;
                        record.updated_at = Utc::now();
                        self.upsert_record(record.clone());
                        last_err = None;
                        break;
                    }
                    Err(e) => {
                        last_err = Some(e.to_string());
                        if attempt == self.max_retries {
                            record.status = DeliveryStatus::Failed;
                            record.last_error = last_err.clone();
                            record.updated_at = Utc::now();
                            self.upsert_record(record.clone());
                        }
                    }
                }
            }

            // If still failed after retries
            if last_err.is_some() && record.status != DeliveryStatus::Sent {
                return Err(DeliveryError::MaxRetriesExceeded(record_id));
            }

            results.push(record);
        }

        Ok(NotificationResult {
            notification_id,
            records: results,
        })
    }
}

// ── Builder helpers ───────────────────────────────────────────────────────────

impl Default for NotificationDeliveryService {
    fn default() -> Self {
        Self::new(3)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn make_service() -> NotificationDeliveryService {
        NotificationDeliveryService::new(2)
            .register_sender(Arc::new(EmailSender {
                api_key: "key".to_string(),
                from_email: "no-reply@scavngr.io".to_string(),
            }))
            .register_sender(Arc::new(SmsSender {
                account_sid: "sid".to_string(),
                auth_token: "tok".to_string(),
                from_number: "+10000000000".to_string(),
            }))
            .register_sender(Arc::new(PushSender {
                firebase_project_id: "proj".to_string(),
            }))
    }

    fn waste_transfer_template() -> NotificationTemplate {
        NotificationTemplate {
            id: "waste_transfer".to_string(),
            name: "Waste Transfer".to_string(),
            subject: "Waste {{waste_id}} transferred".to_string(),
            body: "Hello {{user}}, waste item {{waste_id}} has been transferred.".to_string(),
            channels: vec![Channel::Email, Channel::Push],
        }
    }

    #[tokio::test]
    async fn test_send_email_direct() {
        let svc = make_service();
        let mut recipients = HashMap::new();
        recipients.insert(Channel::Email, "user@example.com".to_string());
        let req = NotificationRequest {
            channels: vec![Channel::Email],
            recipients,
            template_id: None,
            template_vars: HashMap::new(),
            subject: Some("Test".to_string()),
            body: Some("Hello".to_string()),
        };
        let result = svc.send(req).await.unwrap();
        assert_eq!(result.records.len(), 1);
        assert_eq!(result.records[0].status, DeliveryStatus::Sent);
    }

    #[tokio::test]
    async fn test_template_rendering() {
        let svc = make_service();
        svc.add_template(waste_transfer_template());

        let mut vars = HashMap::new();
        vars.insert("waste_id".to_string(), "W-42".to_string());
        vars.insert("user".to_string(), "Alice".to_string());
        let mut recipients = HashMap::new();
        recipients.insert(Channel::Email, "alice@example.com".to_string());

        let req = NotificationRequest {
            channels: vec![Channel::Email],
            recipients,
            template_id: Some("waste_transfer".to_string()),
            template_vars: vars,
            subject: None,
            body: None,
        };
        let result = svc.send(req).await.unwrap();
        assert_eq!(result.records[0].subject, "Waste W-42 transferred");
        assert!(result.records[0].body.contains("Alice"));
    }

    #[tokio::test]
    async fn test_missing_template_error() {
        let svc = make_service();
        let req = NotificationRequest {
            channels: vec![Channel::Email],
            recipients: HashMap::new(),
            template_id: Some("nonexistent".to_string()),
            template_vars: HashMap::new(),
            subject: None,
            body: None,
        };
        assert!(matches!(svc.send(req).await, Err(DeliveryError::TemplateNotFound(_))));
    }

    #[tokio::test]
    async fn test_multichannel_send() {
        // #1087: Push is intentionally excluded here — PushSender now makes a
        // real FCM call (moved from notifications.rs, see the module doc
        // comment above), so it needs network access/credentials and isn't
        // exercised by this offline unit test. Email/Sms remain simulated
        // sends and stay deterministic.
        let svc = make_service();
        let mut recipients = HashMap::new();
        recipients.insert(Channel::Email, "u@example.com".to_string());
        recipients.insert(Channel::Sms, "+12025550100".to_string());

        let req = NotificationRequest {
            channels: vec![Channel::Email, Channel::Sms],
            recipients,
            template_id: None,
            template_vars: HashMap::new(),
            subject: Some("Multi-channel".to_string()),
            body: Some("Body".to_string()),
        };
        let result = svc.send(req).await.unwrap();
        assert_eq!(result.records.len(), 2);
        assert!(result.records.iter().all(|r| r.status == DeliveryStatus::Sent));
    }

    #[tokio::test]
    async fn test_invalid_email_recipient() {
        let svc = make_service();
        let mut recipients = HashMap::new();
        recipients.insert(Channel::Email, "not-an-email".to_string());
        let req = NotificationRequest {
            channels: vec![Channel::Email],
            recipients,
            template_id: None,
            template_vars: HashMap::new(),
            subject: Some("x".to_string()),
            body: Some("x".to_string()),
        };
        assert!(svc.send(req).await.is_err());
    }

    #[tokio::test]
    async fn test_delivery_tracking() {
        let svc = make_service();
        let mut recipients = HashMap::new();
        recipients.insert(Channel::Email, "user@example.com".to_string());
        let req = NotificationRequest {
            channels: vec![Channel::Email],
            recipients,
            template_id: None,
            template_vars: HashMap::new(),
            subject: Some("Track me".to_string()),
            body: Some("Body".to_string()),
        };
        let result = svc.send(req).await.unwrap();
        let nid = &result.notification_id;
        let fetched = svc.get_records_by_notification(nid);
        assert_eq!(fetched.len(), 1);
        assert_eq!(fetched[0].status, DeliveryStatus::Sent);
    }

    #[test]
    fn test_sms_sender_invalid_number() {
        let sender = SmsSender {
            account_sid: "sid".to_string(),
            auth_token: "tok".to_string(),
            from_number: "+1".to_string(),
        };
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(sender.send("bad", "s", "b"));
        assert!(result.is_err());
    }
}
