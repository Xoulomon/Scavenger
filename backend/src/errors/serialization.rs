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
    pub error: ErrorBody,
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
