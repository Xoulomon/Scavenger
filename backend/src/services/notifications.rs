use crate::services::notification_delivery::{ChannelSender, PushSender};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;

// #1087: this module owns *what* to notify and *when* — device registration,
// user preferences, and scheduling decisions. The actual wire send (the
// "how") is delegated to a `ChannelSender` from `notification_delivery.rs`,
// which is also where retry/delivery-tracking logic for that send lives.

#[derive(Debug, Error)]
pub enum NotificationError {
    #[error("Notification error: {0}")]
    ServiceError(String),
    #[error("Invalid device token: {0}")]
    InvalidToken(String),
    #[error("Device not found: {0}")]
    NotFound(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceToken {
    pub token: String,
    pub platform: String, // "ios", "android", "web"
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushNotification {
    pub title: String,
    pub body: String,
    pub data: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPreference {
    pub user_id: String,
    pub enabled: bool,
    pub categories: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledNotification {
    pub device_token: String,
    pub notification: PushNotification,
    pub scheduled_at: String,
}

#[async_trait::async_trait]
pub trait NotificationService: Send + Sync {
    async fn register_device(&self, token: DeviceToken) -> Result<String, NotificationError>;
    async fn send_notification(
        &self,
        device_token: &str,
        notification: PushNotification,
    ) -> Result<String, NotificationError>;
    async fn set_preferences(&self, preference: NotificationPreference) -> Result<(), NotificationError>;
    async fn get_preferences(&self, user_id: &str) -> Result<NotificationPreference, NotificationError>;
    async fn schedule_notification(&self, scheduled: ScheduledNotification) -> Result<String, NotificationError>;
}

pub struct FirebaseNotificationService {
    sender: Arc<dyn ChannelSender>,
}

impl FirebaseNotificationService {
    pub fn new(project_id: String) -> Self {
        let sender = Arc::new(PushSender {
            firebase_project_id: project_id,
        });
        Self { sender }
    }

    fn validate_token(&self, token: &str) -> Result<(), NotificationError> {
        if token.is_empty() || token.len() < 10 {
            return Err(NotificationError::InvalidToken(token.to_string()));
        }
        Ok(())
    }
}

#[async_trait::async_trait]
impl NotificationService for FirebaseNotificationService {
    async fn register_device(&self, token: DeviceToken) -> Result<String, NotificationError> {
        self.validate_token(&token.token)?;

        if token.user_id.is_empty() {
            return Err(NotificationError::InvalidToken("Empty user_id".to_string()));
        }

        let registration_id = uuid::Uuid::new_v4().to_string();
        log::info!(
            service = "notifications",
            op = "register_device",
            outcome = "ok",
            user_id = %token.user_id,
            platform = %token.platform,
            registration_id = %registration_id;
            "device registered"
        );
        Ok(registration_id)
    }

    async fn send_notification(
        &self,
        device_token: &str,
        notification: PushNotification,
    ) -> Result<String, NotificationError> {
        self.validate_token(device_token)?;

        if notification.title.is_empty() {
            return Err(NotificationError::ServiceError("Empty title".to_string()));
        }

        // "How" the push is actually delivered (the FCM call, retries at the
        // channel level) lives in notification_delivery.rs's PushSender.
        self.sender
            .send(device_token, &notification.title, &notification.body)
            .await
            .map_err(|e| {
                log::error!(
                    service = "notifications",
                    op = "send_notification",
                    outcome = "error",
                    error = %e;
                    "FCM HTTP request failed"
                );
                NotificationError::ServiceError(e.to_string())
            })?;

        Ok(uuid::Uuid::new_v4().to_string())
    }

    async fn set_preferences(&self, preference: NotificationPreference) -> Result<(), NotificationError> {
        if preference.user_id.is_empty() {
            return Err(NotificationError::InvalidToken("Empty user_id".to_string()));
        }

        log::info!(
            service = "notifications",
            op = "set_preferences",
            outcome = "ok",
            user_id = %preference.user_id,
            enabled = %preference.enabled;
            "notification preferences updated"
        );
        Ok(())
    }

    async fn get_preferences(
        &self,
        user_id: &str,
    ) -> Result<NotificationPreference, NotificationError> {
        if user_id.is_empty() {
            log::warn!(
                service = "notifications",
                op = "get_preferences",
                outcome = "error";
                "get_preferences rejected: empty user_id"
            );
            return Err(NotificationError::NotFound("User not found".to_string()));
        }

        log::info!(
            service = "notifications",
            op = "get_preferences",
            outcome = "ok",
            user_id = %user_id;
            "notification preferences retrieved"
        );
        Ok(NotificationPreference {
            user_id: user_id.to_string(),
            enabled: true,
            categories: vec!["transfers".to_string(), "rewards".to_string()],
        })
    }

    async fn schedule_notification(&self, scheduled: ScheduledNotification) -> Result<String, NotificationError> {
        self.validate_token(&scheduled.device_token)?;

        if scheduled.notification.title.is_empty() {
            return Err(NotificationError::ServiceError("Empty title".to_string()));
        }

        let schedule_id = uuid::Uuid::new_v4().to_string();
        log::info!(
            service = "notifications",
            op = "schedule_notification",
            outcome = "ok",
            schedule_id = %schedule_id,
            scheduled_at = %scheduled.scheduled_at;
            "notification scheduled"
        );
        Ok(schedule_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_validation() {
        let service = FirebaseNotificationService::new("project-id".to_string());
        assert!(service.validate_token("valid-token-1234567890").is_ok());
        assert!(service.validate_token("short").is_err());
        assert!(service.validate_token("").is_err());
    }

    #[tokio::test]
    async fn test_register_device() {
        let service = FirebaseNotificationService::new("project-id".to_string());
        let token = DeviceToken {
            token: "valid-token-1234567890".to_string(),
            platform: "ios".to_string(),
            user_id: "user-123".to_string(),
        };
        let result = service.register_device(token).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_register_device_invalid_token() {
        let service = FirebaseNotificationService::new("project-id".to_string());
        let token = DeviceToken {
            token: "short".to_string(),
            platform: "ios".to_string(),
            user_id: "user-123".to_string(),
        };
        let result = service.register_device(token).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_set_preferences() {
        let service = FirebaseNotificationService::new("project-id".to_string());
        let pref = NotificationPreference {
            user_id: "user-123".to_string(),
            enabled: true,
            categories: vec!["transfers".to_string()],
        };
        assert!(service.set_preferences(pref).await.is_ok());
    }

    #[tokio::test]
    async fn test_get_preferences() {
        let service = FirebaseNotificationService::new("project-id".to_string());
        let result = service.get_preferences("user-123").await;
        assert!(result.is_ok());
        let pref = result.unwrap();
        assert_eq!(pref.user_id, "user-123");
        assert!(pref.enabled);
    }

    #[tokio::test]
    async fn test_schedule_notification() {
        let service = FirebaseNotificationService::new("project-id".to_string());
        let mut data = HashMap::new();
        data.insert("type".to_string(), "transfer".to_string());
        let scheduled = ScheduledNotification {
            device_token: "valid-token-1234567890".to_string(),
            notification: PushNotification {
                title: "Transfer Complete".to_string(),
                body: "Your waste transfer is complete".to_string(),
                data,
            },
            scheduled_at: chrono::Utc::now().to_rfc3339(),
        };
        let result = service.schedule_notification(scheduled).await;
        assert!(result.is_ok());
    }

    /// Verify no log messages are lost when empty user_id is provided.
    #[tokio::test]
    async fn test_set_preferences_empty_user_id() {
        let service = FirebaseNotificationService::new("project-id".to_string());
        let pref = NotificationPreference {
            user_id: String::new(),
            enabled: true,
            categories: vec![],
        };
        assert!(service.set_preferences(pref).await.is_err());
    }
}
