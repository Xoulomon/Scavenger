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
