//! SMS delivery channel.

use async_trait::async_trait;

use super::{Channel, DeliveryError, NotificationChannel};

pub struct SmsSender {
    pub account_sid: String,
    pub auth_token: String,
    pub from_number: String,
}

#[async_trait]
impl NotificationChannel for SmsSender {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn sender() -> SmsSender {
        SmsSender {
            account_sid: "sid".to_string(),
            auth_token: "tok".to_string(),
            from_number: "+10000000000".to_string(),
        }
    }

    #[test]
    fn reports_sms_channel() {
        assert_eq!(sender().channel(), Channel::Sms);
    }

    #[tokio::test]
    async fn accepts_well_formed_number() {
        let result = sender().send("+12025550100", "ignored", "Body").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn rejects_number_without_plus_prefix() {
        let result = sender().send("12025550100", "ignored", "Body").await;
        assert!(matches!(result, Err(DeliveryError::InvalidRecipient(_))));
    }

    #[tokio::test]
    async fn rejects_number_too_short() {
        let result = sender().send("+1", "ignored", "Body").await;
        assert!(result.is_err());
    }
}
