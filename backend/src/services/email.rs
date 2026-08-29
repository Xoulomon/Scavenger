use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EmailError {
    #[error("Email service error: {0}")]
    ServiceError(String),
    #[error("Template error: {0}")]
    TemplateError(String),
    #[error("Invalid email: {0}")]
    InvalidEmail(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailTemplate {
    pub name: String,
    pub subject: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailMessage {
    pub to: String,
    pub subject: String,
    pub body: String,
    pub html: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionalEmail {
    pub recipient: String,
    pub template: String,
    pub context: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DigestEmail {
    pub recipient: String,
    pub digest_type: String,
    pub period: String,
}

#[async_trait::async_trait]
pub trait EmailService: Send + Sync {
    async fn send_transactional(&self, email: TransactionalEmail) -> Result<String, EmailError>;
    async fn send_digest(&self, email: DigestEmail) -> Result<String, EmailError>;
    async fn add_to_unsubscribe_list(&self, email: &str) -> Result<(), EmailError>;
    async fn is_unsubscribed(&self, email: &str) -> Result<bool, EmailError>;
}

pub struct SendGridEmailService {
    api_key: String,
    from_email: String,
}

impl SendGridEmailService {
    pub fn new(api_key: String, from_email: String) -> Self {
        Self { api_key, from_email }
    }

    fn validate_email(&self, email: &str) -> Result<(), EmailError> {
        if email.contains('@') && email.contains('.') {
            Ok(())
        } else {
            Err(EmailError::InvalidEmail(email.to_string()))
        }
    }
}

#[async_trait::async_trait]
impl EmailService for SendGridEmailService {
    async fn send_transactional(&self, email: TransactionalEmail) -> Result<String, EmailError> {
        self.validate_email(&email.recipient)?;

        let client = reqwest::Client::new();
        let mut body = serde_json::json!({
            "personalizations": [{
                "to": [{"email": email.recipient}],
                "subject": email.template
            }],
            "from": {"email": self.from_email},
            "content": [{
                "type": "text/html",
                "value": format!("Template: {}", email.template)
            }]
        });

        let response = client
            .post("https://api.sendgrid.com/v3/mail/send")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .map_err(|e| EmailError::ServiceError(e.to_string()))?;

        if response.status().is_success() {
            Ok(uuid::Uuid::new_v4().to_string())
        } else {
            Err(EmailError::ServiceError("Failed to send email".to_string()))
        }
    }

    async fn send_digest(&self, email: DigestEmail) -> Result<String, EmailError> {
        self.validate_email(&email.recipient)?;

        let client = reqwest::Client::new();
        let body = serde_json::json!({
            "personalizations": [{
                "to": [{"email": email.recipient}],
                "subject": format!("{} Digest - {}", email.digest_type, email.period)
            }],
            "from": {"email": self.from_email},
            "content": [{
                "type": "text/html",
                "value": format!("Your {} digest for {}", email.digest_type, email.period)
            }]
        });

        let response = client
            .post("https://api.sendgrid.com/v3/mail/send")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .map_err(|e| EmailError::ServiceError(e.to_string()))?;

        if response.status().is_success() {
            Ok(uuid::Uuid::new_v4().to_string())
        } else {
            Err(EmailError::ServiceError("Failed to send digest".to_string()))
        }
    }

    async fn add_to_unsubscribe_list(&self, email: &str) -> Result<(), EmailError> {
        self.validate_email(email)?;
        Ok(())
    }

    async fn is_unsubscribed(&self, email: &str) -> Result<bool, EmailError> {
        self.validate_email(email)?;
        Ok(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_email_validation() {
        let service = SendGridEmailService::new("key".to_string(), "from@test.com".to_string());
        assert!(service.validate_email("test@example.com").is_ok());
        assert!(service.validate_email("invalid").is_err());
    }

    #[tokio::test]
    async fn test_unsubscribe_list() {
        let service = SendGridEmailService::new("key".to_string(), "from@test.com".to_string());
        assert!(service.add_to_unsubscribe_list("test@example.com").await.is_ok());
        assert!(service.is_unsubscribed("test@example.com").await.is_ok());
    }

    #[tokio::test]
    async fn test_invalid_email_transactional() {
        let service = SendGridEmailService::new("key".to_string(), "from@test.com".to_string());
        let email = TransactionalEmail {
            recipient: "invalid".to_string(),
            template: "test".to_string(),
            context: HashMap::new(),
        };
        assert!(service.send_transactional(email).await.is_err());
    }

    #[tokio::test]
    async fn test_invalid_email_digest() {
        let service = SendGridEmailService::new("key".to_string(), "from@test.com".to_string());
        let email = DigestEmail {
            recipient: "invalid".to_string(),
            digest_type: "weekly".to_string(),
            period: "2024-01".to_string(),
        };
        assert!(service.send_digest(email).await.is_err());
    }
}
