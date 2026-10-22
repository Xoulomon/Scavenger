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

pub fn validate_pagination(page: u32, limit: u32) -> Vec<ValidationError> {
    let mut errors = Vec::new();
    if page == 0 {
        errors.push(ValidationError {
            field: "page".to_string(),
            message: "page must be at least 1".to_string(),
        });
    }
    if limit == 0 || limit > 100 {
        errors.push(ValidationError {
            field: "limit".to_string(),
            message: "limit must be between 1 and 100".to_string(),
        });
    }
    errors
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

pub fn validate_url(url: &str, field: &str) -> Option<ValidationError> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        Some(ValidationError { field: field.to_string(), message: format!("{} is required", field) })
    } else if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        Some(ValidationError {
            field: field.to_string(),
            message: format!("{} must be a valid http/https URL", field),
        })
    } else {
        None
    }
}

pub fn validate_doc_type(doc_type: &str) -> Option<ValidationError> {
    let trimmed = doc_type.trim();
    if trimmed.is_empty() {
        return Some(ValidationError { field: "doc_type".to_string(), message: "doc_type is required".to_string() });
    }
    if trimmed.len() > crate::services::verification::MAX_DOC_TYPE_LEN {
        return Some(ValidationError {
            field: "doc_type".to_string(),
            message: format!("doc_type must be at most {} characters", crate::services::verification::MAX_DOC_TYPE_LEN),
        });
    }
    None
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

/// Validates a Stellar address: 56 chars, starts with 'G', remaining 55 chars
/// from the Stellar base32 alphabet [A-Z2-7].
pub fn validate_stellar_address(addr: &str) -> Option<ValidationError> {
    let valid = addr.len() == 56
        && addr.starts_with('G')
        && addr[1..].chars().all(|c| matches!(c, 'A'..='Z' | '2'..='7'));
    if !valid {
        Some(ValidationError {
            field: "address".to_string(),
            message: "stellar address must be 56 characters starting with 'G' using base32 alphabet [A-Z2-7]".to_string(),
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
        // Valid: 56 chars, starts with G, remaining 55 chars all in [A-Z2-7]
        let valid = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
        assert!(validate_stellar_address(valid).is_none(), "canonical address should pass");
        // Too short
        assert!(validate_stellar_address("GABC").is_some());
        // Doesn't start with G
        let bad_prefix = "A".repeat(56);
        assert!(validate_stellar_address(&bad_prefix).is_some());
        // Contains invalid chars (digits 0,1,8,9 are not in base32)
        let bad_chars = "G".to_string() + &"0".repeat(55);
        assert!(validate_stellar_address(&bad_chars).is_some());
        // Correct length but invalid chars
        let bad_chars2 = "G".to_string() + &"a".repeat(55); // lowercase not valid
        assert!(validate_stellar_address(&bad_chars2).is_some());
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
}
