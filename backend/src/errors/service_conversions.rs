/// Canonical error module for the Scavenger backend (issue #1073).
///
/// Every API module **must** return `Result<_, ApiError>` from its handlers
/// so the client always receives a consistent error response shape.  This
/// module is the single source of truth — `backend/src/api/errors.rs`
/// re-exports from here so handlers can use either path.
///
/// ## Wire format
///
/// Every non-2xx response body has the shape:
///
/// ```json
/// {
///   "error": {
///     "code":       "VALIDATION_ERROR",
///     "message":    "quantity_kg must be positive",
///     "request_id": "a1b2c3d4-0000-0000-0000-000000000000"
///   }
/// }
/// ```
///
/// ### HTTP status mapping
///
/// | `ApiError` variant | HTTP status |
/// |--------------------|-------------|
/// | `Validation`       | 400         |
/// | `Unauthorized`     | 401         |
/// | `Forbidden`        | 403         |
/// | `NotFound`         | 404         |
/// | `Conflict`         | 409         |
/// | `Internal`         | 500         |
///
/// ### Propagating service errors
///
/// Each domain service has a `From<ServiceError> for ApiError` impl here.
/// Handlers use `?` and the compiler selects the right conversion:
///
/// ```rust
/// use crate::errors::ApiError;
///
/// async fn my_handler(...) -> Result<HttpResponse, ApiError> {
///     let report = reporting_service.generate_report(req).await?; // ReportError → ApiError
///     Ok(HttpResponse::Ok().json(report))
/// }
/// ```
use crate::errors::AppError;
use crate::services::{
    email::EmailError, notifications::NotificationError, reporting::ReportError, storage::StorageError,
};

// ── Service error → AppError conversions ─────────────────────────────────
//
// Service-layer errors are converted into the canonical `AppError` so that
// handlers can propagate them with `?`.  `AppError` is the single typed error
// enum; `ApiError` is a backwards-compatible alias for it, so the existing
// status/code mapping is preserved exactly.

impl From<ReportError> for AppError {
    fn from(e: ReportError) -> Self {
        match e {
            ReportError::InvalidReport(msg) => AppError::validation(msg),
            ReportError::NotFound(msg) => AppError::not_found(msg),
            ReportError::ServiceError(msg) => AppError::internal(msg),
        }
    }
}

impl From<StorageError> for AppError {
    fn from(e: StorageError) -> Self {
        match e {
            StorageError::InvalidFile(msg) => AppError::validation(msg),
            StorageError::NotFound(msg) => AppError::not_found(msg),
            StorageError::ServiceError(msg) => AppError::internal(msg),
        }
    }
}

impl From<NotificationError> for AppError {
    fn from(e: NotificationError) -> Self {
        match e {
            NotificationError::InvalidToken(msg) => AppError::validation(msg),
            NotificationError::NotFound(msg) => AppError::not_found(msg),
            NotificationError::ServiceError(msg) => AppError::internal(msg),
        }
    }
}

