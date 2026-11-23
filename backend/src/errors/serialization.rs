use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::types::{AppError, FieldError, ValidationError};
use crate::services::api::{ApiErrorPayload, ApiResponse, FieldDetail, ResponseMeta};

/// Wire format sent to API clients for every error response.
///
/// #918: `ErrorResponse` now wraps an `ApiErrorPayload` so that error responses
/// share the same `{data, error, meta}` envelope as success responses.
#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    /// Always `None` for error responses; kept for envelope symmetry.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    pub error: ErrorBody,
    pub meta: ResponseMeta,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorBody {
    /// Stable dot-separated code, e.g. `validation.field_error`
    pub code: String,
    /// Human-readable message
    pub message: String,
    /// HTTP status (mirrored for clients that can't read status lines)
    pub status: u16,
    /// Category for structured handling, e.g. `validation`
    pub category: String,
    /// Present only for validation errors — per-field detail
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fields: Option<Vec<FieldError>>,
}

impl ErrorResponse {
    /// Build the unified envelope from an `AppError`.
    pub fn from_app_error(err: &AppError) -> Self {
        ErrorResponse {
            data: None,
            error: ErrorBody {
                code: err.code(),
                message: err.to_string(),
                status: err.status_code(),
                category: err.category().to_string(),
                fields: validation_fields(err),
            },
            meta: ResponseMeta::new(),
        }
    }
}

impl AppError {
    /// Serialise to the canonical JSON wire format.
    ///
    /// #918: Returns the full `{data, error, meta}` envelope.
    pub fn to_response_body(&self) -> ApiResponse<()> {
        let fields = validation_fields(self).map(|fs| {
            fs.into_iter()
                .map(|f| FieldDetail {
                    field: f.field,
                    message: f.message,
                })
                .collect::<Vec<_>>()
        });

        ApiResponse {
            data: None,
            error: Some(ApiErrorPayload {
                code: self.code(),
                message: self.to_string(),
                status: self.status_code(),
                fields,
            }),
            meta: ResponseMeta::new(),
        }
    }

    /// Serialise directly to `serde_json::Value` for embedding in larger responses.
    pub fn to_json(&self) -> Value {
        json!(self.to_response_body())
    }

    /// Serialise to the unified `ErrorResponse` envelope.
    pub fn to_error_response(&self) -> ErrorResponse {
        ErrorResponse::from_app_error(self)
    }
}

fn validation_fields(e: &AppError) -> Option<Vec<FieldError>> {
    match e {
        AppError::Validation(ValidationError::Multiple(fields)) => Some(fields.clone()),
        AppError::Validation(ValidationError::Field { field, message }) => Some(vec![FieldError {
            field: field.clone(),
            message: message.clone(),
        }]),
        _ => None,
    }
}

// ── Actix-web ResponseError ───────────────────────────────────────────────────

use actix_web::{HttpResponse, ResponseError};

impl ResponseError for AppError {
    fn status_code(&self) -> actix_web::http::StatusCode {
        actix_web::http::StatusCode::from_u16(AppError::status_code(self))
            .unwrap_or(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR)
    }

    fn error_response(&self) -> HttpResponse {
        let status = ResponseError::status_code(self);
        HttpResponse::build(status).json(self.to_response_body())
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::errors::types::AppError;

    fn envelope(err: &AppError) -> Value {
        serde_json::to_value(err.to_response_body()).expect("serialize envelope")
    }

    #[test]
    fn validation_field_error_serializes_fields() {
        let err = AppError::validation_field("email", "must be a valid email");
        let v = envelope(&err);
        let error = &v["error"];
        assert_eq!(error["code"], err.code());
        assert_eq!(error["status"], err.status_code());
        assert_eq!(error["category"], "validation");
        let fields = error["fields"].as_array().expect("fields present");
        assert_eq!(fields.len(), 1);
        assert_eq!(fields[0]["field"], "email");
        assert_eq!(fields[0]["message"], "must be a valid email");
        assert!(v.get("data").is_some());
        assert!(v.get("meta").is_some());
    }

    #[test]
    fn validation_multiple_serializes_all_fields() {
        let err = AppError::validation_multiple(vec![
            FieldError {
                field: "a".into(),
                message: "bad a".into(),
            },
            FieldError {
                field: "b".into(),
                message: "bad b".into(),
            },
        ]);
        let v = envelope(&err);
        let fields = v["error"]["fields"].as_array().expect("fields present");
        assert_eq!(fields.len(), 2);
    }

    #[test]
    fn non_validation_errors_omit_fields() {
        let err = AppError::not_found("widget");
        let v = envelope(&err);
        assert!(v["error"].get("fields").is_none());
        assert_eq!(v["error"]["category"], "not_found");
    }

    #[test]
    fn error_response_envelope_matches_body() {
        let err = AppError::internal("boom");
        let resp = err.to_error_response();
        assert!(resp.data.is_none());
        assert_eq!(resp.error.code, err.code());
        assert_eq!(resp.error.status, err.status_code());
        assert_eq!(resp.error.category, err.category());
        assert!(resp.error.fields.is_none());
    }

    #[test]
    fn error_response_roundtrips_through_json() {
        let err = AppError::validation_field("name", "required");
        let resp = err.to_error_response();
        let json = serde_json::to_value(&resp).expect("serialize");
        let back: ErrorResponse = serde_json::from_value(json).expect("deserialize");
        assert_eq!(back.error.code, resp.error.code);
        assert_eq!(back.error.status, resp.error.status);
        assert_eq!(back.error.category, resp.error.category);
    }

    #[test]
    fn status_mapping_is_preserved() {
        let err = AppError::unauthorized("nope");
        assert_eq!(ResponseError::status_code(&err).as_u16(), AppError::status_code(&err));
    }
}
