use super::types::{AppError, EmailError, ExportError, FieldError, SerializationError, StorageError, ValidationError};

// ── serde_json ────────────────────────────────────────────────────────────────

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Serialization(SerializationError::Json(e.to_string()))
    }
}

// ── Legacy per-service error types (kept for backward compat) ─────────────────

/// Converts the legacy `ExportError` variants (CsvError, JsonError, etc.)
/// from `services/export.rs` into the unified hierarchy.
pub fn from_legacy_export(e: &str, kind: LegacyExportKind) -> AppError {
    let inner = match kind {
        LegacyExportKind::Csv => ExportError::Csv(e.to_string()),
        LegacyExportKind::Json => ExportError::Json(e.to_string()),
        LegacyExportKind::Pdf => ExportError::Pdf(e.to_string()),
        LegacyExportKind::Serialization => ExportError::Serialization(e.to_string()),
        LegacyExportKind::InvalidFormat => ExportError::InvalidFormat(e.to_string()),
    };
    AppError::Export(inner)
}

#[derive(Debug, Clone, Copy)]
pub enum LegacyExportKind {
    Csv,
    Json,
    Pdf,
    Serialization,
    InvalidFormat,
}

/// Converts the legacy `EmailError` variants from `services/email.rs`.
pub fn from_legacy_email(e: &str, kind: LegacyEmailKind) -> AppError {
    let inner = match kind {
        LegacyEmailKind::Service => EmailError::Service(e.to_string()),
        LegacyEmailKind::Template => EmailError::Template(e.to_string()),
        LegacyEmailKind::InvalidEmail => EmailError::InvalidAddress(e.to_string()),
    };
    AppError::Email(inner)
}

#[derive(Debug, Clone, Copy)]
pub enum LegacyEmailKind {
    Service,
    Template,
    InvalidEmail,
}

/// Converts the legacy `StorageError` variants from `services/storage.rs`.
pub fn from_legacy_storage(e: &str, kind: LegacyStorageKind) -> AppError {
    let inner = match kind {
        LegacyStorageKind::Service => StorageError::Service(e.to_string()),
        LegacyStorageKind::InvalidFile => StorageError::InvalidFile(e.to_string()),
        LegacyStorageKind::NotFound => StorageError::NotFound(e.to_string()),
    };
    AppError::Storage(inner)
}

#[derive(Debug, Clone, Copy)]
pub enum LegacyStorageKind {
    Service,
    InvalidFile,
    NotFound,
}

/// Converts a flat `ValidationError { field, message }` struct (validation/mod.rs)
/// into the unified `AppError::Validation`.
pub fn from_validation_field(field: impl Into<String>, message: impl Into<String>) -> AppError {
    AppError::Validation(ValidationError::Field {
        field: field.into(),
        message: message.into(),
    })
}

/// Converts a Vec of `(field, message)` pairs into `AppError::Validation(Multiple)`.
pub fn from_validation_errors(errors: Vec<(String, String)>) -> AppError {
    let fields = errors
        .into_iter()
        .map(|(field, message)| FieldError { field, message })
        .collect();
    AppError::Validation(ValidationError::Multiple(fields))
}

// ── anyhow bridge ─────────────────────────────────────────────────────────────

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serde_json_error_converts_to_serialization() {
        let err: serde_json::Error = serde_json::from_str::<i32>("not json").unwrap_err();
        let app: AppError = err.into();
        assert!(matches!(app, AppError::Serialization(SerializationError::Json(_))));
    }

    #[test]
    fn legacy_export_kinds_convert() {
        assert!(matches!(
            from_legacy_export("e", LegacyExportKind::Csv),
            AppError::Export(ExportError::Csv(_))
        ));
        assert!(matches!(
            from_legacy_export("e", LegacyExportKind::Json),
            AppError::Export(ExportError::Json(_))
        ));
        assert!(matches!(
            from_legacy_export("e", LegacyExportKind::Pdf),
            AppError::Export(ExportError::Pdf(_))
        ));
        assert!(matches!(
            from_legacy_export("e", LegacyExportKind::Serialization),
            AppError::Export(ExportError::Serialization(_))
        ));
        assert!(matches!(
            from_legacy_export("e", LegacyExportKind::InvalidFormat),
            AppError::Export(ExportError::InvalidFormat(_))
        ));
    }

    #[test]
    fn legacy_email_kinds_convert() {
        assert!(matches!(
            from_legacy_email("e", LegacyEmailKind::Service),
            AppError::Email(EmailError::Service(_))
        ));
        assert!(matches!(
            from_legacy_email("e", LegacyEmailKind::Template),
            AppError::Email(EmailError::Template(_))
        ));
        assert!(matches!(
            from_legacy_email("e", LegacyEmailKind::InvalidEmail),
            AppError::Email(EmailError::InvalidAddress(_))
        ));
    }

    #[test]
    fn legacy_storage_kinds_convert() {
        assert!(matches!(
            from_legacy_storage("e", LegacyStorageKind::Service),
            AppError::Storage(StorageError::Service(_))
        ));
        assert!(matches!(
            from_legacy_storage("e", LegacyStorageKind::InvalidFile),
            AppError::Storage(StorageError::InvalidFile(_))
        ));
        assert!(matches!(
            from_legacy_storage("e", LegacyStorageKind::NotFound),
            AppError::Storage(StorageError::NotFound(_))
        ));
    }

    #[test]
    fn validation_field_converts() {
        let app = from_validation_field("email", "invalid");
        match app {
            AppError::Validation(ValidationError::Field { field, message }) => {
                assert_eq!(field, "email");
                assert_eq!(message, "invalid");
            }
            other => panic!("unexpected variant: {other:?}"),
        }
    }

    #[test]
    fn validation_errors_convert_to_multiple() {
        let app = from_validation_errors(vec![
            ("a".to_string(), "x".to_string()),
            ("b".to_string(), "y".to_string()),
        ]);
        match app {
            AppError::Validation(ValidationError::Multiple(fields)) => {
                assert_eq!(fields.len(), 2);
                assert_eq!(fields[0].field, "a");
                assert_eq!(fields[1].message, "y");
            }
            other => panic!("unexpected variant: {other:?}"),
        }
    }

    #[test]
    fn anyhow_error_converts_to_internal() {
        let err = anyhow::anyhow!("boom");
        let app: AppError = err.into();
        assert!(matches!(app, AppError::Internal(_)));
    }
}
