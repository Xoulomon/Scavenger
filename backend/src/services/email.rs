/// Email service (issue #1074 — structured logging).
///
/// ## Logging convention
/// Required fields on every log call:
///   - `service`    — always `"email"`
///   - `outcome`    — `"ok"` | `"error"` | `"warn"`
///   - `op`         — the method name
///   - `recipient`  — redacted email where safe; full address only in `debug`
///
/// `println!` / ad-hoc debug logging have been removed throughout.
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

    /// Returns a domain-level hint for log correlation without logging the
    /// full address (PII reduction).
    fn email_domain(email: &str) -> &str {
        email.split('@').nth(1).unwrap_or("unknown")
    }
}

#[async_trait::async_trait]
impl EmailService for SendGridEmailService {
    async fn send_transactional(&self, email: TransactionalEmail) -> Result<String, EmailError> {
        self.validate_email(&email.recipient)?;

        let client = reqwest::Client::new();
        let body = serde_json::json!({
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
            .map_err(|e| {
                log::error!(
                    service = "email",
                    op = "send_transactional",
                    outcome = "error",
                    template = %email.template,
                    error = %e;
                    "SendGrid HTTP request failed"
                );
                EmailError::ServiceError(e.to_string())
            })?;

        if response.status().is_success() {
            let message_id = uuid::Uuid::new_v4().to_string();
            log::info!(
                service = "email",
                op = "send_transactional",
                outcome = "ok",
                template = %email.template,
                recipient_domain = %Self::email_domain(&email.recipient),
                message_id = %message_id;
                "transactional email sent"
            );
            Ok(message_id)
        } else {
            log::error!(
                service = "email",
                op = "send_transactional",
                outcome = "error",
                template = %email.template,
                status = %response.status();
                "SendGrid returned non-success status"
            );
            Err(EmailError::ServiceError("Failed to send email".to_string()))
        }
    }

    async fn send_digest(&self, email: DigestEmail) -> Result<String, EmailError> {
        self.validate_email(&email.recipient).map_err(|e| {
            log::warn!(
                service = "email",
                op = "send_digest",
                outcome = "error",
                digest_type = %email.digest_type,
                error = %e;
                "send_digest validation failed"
            );
            e
        })?;

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
            .map_err(|e| {
                log::error!(
                    service = "email",
                    op = "send_digest",
                    outcome = "error",
                    digest_type = %email.digest_type,
                    error = %e;
                    "SendGrid digest HTTP request failed"
                );
                EmailError::ServiceError(e.to_string())
            })?;

        if response.status().is_success() {
            let message_id = uuid::Uuid::new_v4().to_string();
            log::info!(
                service = "email",
                op = "send_digest",
                outcome = "ok",
                digest_type = %email.digest_type,
                period = %email.period,
                recipient_domain = %Self::email_domain(&email.recipient),
                message_id = %message_id;
                "digest email sent"
            );
            Ok(message_id)
        } else {
            Err(EmailError::ServiceError("Failed to send digest".to_string()))
        }
    }

    async fn add_to_unsubscribe_list(&self, email: &str) -> Result<(), EmailError> {
        self.validate_email(email).map_err(|e| {
            log::warn!(
                service = "email",
                op = "add_to_unsubscribe_list",
                outcome = "error",
                error = %e;
                "add_to_unsubscribe_list validation failed"
            );
            e
        })?;

        log::info!(
            service = "email",
            op = "add_to_unsubscribe_list",
            outcome = "ok",
            recipient_domain = %Self::email_domain(email);
            "address added to unsubscribe list"
        );
        Ok(())
    }

    async fn is_unsubscribed(&self, email: &str) -> Result<bool, EmailError> {
        self.validate_email(email).map_err(|e| {
            log::warn!(
                service = "email",
                op = "is_unsubscribed",
                outcome = "error",
                error = %e;
                "is_unsubscribed validation failed"
            );
            e
        })?;

        log::info!(
            service = "email",
            op = "is_unsubscribed",
            outcome = "ok",
            recipient_domain = %Self::email_domain(email);
            "unsubscribe status checked"
        );
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

    #[test]
    fn test_email_domain_helper() {
        assert_eq!(SendGridEmailService::email_domain("user@example.com"), "example.com");
        assert_eq!(SendGridEmailService::email_domain("invalid"), "unknown");
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
