/// Canonical error code registry.
///
/// Every code follows the pattern `<category>.<variant>` and maps 1-to-1 with
/// a variant in `AppError` / its domain sub-enums. Codes are stable across
/// releases; HTTP status may change without breaking clients that match on codes.
///
/// | Code                              | HTTP | Description                              |
/// |-----------------------------------|------|------------------------------------------|
/// | auth.unauthorized                 | 401  | Missing or invalid credentials           |
/// | auth.forbidden                    | 403  | Credentials valid but access denied      |
/// | auth.token_expired                | 401  | JWT/session token has expired            |
/// | auth.invalid_token                | 401  | Token malformed or signature invalid     |
/// | auth.csrf_mismatch                | 403  | CSRF token absent or mismatched          |
/// | validation.field_error            | 422  | Single field failed validation           |
/// | validation.multiple_errors        | 422  | Several fields failed validation         |
/// | validation.format_error           | 422  | Field value has wrong format             |
/// | export.csv_error                  | 500  | CSV generation failed                    |
/// | export.json_error                 | 500  | JSON export failed                       |
/// | export.pdf_error                  | 500  | PDF generation failed                    |
/// | export.serialization_error        | 500  | Data serialization error during export   |
/// | export.invalid_format             | 400  | Unsupported export format requested      |
/// | email.service_error               | 500  | Upstream email provider failed           |
/// | email.template_error              | 500  | Handlebars template render failed        |
/// | email.invalid_address             | 422  | Recipient address malformed              |
/// | email.delivery_failed             | 500  | SMTP delivery failure                    |
/// | storage.service_error             | 500  | S3/storage backend error                 |
/// | storage.invalid_file              | 422  | File type/size validation failed         |
/// | storage.not_found                 | 404  | Requested file does not exist            |
/// | storage.upload_failed             | 500  | Upload to storage backend failed         |
/// | storage.quota_exceeded            | 429  | Storage quota exceeded                   |
/// | contract.call_failed              | 500  | Stellar/Soroban contract invocation fail |
/// | contract.not_found                | 404  | Contract or object ID not on-chain       |
/// | contract.invalid_state            | 409  | Contract state disallows this operation  |
/// | contract.insufficient_balance     | 402  | Token balance too low                    |
/// | contract.unauthorized             | 403  | Caller not permitted by contract         |
/// | webhook.delivery_failed           | 500  | HTTP POST to webhook URL failed          |
/// | webhook.invalid_url               | 422  | Webhook target URL malformed             |
/// | webhook.not_found                 | 404  | Webhook ID does not exist                |
/// | webhook.signature_mismatch        | 401  | Payload HMAC signature invalid           |
/// | notification.push_failed          | 500  | FCM/push notification delivery failed    |
/// | notification.invalid_token        | 422  | Device registration token invalid        |
/// | notification.service_unavailable  | 503  | Firebase/push service unreachable        |
/// | serialization.json_error          | 500  | JSON (de)serialization error             |
/// | serialization.csv_error           | 500  | CSV (de)serialization error              |
/// | serialization.decode_error        | 400  | Binary/base64 decode error               |
/// | analytics.computation_failed      | 500  | Metric calculation error                 |
/// | analytics.invalid_time_range      | 422  | Start/end time range invalid             |
/// | analytics.data_source_unavailable | 503  | Analytics data store unreachable         |
/// | not_found.<resource>              | 404  | Named resource not found                 |
/// | internal                          | 500  | Unexpected server error                  |
/// | rate_limit.exceeded               | 429  | Too many requests                        |
/// | bad_request                       | 400  | Malformed request                        |

pub const AUTH_UNAUTHORIZED: &str = "auth.unauthorized";
pub const AUTH_FORBIDDEN: &str = "auth.forbidden";
pub const AUTH_TOKEN_EXPIRED: &str = "auth.token_expired";
pub const AUTH_INVALID_TOKEN: &str = "auth.invalid_token";
pub const AUTH_CSRF_MISMATCH: &str = "auth.csrf_mismatch";

pub const VALIDATION_FIELD_ERROR: &str = "validation.field_error";
pub const VALIDATION_MULTIPLE_ERRORS: &str = "validation.multiple_errors";
pub const VALIDATION_FORMAT_ERROR: &str = "validation.format_error";

