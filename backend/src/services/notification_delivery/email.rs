//! Email delivery channel.

use async_trait::async_trait;

use super::{Channel, DeliveryError, NotificationChannel};

pub struct EmailSender {
    pub api_key: String,
    pub from_email: String,
}

#[async_trait]
impl NotificationChannel for EmailSender {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn sender() -> EmailSender {
        EmailSender {
            api_key: "key".to_string(),
            from_email: "no-reply@scavngr.io".to_string(),
        }
    }

    #[test]
    fn reports_email_channel() {
        assert_eq!(sender().channel(), Channel::Email);
    }

    #[tokio::test]
    async fn accepts_well_formed_address() {
        let result = sender().send("user@example.com", "Subject", "Body").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn rejects_address_without_at_sign() {
        let result = sender().send("not-an-email", "Subject", "Body").await;
        assert!(matches!(result, Err(DeliveryError::InvalidRecipient(_))));
    }

    #[tokio::test]
    async fn rejects_empty_recipient() {
        let result = sender().send("", "Subject", "Body").await;
        assert!(result.is_err());
    }
}
