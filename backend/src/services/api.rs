// #918 — Standardized API response envelope
//
// Every endpoint MUST return one of:
//   - `ApiResponse<T>` via `ApiBuilder::success_response(data)`
//   - `ApiResponse<()>` via `ApiBuilder::error_response_typed(code, message, status)`
//
// Wire format:
// ```json
// {
//   "data":  <T | null>,
//   "error": { "code": "...", "message": "...", "status": 400 } | null,
//   "meta":  { "timestamp": 1234567890, "version": "1.0", "request_id": "..." }
// }
// ```
//
// Rules:
//   - On success:  `data` is the payload,   `error` is `null`.
//   - On failure:  `data` is `null`,         `error` is populated.
//   - `meta` is always present.
//   - Pagination metadata (total, page, limit) lives inside the `data` object
//     (see `PaginatedResponse`) so the envelope shape is uniform.

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

// ── Meta ──────────────────────────────────────────────────────────────────────

/// Metadata present in every API response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseMeta {
    /// Unix timestamp (seconds) when the response was generated.
    pub timestamp: u64,
    /// API version string.
    pub version: String,
    /// Optional correlation ID echoed from `X-Request-Id` or generated.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
}

impl ResponseMeta {
    pub fn new() -> Self {
        Self {
            timestamp: current_timestamp(),
            version: "1.0".to_string(),
            request_id: None,
        }
    }

    pub fn with_request_id(mut self, id: impl Into<String>) -> Self {
        self.request_id = Some(id.into());
        self
    }
}

impl Default for ResponseMeta {
    fn default() -> Self {
        Self::new()
    }
}

// ── Error payload ─────────────────────────────────────────────────────────────

/// Structured error object inside the envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiErrorPayload {
    /// Stable dot-separated code, e.g. `validation.field_error`.
    pub code: String,
    /// Human-readable message.
    pub message: String,
    /// HTTP status code mirrored for clients that cannot read status lines.
    pub status: u16,
    /// Optional per-field validation detail.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fields: Option<Vec<FieldDetail>>,
}

/// Per-field validation detail.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldDetail {
    pub field: String,
    pub message: String,
}

// ── Envelope ──────────────────────────────────────────────────────────────────

/// The canonical API response envelope.
///
/// `T` is the success payload type.  On error, `T = ()` is recommended,
/// though any serializable type is accepted.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    /// Present on success, `null` on error.
    pub data: Option<T>,
    /// Present on error, `null` on success.
    pub error: Option<ApiErrorPayload>,
    /// Always present.
    pub meta: ResponseMeta,
}

// ── Pagination ────────────────────────────────────────────────────────────────

/// Paginated data payload, used as `T` in `ApiResponse<PaginatedResponse<I>>`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total: u32,
    pub page: u32,
    pub limit: u32,
    /// Total number of pages.
    pub total_pages: u32,
    pub has_more: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

impl<T> PaginatedResponse<T> {
    pub fn new(items: Vec<T>, total: u32, page: u32, limit: u32) -> Self {
        Self {
            items,
            total,
            page,
            limit,
            total_pages: if limit == 0 { 0 } else { (total + limit - 1) / limit },
            has_more: false,
            next_cursor: None,
        }
    }
}

// ── Legacy shims (kept for internal callers not yet migrated) ─────────────────

/// Legacy request pagination parameters.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationParams {
    pub page: u32,
    pub limit: u32,
}

/// Legacy detailed API error (used by `errors/serialization.rs`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}

// ── Builder ───────────────────────────────────────────────────────────────────

pub struct ApiBuilder;

impl ApiBuilder {
    /// Wrap a successful payload in the standard envelope.
    pub fn success_response<T: Serialize>(data: T) -> ApiResponse<T> {
        ApiResponse {
            data: Some(data),
            error: None,
            meta: ResponseMeta::new(),
        }
    }

    /// Wrap a successful payload in the standard envelope with a request ID.
    pub fn success_with_request_id<T: Serialize>(data: T, request_id: impl Into<String>) -> ApiResponse<T> {
        ApiResponse {
            data: Some(data),
            error: None,
            meta: ResponseMeta::new().with_request_id(request_id),
        }
    }