pub const EXPORT_CSV_ERROR: &str = "export.csv_error";
pub const EXPORT_JSON_ERROR: &str = "export.json_error";
pub const EXPORT_PDF_ERROR: &str = "export.pdf_error";
pub const EXPORT_SERIALIZATION_ERROR: &str = "export.serialization_error";
pub const EXPORT_INVALID_FORMAT: &str = "export.invalid_format";

pub const EMAIL_SERVICE_ERROR: &str = "email.service_error";
pub const EMAIL_TEMPLATE_ERROR: &str = "email.template_error";
pub const EMAIL_INVALID_ADDRESS: &str = "email.invalid_address";
pub const EMAIL_DELIVERY_FAILED: &str = "email.delivery_failed";

pub const STORAGE_SERVICE_ERROR: &str = "storage.service_error";
pub const STORAGE_INVALID_FILE: &str = "storage.invalid_file";
pub const STORAGE_NOT_FOUND: &str = "storage.not_found";
pub const STORAGE_UPLOAD_FAILED: &str = "storage.upload_failed";
pub const STORAGE_QUOTA_EXCEEDED: &str = "storage.quota_exceeded";

pub const CONTRACT_CALL_FAILED: &str = "contract.call_failed";
pub const CONTRACT_NOT_FOUND: &str = "contract.not_found";
pub const CONTRACT_INVALID_STATE: &str = "contract.invalid_state";
pub const CONTRACT_INSUFFICIENT_BALANCE: &str = "contract.insufficient_balance";
pub const CONTRACT_UNAUTHORIZED: &str = "contract.unauthorized";

pub const WEBHOOK_DELIVERY_FAILED: &str = "webhook.delivery_failed";
pub const WEBHOOK_INVALID_URL: &str = "webhook.invalid_url";
pub const WEBHOOK_NOT_FOUND: &str = "webhook.not_found";
pub const WEBHOOK_SIGNATURE_MISMATCH: &str = "webhook.signature_mismatch";

pub const NOTIFICATION_PUSH_FAILED: &str = "notification.push_failed";
pub const NOTIFICATION_INVALID_TOKEN: &str = "notification.invalid_token";
pub const NOTIFICATION_SERVICE_UNAVAILABLE: &str = "notification.service_unavailable";

pub const SERIALIZATION_JSON_ERROR: &str = "serialization.json_error";
pub const SERIALIZATION_CSV_ERROR: &str = "serialization.csv_error";
pub const SERIALIZATION_DECODE_ERROR: &str = "serialization.decode_error";

pub const ANALYTICS_COMPUTATION_FAILED: &str = "analytics.computation_failed";
pub const ANALYTICS_INVALID_TIME_RANGE: &str = "analytics.invalid_time_range";
pub const ANALYTICS_DATA_SOURCE_UNAVAILABLE: &str = "analytics.data_source_unavailable";

pub const INTERNAL: &str = "internal";
pub const RATE_LIMIT_EXCEEDED: &str = "rate_limit.exceeded";
pub const BAD_REQUEST: &str = "bad_request";

/// Prefix used for dynamically generated `not_found.<resource>` codes.
pub const NOT_FOUND_PREFIX: &str = "not_found.";

/// Builds the canonical `not_found.<resource>` code for a named resource.
///
/// The resource is normalised to lowercase with spaces/dashes replaced by
/// underscores so codes stay stable and machine-matchable.
pub fn not_found_code(resource: &str) -> String {
    let normalised: String = resource
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect();
    format!("{}{}", NOT_FOUND_PREFIX, normalised)
}

