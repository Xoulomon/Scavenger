//! Webhook delivery channel — POSTs the notification payload to a
//! subscriber-supplied URL (the `recipient`).

use async_trait::async_trait;
use std::sync::Arc;

use super::transport::{HttpTransport, ReqwestTransport};
use super::{Channel, DeliveryError, NotificationChannel};

pub struct WebhookSender {
    pub transport: Arc<dyn HttpTransport>,
}

impl WebhookSender {
    pub fn new() -> Self {
        Self {
            transport: Arc::new(ReqwestTransport::new()),
        }
    }

    pub fn with_transport(transport: Arc<dyn HttpTransport>) -> Self {
        Self { transport }
    }
}

impl Default for WebhookSender {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl NotificationChannel for WebhookSender {
    fn channel(&self) -> Channel {
        Channel::Webhook
    }

    async fn send(&self, recipient: &str, subject: &str, body: &str) -> Result<(), DeliveryError> {
        if !recipient.starts_with("http://") && !recipient.starts_with("https://") {
            return Err(DeliveryError::InvalidRecipient(recipient.to_string()));
        }

        let payload = serde_json::json!({
            "subject": subject,
            "body": body,
        });

        let status = self
            .transport
            .post_json(recipient, payload)
            .await
            .map_err(|e| DeliveryError::ChannelError {
                channel: "webhook".to_string(),
                msg: e,
            })?;

        if (200..300).contains(&status) {
            Ok(())
        } else {
            Err(DeliveryError::ChannelError {
                channel: "webhook".to_string(),
                msg: format!("Webhook endpoint returned status {}", status),
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::transport::mock::MockTransport;
    use super::*;

    #[test]
    fn reports_webhook_channel() {
        let sender = WebhookSender::with_transport(Arc::new(MockTransport::success(200)));
        assert_eq!(sender.channel(), Channel::Webhook);
    }

    #[tokio::test]
    async fn rejects_non_http_recipient() {
        let sender = WebhookSender::with_transport(Arc::new(MockTransport::success(200)));
        let result = sender.send("not-a-url", "Subject", "Body").await;
        assert!(matches!(result, Err(DeliveryError::InvalidRecipient(_))));
    }

    #[tokio::test]
    async fn sends_via_mocked_transport_on_success() {
        let sender = WebhookSender::with_transport(Arc::new(MockTransport::success(204)));
        let result = sender.send("https://example.com/hooks/abc", "Subject", "Body").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn maps_non_2xx_status_to_channel_error() {
        let sender = WebhookSender::with_transport(Arc::new(MockTransport::success(404)));
        let result = sender.send("https://example.com/hooks/abc", "Subject", "Body").await;
        assert!(matches!(result, Err(DeliveryError::ChannelError { .. })));
    }

    #[tokio::test]
    async fn maps_transport_failure_to_channel_error() {
        let sender = WebhookSender::with_transport(Arc::new(MockTransport::failure("dns error")));
        let result = sender.send("https://example.com/hooks/abc", "Subject", "Body").await;
        assert!(matches!(result, Err(DeliveryError::ChannelError { .. })));
    }

    #[tokio::test]
    async fn payload_carries_subject_and_body_to_transport() {
        let transport = Arc::new(MockTransport::success(200));
        let sender = WebhookSender::with_transport(transport.clone());
        sender
            .send("https://example.com/hooks/abc", "Hello", "World")
            .await
            .unwrap();

        let payload = transport.last_payload().unwrap();
        assert_eq!(payload["subject"], "Hello");
        assert_eq!(payload["body"], "World");
    }
}