    /// Build an error envelope.
    pub fn error_response<T: Serialize>(
        code: impl Into<String>,
        message: impl Into<String>,
        status: u16,
    ) -> ApiResponse<T> {
        ApiResponse {
            data: None,
            error: Some(ApiErrorPayload {
                code: code.into(),
                message: message.into(),
                status,
                fields: None,
            }),
            meta: ResponseMeta::new(),
        }
    }

    /// Build a validation error envelope with per-field detail.
    pub fn validation_error_response<T: Serialize>(fields: Vec<FieldDetail>) -> ApiResponse<T> {
        ApiResponse {
            data: None,
            error: Some(ApiErrorPayload {
                code: "validation.multiple_errors".to_string(),
                message: "One or more fields failed validation".to_string(),
                status: 422,
                fields: Some(fields),
            }),
            meta: ResponseMeta::new(),
        }
    }

    /// Build a paginated success envelope.
    pub fn paginated_response<T>(items: Vec<T>, total: u32, page: u32, limit: u32) -> PaginatedResponse<T> {
        PaginatedResponse::new(items, total, page, limit)
    }

    fn current_timestamp() -> u64 {
        current_timestamp()
    }
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn success_response_has_data_and_no_error() {
        let r = ApiBuilder::success_response("hello");
        assert_eq!(r.data, Some("hello"));
        assert!(r.error.is_none());
        assert!(r.meta.timestamp > 0);
        assert_eq!(r.meta.version, "1.0");
    }

    #[test]
    fn error_response_has_error_and_no_data() {
        let r: ApiResponse<String> = ApiBuilder::error_response("bad_request", "Missing field", 400);
        assert!(r.data.is_none());
        let err = r.error.unwrap();
        assert_eq!(err.code, "bad_request");
        assert_eq!(err.status, 400);
    }

    #[test]
    fn paginated_response_total_pages() {
        let r = ApiBuilder::paginated_response(vec![1u32, 2], 55, 1, 10);
        assert_eq!(r.total_pages, 6);
    }

    #[test]
    fn paginated_response_exact_division() {
        let r = ApiBuilder::paginated_response(vec![1u32], 20, 1, 10);
        assert_eq!(r.total_pages, 2);
    }

    #[test]
    fn paginated_response_zero_limit_is_safe() {
        let r = ApiBuilder::paginated_response(Vec::<u32>::new(), 0, 1, 0);
        assert_eq!(r.total_pages, 0);
    }

    #[test]
    fn validation_error_has_fields() {
        let fields = vec![FieldDetail {
            field: "weight".to_string(),
            message: "must be positive".to_string(),
        }];
        let r: ApiResponse<String> = ApiBuilder::validation_error_response(fields);
        assert!(r.data.is_none());
        let err = r.error.unwrap();
        assert_eq!(err.status, 422);
        assert!(err.fields.is_some());
    }

    #[test]
    fn meta_request_id_is_echoed() {
        let r = ApiBuilder::success_with_request_id(42u32, "req-abc");
        assert_eq!(r.meta.request_id.as_deref(), Some("req-abc"));
    }

    #[test]
    fn response_serializes_to_expected_keys() {
        let r = ApiBuilder::success_response("ok");
        let json = serde_json::to_value(&r).unwrap();
        assert!(json.get("data").is_some());
        assert!(json.get("error").is_some());
        assert!(json.get("meta").is_some());
        // Ensure no legacy 'success' key
        assert!(json.get("success").is_none());
        assert!(json.get("timestamp").is_none());
    }

    #[test]
    fn error_response_serializes_correctly() {
        let r: ApiResponse<String> = ApiBuilder::error_response("auth.unauthorized", "Forbidden", 403);
        let json = serde_json::to_value(&r).unwrap();
        assert!(json["data"].is_null());
        assert_eq!(json["error"]["code"], "auth.unauthorized");
        assert_eq!(json["error"]["status"], 403);
    }

    #[test]
    fn pagination_params_roundtrip() {
        let p = PaginationParams { page: 2, limit: 20 };
        assert_eq!(p.page, 2);
        assert_eq!(p.limit, 20);
    }

    #[test]
    fn api_error_legacy_compat() {
        let e = ApiError {
            code: "INVALID_INPUT".to_string(),
            message: "bad".to_string(),
            details: Some("field weight".to_string()),
        };
        assert_eq!(e.code, "INVALID_INPUT");
    }
}
