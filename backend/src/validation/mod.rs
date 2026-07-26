use actix_web::{HttpResponse, ResponseError};
use serde::{Deserialize, Serialize};

use crate::errors::{AppError, FieldError, ValidationError as DomainValidationError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

/// Builds the unified JSON error response for a list of field-level validation
/// errors. Shared by API handlers instead of each module defining its own
/// `error_response` helper.
pub fn error_response(errors: &[ValidationError]) -> HttpResponse {
    let fields = errors
        .iter()
        .map(|e| FieldError {
            field: e.field.clone(),
            message: e.message.clone(),
        })
        .collect();
    AppError::Validation(DomainValidationError::Multiple(fields)).error_response()
}

/// Collects multiple validation errors and serializes them for API responses.
#[derive(Debug, Default)]
pub struct ValidationErrors(Vec<ValidationError>);

impl ValidationErrors {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, field: &str, message: &str) {
        self.0.push(ValidationError {
            field: field.to_string(),
            message: message.to_string(),
        });
    }

    pub fn push(&mut self, err: ValidationError) {
        self.0.push(err);
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    pub fn to_response(&self) -> serde_json::Value {
        serde_json::json!({ "errors": self.0 })
    }
}

pub fn validate_required(value: &str, field: &str) -> Option<ValidationError> {
    if value.trim().is_empty() {
        Some(ValidationError {
            field: field.to_string(),
            message: format!("{} is required", field),
        })
    } else {
        None
    }
}

pub fn validate_min_length(value: &str, field: &str, min: usize) -> Option<ValidationError> {
    if value.len() < min {
        Some(ValidationError {
            field: field.to_string(),
            message: format!("{} must be at least {} characters", field, min),
        })
    } else {
        None
    }
}

pub fn validate_range(value: u64, field: &str, min: u64, max: u64) -> Option<ValidationError> {
    if value < min || value > max {
        Some(ValidationError {
            field: field.to_string(),
            message: format!("{} must be between {} and {}", field, min, max),
        })
    } else {
        None
    }
}

/// Maximum items per page enforced across all list endpoints.
pub const MAX_PAGE_SIZE: u32 = 100;

pub fn validate_pagination(page: u32, limit: u32) -> Vec<ValidationError> {
    let mut errors = Vec::new();
    if page == 0 {
        errors.push(ValidationError {
            field: "page".to_string(),
            message: "page must be at least 1".to_string(),
        });
    }
    if limit == 0 || limit > MAX_PAGE_SIZE {
        errors.push(ValidationError {
            field: "limit".to_string(),
            message: format!("limit must be between 1 and {}", MAX_PAGE_SIZE),
        });
    }
    errors
}

/// Parameters for cursor-based pagination.
///
/// Callers supply either an opaque `cursor` (from a previous response's
/// `next_cursor` field) **or** a `page`/`limit` pair for offset-based access.
/// If both are supplied `cursor` takes precedence.
#[derive(Debug, Clone, Deserialize)]
pub struct CursorPaginationParams {
    /// Opaque cursor from a prior response's `pagination.next_cursor`.
    pub cursor: Option<String>,
    /// Page number (1-based, offset mode).  Defaults to `1`.
    pub page: Option<u32>,
    /// Items per page.  Defaults to `20`, capped at [`MAX_PAGE_SIZE`].
    pub limit: Option<u32>,
}

impl CursorPaginationParams {
    /// Resolved, validated page number (1-based).
    pub fn resolved_page(&self) -> u32 {
        self.page.unwrap_or(1).max(1)
    }

    /// Resolved, validated limit (clamped to MAX_PAGE_SIZE).
    pub fn resolved_limit(&self) -> u32 {
        self.limit.unwrap_or(20).clamp(1, MAX_PAGE_SIZE)
    }
}

/// Validate [`CursorPaginationParams`].
///
/// Unlike the plain `validate_pagination` helper this accepts a `cursor`
/// field and skips offset validation when a cursor is present.
pub fn validate_cursor_pagination(params: &CursorPaginationParams) -> Vec<ValidationError> {
    // When a cursor is provided, skip offset-based field checks.
    if params.cursor.is_some() {
        return Vec::new();
    }
    validate_pagination(params.resolved_page(), params.resolved_limit())
}

pub fn validate_email(email: &str) -> Option<ValidationError> {
    if !email.contains('@') || !email.contains('.') {
        Some(ValidationError {
            field: "email".to_string(),
            message: "invalid email format".to_string(),
        })
    } else {
        None
    }
}

pub fn validate_export_format(format: &str) -> Option<ValidationError> {
    match format.to_lowercase().as_str() {
        "csv" | "json" | "pdf" => None,
        _ => Some(ValidationError {
            field: "format".to_string(),
            message: "format must be csv, json, or pdf".to_string(),
        }),
    }
}

pub fn validate_date_range(start: &str, end: &str) -> Vec<ValidationError> {
    let mut errors = Vec::new();
    if chrono::NaiveDateTime::parse_from_str(start, "%Y-%m-%dT%H:%M:%S").is_err() {
        errors.push(ValidationError {
            field: "start_date".to_string(),
            message: "invalid start_date format, use YYYY-MM-DDTHH:MM:SS".to_string(),
        });
    }
    if chrono::NaiveDateTime::parse_from_str(end, "%Y-%m-%dT%H:%M:%S").is_err() {
        errors.push(ValidationError {
            field: "end_date".to_string(),
            message: "invalid end_date format, use YYYY-MM-DDTHH:MM:SS".to_string(),
        });
    }
    errors
}

/// Validates a Stellar address: 56 chars starting with 'G'.
pub fn validate_stellar_address(addr: &str) -> Option<ValidationError> {
    if addr.len() != 56 || !addr.starts_with('G') {
        Some(ValidationError {
            field: "address".to_string(),
            message: "stellar address must be 56 characters starting with 'G'".to_string(),
        })
    } else {
        None
    }
}

/// Validates geographic coordinates.
pub fn validate_coordinates(lat: f64, lon: f64) -> Vec<ValidationError> {
    let mut errors = Vec::new();
    if !(-90.0..=90.0).contains(&lat) {
        errors.push(ValidationError {
            field: "latitude".to_string(),
            message: "latitude must be between -90 and 90".to_string(),
        });
    }
    if !(-180.0..=180.0).contains(&lon) {
        errors.push(ValidationError {
            field: "longitude".to_string(),
            message: "longitude must be between -180 and 180".to_string(),
        });
    }
    errors
}

/// Validates waste weight: 1 to 1,000,000,000.
pub fn validate_waste_weight(weight: u64) -> Option<ValidationError> {
    if weight == 0 || weight > 1_000_000_000 {
        Some(ValidationError {
            field: "weight".to_string(),
            message: "weight must be between 1 and 1,000,000,000".to_string(),
        })
    } else {
        None
    }
}

/// Validates a display name: 1–100 chars, letters/digits/spaces/hyphens only.
pub fn validate_name(name: &str) -> Option<ValidationError> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.len() > 100 {
        return Some(ValidationError {
            field: "name".to_string(),
            message: "name must be between 1 and 100 characters".to_string(),
        });
    }
    if !trimmed.chars().all(|c| c.is_alphanumeric() || c == ' ' || c == '-') {
        return Some(ValidationError {
            field: "name".to_string(),
            message: "name may only contain letters, digits, spaces, and hyphens".to_string(),
        });
    }
    None
}

