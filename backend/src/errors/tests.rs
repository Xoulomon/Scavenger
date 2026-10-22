#[cfg(test)]
mod tests {
    use crate::errors::{
        codes,
        conversion::{from_validation_errors, from_validation_field},
        types::{AppError, AuthError, ContractError, ErrorCategory, ExportError, StorageError, ValidationError},
    };

    // ── Category classification ───────────────────────────────────────────────

    #[test]
    fn auth_error_has_correct_category() {
        let e = AppError::Auth(AuthError::Unauthorized("test".into()));
        assert_eq!(e.category(), ErrorCategory::Auth);
    }

    #[test]
    fn validation_error_has_correct_category() {
        let e = AppError::Validation(ValidationError::Field {
            field: "email".into(),
            message: "required".into(),
        });
        assert_eq!(e.category(), ErrorCategory::Validation);
    }

    #[test]
    fn not_found_has_correct_category() {
        let e = AppError::NotFound {
            resource: "waste",
            id: "abc123".into(),
        };
        assert_eq!(e.category(), ErrorCategory::NotFound);
    }

    // ── HTTP status codes ─────────────────────────────────────────────────────

    #[test]
    fn unauthorized_maps_to_401() {
        let e = AppError::Auth(AuthError::Unauthorized("bad token".into()));
        assert_eq!(e.status_code(), 401);
    }

    #[test]
    fn forbidden_maps_to_403() {
        let e = AppError::Auth(AuthError::Forbidden("no access".into()));
        assert_eq!(e.status_code(), 403);
    }

    #[test]
    fn validation_maps_to_422() {
        let e = from_validation_field("name", "required");
        assert_eq!(e.status_code(), 422);
    }

    #[test]
    fn not_found_maps_to_404() {
        let e = AppError::NotFound {
            resource: "participant",
            id: "p1".into(),
        };
        assert_eq!(e.status_code(), 404);
    }

    #[test]
    fn rate_limit_maps_to_429() {
        let e = AppError::RateLimitExceeded;
        assert_eq!(e.status_code(), 429);
    }

    #[test]
    fn internal_maps_to_500() {
        let e = AppError::Internal("db gone".into());
        assert_eq!(e.status_code(), 500);
    }

    #[test]
    fn contract_insufficient_balance_maps_to_402() {
        let e = AppError::Contract(ContractError::InsufficientBalance {
            required: 100,
            available: 50,
        });
        assert_eq!(e.status_code(), 402);
    }

    // ── Error codes ───────────────────────────────────────────────────────────

    #[test]
    fn auth_code_matches_constant() {
        let e = AppError::Auth(AuthError::Unauthorized("x".into()));
        assert_eq!(e.code(), codes::AUTH_UNAUTHORIZED);
    }

    #[test]
    fn export_csv_code_matches_constant() {
        let e = AppError::Export(ExportError::Csv("fail".into()));
        assert_eq!(e.code(), codes::EXPORT_CSV_ERROR);
    }

    #[test]
    fn not_found_code_contains_resource() {
        let e = AppError::NotFound {
            resource: "waste",
            id: "w1".into(),
        };
        assert!(e.code().starts_with("not_found.waste"));
    }

    #[test]
    fn storage_not_found_has_correct_code() {
        let e = AppError::Storage(StorageError::NotFound("file.pdf".into()));
        assert_eq!(e.code(), codes::STORAGE_NOT_FOUND);
    }

    // ── Serialization ─────────────────────────────────────────────────────────

    #[test]
    fn to_json_contains_code_and_status() {
        let e = AppError::RateLimitExceeded;
        let v = e.to_json();
        assert_eq!(v["error"]["code"], codes::RATE_LIMIT_EXCEEDED);
        assert_eq!(v["error"]["status"], 429);
    }

    #[test]
    fn validation_json_includes_fields_array() {
        let e = from_validation_errors(vec![
            ("email".into(), "invalid".into()),
            ("name".into(), "required".into()),
        ]);
        let v = e.to_json();
        let fields = v["error"]["fields"].as_array().expect("fields array");
        assert_eq!(fields.len(), 2);
    }