impl From<EmailError> for AppError {
    fn from(e: EmailError) -> Self {
        match e {
            EmailError::InvalidEmail(msg) => AppError::validation(msg),
            EmailError::TemplateError(msg) => AppError::internal(msg),
            EmailError::ServiceError(msg) => AppError::internal(msg),
        }
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::ResponseError;

    // ── HTTP status mapping ───────────────────────────────────────────────

    #[actix_web::test]
    async fn test_validation_maps_to_400() {
        let err = ApiError::validation("bad input");
        assert_eq!(err.error_response().status(), 400);
    }

    #[actix_web::test]
    async fn test_unauthorized_maps_to_401() {
        let err = ApiError::unauthorized("missing token");
        assert_eq!(err.error_response().status(), 401);
    }

    #[actix_web::test]
    async fn test_forbidden_maps_to_403() {
        let err = ApiError::forbidden("access denied");
        assert_eq!(err.error_response().status(), 403);
    }

    #[actix_web::test]
    async fn test_not_found_maps_to_404() {
        let err = ApiError::not_found("resource missing");
        assert_eq!(err.error_response().status(), 404);
    }

    #[actix_web::test]
    async fn test_conflict_maps_to_409() {
        let err = ApiError::conflict("already exists");
        assert_eq!(err.error_response().status(), 409);
    }

    #[actix_web::test]
    async fn test_internal_maps_to_500() {
        let err = ApiError::internal("db failed");
        assert_eq!(err.error_response().status(), 500);
    }

    // ── Service error conversion: ReportError ────────────────────────────

    #[test]
    fn test_report_invalid_becomes_validation() {
        let e: AppError = ReportError::InvalidReport("bad format".into()).into();
        assert_eq!(e.code(), "VALIDATION_ERROR");
        assert_eq!(e.error_response().status(), 400);
    }

    #[test]
    fn test_report_not_found_becomes_not_found() {
        let e: AppError = ReportError::NotFound("report missing".into()).into();
        assert_eq!(e.code(), "NOT_FOUND");
        assert_eq!(e.error_response().status(), 404);
    }

    #[test]
    fn test_report_service_error_becomes_internal() {
        let e: AppError = ReportError::ServiceError("db timeout".into()).into();
        assert_eq!(e.code(), "INTERNAL_SERVER_ERROR");
        assert_eq!(e.error_response().status(), 500);
    }

    // ── Service error conversion: StorageError ───────────────────────────

    #[test]
    fn test_storage_invalid_file_becomes_validation() {
        let e: AppError = StorageError::InvalidFile("empty".into()).into();
        assert_eq!(e.code(), "VALIDATION_ERROR");
        assert_eq!(e.error_response().status(), 400);
    }

    #[test]
    fn test_storage_not_found_becomes_not_found() {
        let e: AppError = StorageError::NotFound("file gone".into()).into();
        assert_eq!(e.code(), "NOT_FOUND");
        assert_eq!(e.error_response().status(), 404);
    }

    #[test]
    fn test_storage_service_error_becomes_internal() {
        let e: AppError = StorageError::ServiceError("s3 error".into()).into();
        assert_eq!(e.code(), "INTERNAL_SERVER_ERROR");
        assert_eq!(e.error_response().status(), 500);
    }

    // ── Service error conversion: NotificationError ──────────────────────

    #[test]
    fn test_notification_invalid_token_becomes_validation() {
        let e: AppError = NotificationError::InvalidToken("bad token".into()).into();
        assert_eq!(e.code(), "VALIDATION_ERROR");
        assert_eq!(e.error_response().status(), 400);
    }

    #[test]
    fn test_notification_not_found_becomes_not_found() {
        let e: AppError = NotificationError::NotFound("device gone".into()).into();
        assert_eq!(e.code(), "NOT_FOUND");
        assert_eq!(e.error_response().status(), 404);
    }

    #[test]
    fn test_notification_service_error_becomes_internal() {
        let e: AppError = NotificationError::ServiceError("fcm error".into()).into();
        assert_eq!(e.code(), "INTERNAL_SERVER_ERROR");
        assert_eq!(e.error_response().status(), 500);
    }

    // ── Service error conversion: EmailError ─────────────────────────────

    #[test]
    fn test_email_invalid_becomes_validation() {
        let e: AppError = EmailError::InvalidEmail("notanemail".into()).into();
        assert_eq!(e.code(), "VALIDATION_ERROR");
        assert_eq!(e.error_response().status(), 400);
    }

    #[test]
    fn test_email_template_error_becomes_internal() {
        let e: AppError = EmailError::TemplateError("template missing".into()).into();
        assert_eq!(e.code(), "INTERNAL_SERVER_ERROR");
        assert_eq!(e.error_response().status(), 500);
    }

    #[test]
    fn test_email_service_error_becomes_internal() {
        let e: AppError = EmailError::ServiceError("sendgrid down".into()).into();
        assert_eq!(e.code(), "INTERNAL_SERVER_ERROR");
        assert_eq!(e.error_response().status(), 500);
    }

    // ── Service errors convert into the canonical AppError type ──────────

    #[test]
    fn test_service_errors_convert_to_app_error() {
        // Compile-time proof that each service error implements Into<AppError>.
        fn assert_into_app_error<E: Into<AppError>>() {}
        assert_into_app_error::<ReportError>();
        assert_into_app_error::<StorageError>();
        assert_into_app_error::<NotificationError>();
        assert_into_app_error::<EmailError>();
    }

    // ── Wire-format shape consistency ────────────────────────────────────
    //
    // These tests assert the *exact* JSON structure that a client receives
    // so any future change to the error serialisation is caught here.

    #[actix_web::test]
    async fn test_error_body_has_error_key_with_code_message_request_id() {
        use actix_web::body::MessageBody;

        let err = ApiError::validation("quantity_kg must be positive");
        let resp = err.error_response();
        assert_eq!(resp.status(), 400);

        let body_bytes = resp.into_body().try_into_bytes().expect("body is finite");
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).expect("valid JSON");

        // Top-level shape: { "error": { ... } }
        assert!(json.get("error").is_some(), "response must have 'error' key");
        let error_obj = &json["error"];

        // Required sub-fields
        assert!(error_obj.get("code").is_some(), "error.code is required");
        assert!(error_obj.get("message").is_some(), "error.message is required");
        assert!(error_obj.get("request_id").is_some(), "error.request_id is required");

        // Values
        assert_eq!(error_obj["code"], "VALIDATION_ERROR");
        assert_eq!(error_obj["message"], "quantity_kg must be positive");
        assert!(!error_obj["request_id"].as_str().unwrap_or("").is_empty());
    }

    #[actix_web::test]
    async fn test_all_variants_share_same_shape() {
        use actix_web::body::MessageBody;

        let errors: Vec<ApiError> = vec![
            ApiError::validation("v"),
            ApiError::unauthorized("u"),
            ApiError::forbidden("f"),
            ApiError::not_found("n"),
            ApiError::conflict("c"),
            ApiError::internal("i"),
        ];

        for err in errors {
            let code = err.code().to_string();
            let resp = err.error_response();
            let body_bytes = resp.into_body().try_into_bytes().expect("body is finite");
            let json: serde_json::Value = serde_json::from_slice(&body_bytes).expect("valid JSON");

            // Every variant must use the same { error: { code, message, request_id } } envelope.
            assert!(json.get("error").is_some(), "variant {} missing 'error' key", code);
            let obj = &json["error"];
            assert!(obj.get("code").is_some(), "variant {} missing code", code);
            assert!(obj.get("message").is_some(), "variant {} missing message", code);
            assert!(obj.get("request_id").is_some(), "variant {} missing request_id", code);
        }
    }

    #[actix_web::test]
    async fn test_no_extra_top_level_keys_in_error_response() {
        use actix_web::body::MessageBody;

        let err = ApiError::not_found("widget not found");
        let resp = err.error_response();
        let body_bytes = resp.into_body().try_into_bytes().unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();

        // Only the "error" key should be at top level — no "data", "status", etc.
        let keys: Vec<&str> = json.as_object().unwrap().keys().map(String::as_str).collect();
        assert_eq!(keys, vec!["error"], "unexpected top-level keys: {:?}", keys);
    }
}