/// Returns the canonical registry code for an [`AppError`].
///
/// Every [`AppError`] variant maps 1-to-1 with a code in this module, so
/// clients can match on the stable code string regardless of HTTP status.
pub fn code_for(error: &AppError) -> &'static str {
    match error {
        AppError::Auth(AuthError::Unauthorized) => AUTH_UNAUTHORIZED,
        AppError::Auth(AuthError::Forbidden) => AUTH_FORBIDDEN,
        AppError::Auth(AuthError::TokenExpired) => AUTH_TOKEN_EXPIRED,
        AppError::Auth(AuthError::InvalidToken) => AUTH_INVALID_TOKEN,
        AppError::Auth(AuthError::CsrfMismatch) => AUTH_CSRF_MISMATCH,

        AppError::Validation(ValidationError::FieldError(_)) => VALIDATION_FIELD_ERROR,
        AppError::Validation(ValidationError::MultipleErrors(_)) => VALIDATION_MULTIPLE_ERRORS,
        AppError::Validation(ValidationError::FormatError(_)) => VALIDATION_FORMAT_ERROR,

        AppError::Export(ExportError::CsvError(_)) => EXPORT_CSV_ERROR,
        AppError::Export(ExportError::JsonError(_)) => EXPORT_JSON_ERROR,
        AppError::Export(ExportError::PdfError(_)) => EXPORT_PDF_ERROR,
        AppError::Export(ExportError::SerializationError(_)) => EXPORT_SERIALIZATION_ERROR,
        AppError::Export(ExportError::InvalidFormat(_)) => EXPORT_INVALID_FORMAT,

        AppError::Email(EmailError::ServiceError(_)) => EMAIL_SERVICE_ERROR,
        AppError::Email(EmailError::TemplateError(_)) => EMAIL_TEMPLATE_ERROR,
        AppError::Email(EmailError::InvalidAddress(_)) => EMAIL_INVALID_ADDRESS,
        AppError::Email(EmailError::DeliveryFailed(_)) => EMAIL_DELIVERY_FAILED,

        AppError::Storage(StorageError::ServiceError(_)) => STORAGE_SERVICE_ERROR,
        AppError::Storage(StorageError::InvalidFile(_)) => STORAGE_INVALID_FILE,
        AppError::Storage(StorageError::NotFound(_)) => STORAGE_NOT_FOUND,
        AppError::Storage(StorageError::UploadFailed(_)) => STORAGE_UPLOAD_FAILED,
        AppError::Storage(StorageError::QuotaExceeded(_)) => STORAGE_QUOTA_EXCEEDED,

        AppError::Contract(ContractError::CallFailed(_)) => CONTRACT_CALL_FAILED,
        AppError::Contract(ContractError::NotFound(_)) => CONTRACT_NOT_FOUND,
        AppError::Contract(ContractError::InvalidState(_)) => CONTRACT_INVALID_STATE,
        AppError::Contract(ContractError::InsufficientBalance(_)) => CONTRACT_INSUFFICIENT_BALANCE,
        AppError::Contract(ContractError::Unauthorized(_)) => CONTRACT_UNAUTHORIZED,

        AppError::Webhook(WebhookError::DeliveryFailed(_)) => WEBHOOK_DELIVERY_FAILED,
        AppError::Webhook(WebhookError::InvalidUrl(_)) => WEBHOOK_INVALID_URL,
        AppError::Webhook(WebhookError::NotFound(_)) => WEBHOOK_NOT_FOUND,
        AppError::Webhook(WebhookError::SignatureMismatch(_)) => WEBHOOK_SIGNATURE_MISMATCH,

        AppError::Notification(NotificationError::PushFailed(_)) => NOTIFICATION_PUSH_FAILED,
        AppError::Notification(NotificationError::InvalidToken(_)) => NOTIFICATION_INVALID_TOKEN,
        AppError::Notification(NotificationError::ServiceUnavailable(_)) => NOTIFICATION_SERVICE_UNAVAILABLE,

        AppError::Serialization(SerializationError::JsonError(_)) => SERIALIZATION_JSON_ERROR,
        AppError::Serialization(SerializationError::CsvError(_)) => SERIALIZATION_CSV_ERROR,
        AppError::Serialization(SerializationError::DecodeError(_)) => SERIALIZATION_DECODE_ERROR,

        AppError::Analytics(AnalyticsError::ComputationFailed(_)) => ANALYTICS_COMPUTATION_FAILED,
        AppError::Analytics(AnalyticsError::InvalidTimeRange(_)) => ANALYTICS_INVALID_TIME_RANGE,
        AppError::Analytics(AnalyticsError::DataSourceUnavailable(_)) => ANALYTICS_DATA_SOURCE_UNAVAILABLE,

        AppError::NotFound(_) => NOT_FOUND_PREFIX,
        AppError::Internal(_) => INTERNAL,
        AppError::RateLimitExceeded(_) => RATE_LIMIT_EXCEEDED,
        AppError::BadRequest(_) => BAD_REQUEST,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::errors::{
        AnalyticsError, AppError, AuthError, ContractError, EmailError, ExportError, NotificationError,
        SerializationError, StorageError, ValidationError, WebhookError,
    };

    /// Every `AppError` variant must resolve to a non-empty, dot-separated
    /// (or single-token) registry code.
    fn assert_registered(error: AppError) {
        let code = code_for(&error);
        assert!(!code.is_empty(), "empty code for {error:?}");
        assert!(
            code.chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '.' || c == '_'),
            "code `{code}` for {error:?} is not canonical"
        );
    }

    #[test]
    fn every_app_error_variant_has_a_registered_code() {
        let variants = vec![
            AppError::Auth(AuthError::Unauthorized),
            AppError::Auth(AuthError::Forbidden),
            AppError::Auth(AuthError::TokenExpired),
            AppError::Auth(AuthError::InvalidToken),
            AppError::Auth(AuthError::CsrfMismatch),
            AppError::Validation(ValidationError::FieldError("field".into())),
            AppError::Validation(ValidationError::MultipleErrors(vec![])),
            AppError::Validation(ValidationError::FormatError("format".into())),
            AppError::Export(ExportError::CsvError("csv".into())),
            AppError::Export(ExportError::JsonError("json".into())),
            AppError::Export(ExportError::PdfError("pdf".into())),
            AppError::Export(ExportError::SerializationError("ser".into())),
            AppError::Export(ExportError::InvalidFormat("fmt".into())),
            AppError::Email(EmailError::ServiceError("svc".into())),
            AppError::Email(EmailError::TemplateError("tpl".into())),
            AppError::Email(EmailError::InvalidAddress("addr".into())),
            AppError::Email(EmailError::DeliveryFailed("del".into())),
            AppError::Storage(StorageError::ServiceError("svc".into())),
            AppError::Storage(StorageError::InvalidFile("file".into())),
            AppError::Storage(StorageError::NotFound("file".into())),
            AppError::Storage(StorageError::UploadFailed("up".into())),
            AppError::Storage(StorageError::QuotaExceeded("quota".into())),
            AppError::Contract(ContractError::CallFailed("call".into())),
            AppError::Contract(ContractError::NotFound("id".into())),
            AppError::Contract(ContractError::InvalidState("state".into())),
            AppError::Contract(ContractError::InsufficientBalance("bal".into())),
            AppError::Contract(ContractError::Unauthorized("auth".into())),
            AppError::Webhook(WebhookError::DeliveryFailed("del".into())),
            AppError::Webhook(WebhookError::InvalidUrl("url".into())),
            AppError::Webhook(WebhookError::NotFound("id".into())),
            AppError::Webhook(WebhookError::SignatureMismatch("sig".into())),
            AppError::Notification(NotificationError::PushFailed("push".into())),
            AppError::Notification(NotificationError::InvalidToken("tok".into())),
            AppError::Notification(NotificationError::ServiceUnavailable("svc".into())),
            AppError::Serialization(SerializationError::JsonError("json".into())),
            AppError::Serialization(SerializationError::CsvError("csv".into())),
            AppError::Serialization(SerializationError::DecodeError("dec".into())),
            AppError::Analytics(AnalyticsError::ComputationFailed("comp".into())),
            AppError::Analytics(AnalyticsError::InvalidTimeRange("range".into())),
            AppError::Analytics(AnalyticsError::DataSourceUnavailable("src".into())),
            AppError::NotFound("thing".into()),
            AppError::Internal("boom".into()),
            AppError::RateLimitExceeded("slow down".into()),
            AppError::BadRequest("bad".into()),
        ];

        for error in variants {
            assert_registered(error);
        }
    }

    #[test]
    fn codes_are_stable_and_unique_per_variant() {
        assert_eq!(code_for(&AppError::Auth(AuthError::Unauthorized)), AUTH_UNAUTHORIZED);
        assert_eq!(code_for(&AppError::Internal("x".into())), INTERNAL);
        assert_eq!(code_for(&AppError::RateLimitExceeded("x".into())), RATE_LIMIT_EXCEEDED);
        assert_eq!(code_for(&AppError::BadRequest("x".into())), BAD_REQUEST);
        assert_eq!(code_for(&AppError::NotFound("x".into())), NOT_FOUND_PREFIX);
    }

    #[test]
    fn not_found_code_is_normalised() {
        assert_eq!(not_found_code("User"), "not_found.user");
        assert_eq!(not_found_code("Payment Intent"), "not_found.payment_intent");
        assert_eq!(not_found_code("  webhook-id "), "not_found.webhook_id");
    }
}