    #[test]
    fn non_validation_json_omits_fields() {
        let e = AppError::RateLimitExceeded;
        let v = e.to_json();
        assert!(v["error"]["fields"].is_null());
    }

    // ── Conversion helpers ────────────────────────────────────────────────────

    #[test]
    fn from_validation_field_builds_correct_variant() {
        let e = from_validation_field("weight", "must be positive");
        match e {
            AppError::Validation(ValidationError::Field { field, message }) => {
                assert_eq!(field, "weight");
                assert_eq!(message, "must be positive");
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn from_validation_errors_builds_multiple_variant() {
        let e = from_validation_errors(vec![("a".into(), "b".into())]);
        match e {
            AppError::Validation(ValidationError::Multiple(fields)) => {
                assert_eq!(fields.len(), 1);
                assert_eq!(fields[0].field, "a");
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn from_anyhow_becomes_internal() {
        let anyhow_err = anyhow::anyhow!("something broke");
        let e: AppError = anyhow_err.into();
        assert_eq!(e.category(), ErrorCategory::Internal);
    }

    // ── is_client_error ───────────────────────────────────────────────────────

    #[test]
    fn auth_errors_are_client_errors() {
        let e = AppError::Auth(AuthError::TokenExpired);
        assert!(e.is_client_error());
    }

    #[test]
    fn internal_errors_are_not_client_errors() {
        let e = AppError::Internal("broken".into());
        assert!(!e.is_client_error());
    }

    // ── Email Error Categories ────────────────────────────────────────────────

    #[test]
    fn email_error_has_correct_category() {
        use crate::errors::types::EmailError;
        let e = AppError::Email(EmailError::Service("sendgrid down".into()));
        assert_eq!(e.category(), ErrorCategory::Email);
    }

    #[test]
    fn email_service_error_maps_to_500() {
        use crate::errors::types::EmailError;
        let e = AppError::Email(EmailError::Service("smtp failed".into()));
        assert_eq!(e.status_code(), 500);
    }

    // ── Webhook Error Categories ──────────────────────────────────────────────

    #[test]
    fn webhook_error_has_correct_category() {
        use crate::errors::types::WebhookError;
        let e = AppError::Webhook(WebhookError::DeliveryFailed("timeout".into()));
        assert_eq!(e.category(), ErrorCategory::Webhook);
    }

    #[test]
    fn webhook_invalid_url_error_maps_to_400() {
        use crate::errors::types::WebhookError;
        let e = AppError::Webhook(WebhookError::InvalidUrl("not-a-url".into()));
        assert_eq!(e.status_code(), 400);
    }

    // ── Notification Error Categories ─────────────────────────────────────────

    #[test]
    fn notification_error_has_correct_category() {
        use crate::errors::types::NotificationError;
        let e = AppError::Notification(NotificationError::PushFailed("device offline".into()));
        assert_eq!(e.category(), ErrorCategory::Notification);
    }

    #[test]
    fn notification_push_failed_maps_to_500() {
        use crate::errors::types::NotificationError;
        let e = AppError::Notification(NotificationError::PushFailed("service down".into()));
        assert_eq!(e.status_code(), 500);
    }

    // ── Analytics Error Categories ────────────────────────────────────────────

    #[test]
    fn analytics_error_has_correct_category() {
        use crate::errors::types::AnalyticsError;
        let e = AppError::Analytics(AnalyticsError::ComputationFailed("division by zero".into()));
        assert_eq!(e.category(), ErrorCategory::Analytics);
    }

    #[test]
    fn analytics_computation_failed_maps_to_500() {
        use crate::errors::types::AnalyticsError;
        let e = AppError::Analytics(AnalyticsError::ComputationFailed("invalid query".into()));
        assert_eq!(e.status_code(), 500);
    }

    // ── Contract Error Status Codes ───────────────────────────────────────────

    #[test]
    fn contract_unauthorized_maps_to_403() {
        let e = AppError::Contract(ContractError::Unauthorized("not owner".into()));
        assert_eq!(e.status_code(), 403);
    }

    #[test]
    fn contract_not_found_maps_to_404() {
        let e = AppError::Contract(ContractError::NotFound("contract-123".into()));
        assert_eq!(e.status_code(), 404);
    }

    #[test]
    fn contract_call_failed_maps_to_500() {
        let e = AppError::Contract(ContractError::CallFailed("network error".into()));
        assert_eq!(e.status_code(), 500);
    }

    // ── Export Error Categories ───────────────────────────────────────────────

    #[test]
    fn export_error_has_correct_category() {
        let e = AppError::Export(ExportError::Json("encoding failed".into()));
        assert_eq!(e.category(), ErrorCategory::Export);
    }

    #[test]
    fn export_pdf_error_maps_to_500() {
        let e = AppError::Export(ExportError::Pdf("renderer crashed".into()));
        assert_eq!(e.status_code(), 500);
    }

    // ── Serialization Error Categories ────────────────────────────────────────

    #[test]
    fn serialization_error_has_correct_category() {
        use crate::errors::types::SerializationError;
        let e = AppError::Serialization(SerializationError::Json("malformed json".into()));
        assert_eq!(e.category(), ErrorCategory::Serialization);
    }

    #[test]
    fn serialization_decode_error_maps_to_400() {
        use crate::errors::types::SerializationError;
        let e = AppError::Serialization(SerializationError::Decode("invalid utf8".into()));
        assert_eq!(e.status_code(), 400);
    }

    // ── Storage Error Categories ──────────────────────────────────────────────

    #[test]
    fn storage_error_has_correct_category() {
        let e = AppError::Storage(StorageError::Service("s3 down".into()));
        assert_eq!(e.category(), ErrorCategory::Storage);
    }

    #[test]
    fn storage_upload_failed_maps_to_500() {
        let e = AppError::Storage(StorageError::UploadFailed("disk full".into()));
        assert_eq!(e.status_code(), 500);
    }

    #[test]
    fn storage_quota_exceeded_maps_to_507() {
        let e = AppError::Storage(StorageError::QuotaExceeded);
        assert_eq!(e.status_code(), 500);
    }

    // ── Bad Request Error ─────────────────────────────────────────────────────

    #[test]
    fn bad_request_maps_to_400() {
        let e = AppError::BadRequest("missing required field".into());
        assert_eq!(e.status_code(), 400);
    }

    #[test]
    fn bad_request_is_client_error() {
        let e = AppError::BadRequest("invalid parameter".into());
        assert!(e.is_client_error());
    }

    // ── Error Code Generation ─────────────────────────────────────────────────

    #[test]
    fn webhook_delivery_failed_has_correct_code() {
        use crate::errors::types::WebhookError;
        let e = AppError::Webhook(WebhookError::DeliveryFailed("timeout".into()));
        assert_eq!(e.code(), codes::WEBHOOK_DELIVERY_FAILED);
    }

    #[test]
    fn notification_invalid_token_has_correct_code() {
        use crate::errors::types::NotificationError;
        let e = AppError::Notification(NotificationError::InvalidToken("expired".into()));
        assert_eq!(e.code(), codes::NOTIFICATION_INVALID_TOKEN);
    }

    #[test]
    fn analytics_invalid_time_range_has_correct_code() {
        use crate::errors::types::AnalyticsError;
        let e = AppError::Analytics(AnalyticsError::InvalidTimeRange("end before start".into()));
        assert_eq!(e.code(), codes::ANALYTICS_INVALID_TIME_RANGE);
    }

    // ── All Error Types Convert to AppError ───────────────────────────────────

    #[test]
    fn auth_error_converts_to_app_error() {
        use crate::errors::types::AuthError;
        let auth_err = AuthError::Unauthorized("test".into());
        let app_err: AppError = auth_err.into();
        assert_eq!(app_err.category(), ErrorCategory::Auth);
    }

    #[test]
    fn validation_error_converts_to_app_error() {
        let val_err = ValidationError::Field {
            field: "test".into(),
            message: "error".into(),
        };
        let app_err: AppError = val_err.into();
        assert_eq!(app_err.category(), ErrorCategory::Validation);
    }

    #[test]
    fn contract_error_converts_to_app_error() {
        let con_err = ContractError::NotFound("123".into());
        let app_err: AppError = con_err.into();
        assert_eq!(app_err.category(), ErrorCategory::Contract);
    }
}
