use super::types::{AppError, ErrorCategory, ValidationError};
use std::fmt;

/// Human-readable multi-line error report, suitable for logs.
pub struct ErrorReport<'a>(pub &'a AppError);

impl<'a> fmt::Display for ErrorReport<'a> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let e = self.0;
        write!(f, "[{}] {} (code: {})", e.category().as_str(), e, e.code())?;

        // Expand validation field list inline
        if let AppError::Validation(ValidationError::Multiple(fields)) = e {
            write!(f, " — fields:")?;
            for fe in fields {
                write!(f, " {}={}", fe.field, fe.message)?;
            }
        }

        Ok(())
    }
}

/// Terse one-line format for metric labels / tracing spans.
pub fn error_label(e: &AppError) -> String {
    format!("{}:{}", e.category().as_str(), e.code())
}

/// Format validation errors as a human-readable bullet list.
pub fn format_validation(e: &ValidationError) -> String {
    match e {
        ValidationError::Field { field, message } => format!("• {field}: {message}"),
        ValidationError::Multiple(fields) => fields
            .iter()
            .map(|f| format!("• {}: {}", f.field, f.message))
            .collect::<Vec<_>>()
            .join("\n"),
        ValidationError::Format { field, expected } => {
            format!("• {field}: expected {expected}")
        }
    }
}

// Keep ErrorCategory display logic alongside format helpers
impl ErrorCategory {
    pub fn as_str(self) -> &'static str {
        match self {
            ErrorCategory::Auth => "auth",
            ErrorCategory::Validation => "validation",
            ErrorCategory::Export => "export",
            ErrorCategory::Email => "email",
            ErrorCategory::Storage => "storage",
            ErrorCategory::Contract => "contract",
            ErrorCategory::Webhook => "webhook",
            ErrorCategory::Notification => "notification",
            ErrorCategory::Serialization => "serialization",
            ErrorCategory::Analytics => "analytics",
            ErrorCategory::NotFound => "not_found",
            ErrorCategory::Internal => "internal",
            ErrorCategory::RateLimit => "rate_limit",
            ErrorCategory::BadRequest => "bad_request",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::errors::types::FieldError;

    #[test]
    fn report_includes_category_message_and_code() {
        let err = AppError::NotFound("user".to_string());
        let report = ErrorReport(&err).to_string();
        assert!(report.contains("[not_found]"));
        assert!(report.contains(&err.code()));
        assert!(report.contains(&err.to_string()));
    }

    #[test]
    fn report_expands_multiple_validation_fields() {
        let err = AppError::Validation(ValidationError::Multiple(vec![
            FieldError {
                field: "email".to_string(),
                message: "invalid".to_string(),
            },
            FieldError {
                field: "name".to_string(),
                message: "required".to_string(),
            },
        ]));
        let report = ErrorReport(&err).to_string();
        assert!(report.contains("fields:"));
        assert!(report.contains("email=invalid"));
        assert!(report.contains("name=required"));
    }

    #[test]
    fn error_label_combines_category_and_code() {
        let err = AppError::RateLimit("slow down".to_string());
        let label = error_label(&err);
        assert_eq!(label, format!("rate_limit:{}", err.code()));
    }

    #[test]
    fn format_validation_handles_all_variants() {
        let field = ValidationError::Field {
            field: "age".to_string(),
            message: "must be positive".to_string(),
        };
        assert_eq!(format_validation(&field), "• age: must be positive");

        let format_err = ValidationError::Format {
            field: "date".to_string(),
            expected: "YYYY-MM-DD".to_string(),
        };
        assert_eq!(format_validation(&format_err), "• date: expected YYYY-MM-DD");

        let multiple = ValidationError::Multiple(vec![
            FieldError {
                field: "a".to_string(),
                message: "one".to_string(),
            },
            FieldError {
                field: "b".to_string(),
                message: "two".to_string(),
            },
        ]);
        assert_eq!(format_validation(&multiple), "• a: one\n• b: two");
    }

    #[test]
    fn category_as_str_is_stable() {
        assert_eq!(ErrorCategory::Auth.as_str(), "auth");
        assert_eq!(ErrorCategory::BadRequest.as_str(), "bad_request");
        assert_eq!(ErrorCategory::Internal.as_str(), "internal");
    }
}