/// Trims whitespace and removes control characters.
pub fn sanitize_string(s: &str) -> String {
    s.trim().chars().filter(|c| !c.is_control()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_required() {
        assert!(validate_required("", "name").is_some());
        assert!(validate_required("valid", "name").is_none());
    }

    #[test]
    fn test_validate_min_length() {
        assert!(validate_min_length("ab", "name", 3).is_some());
        assert!(validate_min_length("abc", "name", 3).is_none());
    }

    #[test]
    fn test_validate_range() {
        assert!(validate_range(5, "value", 10, 100).is_some());
        assert!(validate_range(50, "value", 10, 100).is_none());
    }

    #[test]
    fn test_validate_pagination() {
        assert!(!validate_pagination(0, 10).is_empty());
        assert!(!validate_pagination(1, 0).is_empty());
        assert!(!validate_pagination(1, 200).is_empty());
        assert!(validate_pagination(1, 10).is_empty());
    }

    #[test]
    fn test_validate_email() {
        assert!(validate_email("invalid").is_some());
        assert!(validate_email("test@example.com").is_none());
    }

    #[test]
    fn test_validate_export_format() {
        assert!(validate_export_format("csv").is_none());
        assert!(validate_export_format("json").is_none());
        assert!(validate_export_format("pdf").is_none());
        assert!(validate_export_format("xls").is_some());
    }

    #[test]
    fn test_validate_stellar_address() {
        let valid = "G".repeat(1) + &"A".repeat(55);
        assert!(validate_stellar_address(&valid).is_none());
        assert!(validate_stellar_address("GABC").is_some());
        assert!(validate_stellar_address(&"A".repeat(56)).is_some());
    }

    #[test]
    fn test_validate_coordinates() {
        assert!(validate_coordinates(0.0, 0.0).is_empty());
        assert!(!validate_coordinates(91.0, 0.0).is_empty());
        assert!(!validate_coordinates(0.0, 181.0).is_empty());
        assert!(!validate_coordinates(-91.0, -181.0).is_empty());
    }

    #[test]
    fn test_validate_waste_weight() {
        assert!(validate_waste_weight(0).is_some());
        assert!(validate_waste_weight(1_000_000_001).is_some());
        assert!(validate_waste_weight(500).is_none());
    }

    #[test]
    fn test_validate_name() {
        assert!(validate_name("Alice").is_none());
        assert!(validate_name("Bob Smith").is_none());
        assert!(validate_name("Bob-Smith").is_none());
        assert!(validate_name("").is_some());
        assert!(validate_name("<script>").is_some());
    }

    #[test]
    fn test_sanitize_string() {
        assert_eq!(sanitize_string("  hello\x00world  "), "helloworld");
        assert_eq!(sanitize_string("clean"), "clean");
    }

    #[test]
    fn test_validation_errors() {
        let mut errs = ValidationErrors::new();
        assert!(errs.is_empty());
        errs.add("field", "required");
        assert!(!errs.is_empty());
        let resp = errs.to_response();
        assert!(resp["errors"].is_array());
    }

    // ── Cursor pagination tests ───────────────────────────────────────────────

    #[test]
    fn test_max_page_size_constant() {
        assert_eq!(MAX_PAGE_SIZE, 100, "MAX_PAGE_SIZE must be 100");
    }

    #[test]
    fn test_validate_pagination_max_size_boundary() {
        assert!(validate_pagination(1, MAX_PAGE_SIZE).is_empty());
        assert!(!validate_pagination(1, MAX_PAGE_SIZE + 1).is_empty());
    }

    #[test]
    fn test_cursor_pagination_defaults() {
        let params = CursorPaginationParams {
            cursor: None,
            page: None,
            limit: None,
        };
        assert_eq!(params.resolved_page(), 1);
        assert_eq!(params.resolved_limit(), 20);
    }

    #[test]
    fn test_cursor_pagination_custom_values() {
        let params = CursorPaginationParams {
            cursor: None,
            page: Some(3),
            limit: Some(50),
        };
        assert_eq!(params.resolved_page(), 3);
        assert_eq!(params.resolved_limit(), 50);
    }

    #[test]
    fn test_cursor_pagination_limit_clamped_to_max() {
        let params = CursorPaginationParams {
            cursor: None,
            page: Some(1),
            limit: Some(999),
        };
        assert_eq!(params.resolved_limit(), MAX_PAGE_SIZE);
    }

    #[test]
    fn test_cursor_pagination_limit_clamped_to_min() {
        let params = CursorPaginationParams {
            cursor: None,
            page: Some(1),
            limit: Some(0),
        };
        assert_eq!(params.resolved_limit(), 1);
    }

    #[test]
    fn test_validate_cursor_pagination_with_cursor_skips_offset_check() {
        // A cursor overrides page/limit so validation should pass even with page=0
        let params = CursorPaginationParams {
            cursor: Some("opaque_cursor_token".to_string()),
            page: Some(0),   // would normally fail
            limit: Some(999), // would normally fail
        };
        assert!(validate_cursor_pagination(&params).is_empty());
    }

    #[test]
    fn test_validate_cursor_pagination_without_cursor_validates_offsets() {
        let params = CursorPaginationParams {
            cursor: None,
            page: Some(0),
            limit: Some(10),
        };
        let errs = validate_cursor_pagination(&params);
        assert!(!errs.is_empty());
        assert!(errs.iter().any(|e| e.field == "page"));
    }

    #[test]
    fn test_validate_cursor_pagination_valid_without_cursor() {
        let params = CursorPaginationParams {
            cursor: None,
            page: Some(2),
            limit: Some(25),
        };
        assert!(validate_cursor_pagination(&params).is_empty());
    }
}
