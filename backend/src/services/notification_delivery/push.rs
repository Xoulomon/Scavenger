//! Push delivery channel (Firebase Cloud Messaging).

use async_trait::async_trait;
use std::sync::Arc;

use super::transport::{HttpTransport, ReqwestTransport};
use super::{Channel, DeliveryError, NotificationChannel};

pub struct PushSender {
    pub firebase_project_id: String,
    pub transport: Arc<dyn HttpTransport>,
}

impl PushSender {
    pub fn new(firebase_project_id: impl Into<String>) -> Self {
        Self {
            firebase_project_id: firebase_project_id.into(),
            transport: Arc::new(ReqwestTransport::new()),
        }
    }

    pub fn with_transport(firebase_project_id: impl Into<String>, transport: Arc<dyn HttpTransport>) -> Self {
        Self {
            firebase_project_id: firebase_project_id.into(),
            transport,
        }
    }
}

#[async_trait]
impl NotificationChannel for PushSender {
    fn channel(&self) -> Channel {
        Channel::Push
    }

    async fn send(&self, recipient: &str, subject: &str, body: &str) -> Result<(), DeliveryError> {
        if recipient.len() < 10 {
            return Err(DeliveryError::InvalidRecipient(recipient.to_string()));
        }

        let payload = serde_json::json!({
            "message": {
                "token": recipient,
                "notification": {
                    "title": subject,
                    "body": body
                }
            }
        });

        let url = format!(
            "https://fcm.googleapis.com/v1/projects/{}/messages:send",
            self.firebase_project_id
        );

        let status = self
            .transport
            .post_json(&url, payload)
            .await
            .map_err(|e| DeliveryError::ChannelError {
                channel: "push".to_string(),
                msg: e,
            })?;

        if (200..300).contains(&status) {
            Ok(())
        } else {
            Err(DeliveryError::ChannelError {
                channel: "push".to_string(),
                msg: format!("FCM request failed with status {}", status),
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::transport::mock::MockTransport;
    use super::*;

    fn sender_with(transport: MockTransport) -> PushSender {
        PushSender::with_transport("proj", Arc::new(transport))
    }

    #[test]
    fn reports_push_channel() {
        assert_eq!(sender_with(MockTransport::success(200)).channel(), Channel::Push);
    }

    #[tokio::test]
    async fn rejects_short_device_token() {
        let sender = sender_with(MockTransport::success(200));
        let result = sender.send("short", "Title", "Body").await;
        assert!(matches!(result, Err(DeliveryError::InvalidRecipient(_))));
    }

    #[tokio::test]
    async fn sends_via_mocked_transport_on_success() {
        let sender = sender_with(MockTransport::success(200));
        let result = sender.send("valid-device-token-123", "Title", "Body").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn maps_non_2xx_status_to_channel_error() {
        let sender = sender_with(MockTransport::success(500));
        let result = sender.send("valid-device-token-123", "Title", "Body").await;
        assert!(matches!(result, Err(DeliveryError::ChannelError { .. })));
    }

    #[tokio::test]
    async fn maps_transport_failure_to_channel_error() {
        let sender = sender_with(MockTransport::failure("connection reset"));
        let result = sender.send("valid-device-token-123", "Title", "Body").await;
        assert!(matches!(result, Err(DeliveryError::ChannelError { .. })));
    }

    #[tokio::test]
    async fn payload_carries_title_and_body_to_transport() {
        let transport = Arc::new(MockTransport::success(200));
        let sender = PushSender::with_transport("proj", transport.clone());
        sender.send("valid-device-token-123", "Hello", "World").await.unwrap();

        assert_eq!(transport.call_count(), 1);
        let payload = transport.last_payload().unwrap();
        assert_eq!(payload["message"]["notification"]["title"], "Hello");
        assert_eq!(payload["message"]["notification"]["body"], "World");
    }
}
