#[cfg(test)]
mod tests {
    use crate::errors::{
        codes,
        conversion::{from_validation_errors, from_validation_field},
        types::{AppError, AuthError, ContractError, ErrorCategory, ExportError, StorageError, ValidationError},
    };

    // ── Category classification ───────────────────────────────────────────────

    #[test]
    fn auth_error_has_correct_category() {
        let e = AppError::Auth(AuthError::Unauthorized("test".into()));
        assert_eq!(e.category(), ErrorCategory::Auth);
    }

    #[test]
    fn validation_error_has_correct_category() {
        let e = AppError::Validation(ValidationError::Field {
            field: "email".into(),
            message: "required".into(),
        });
        assert_eq!(e.category(), ErrorCategory::Validation);
    }

    #[test]
    fn not_found_has_correct_category() {
        let e = AppError::NotFound {
            resource: "waste",
            id: "abc123".into(),
        };
        assert_eq!(e.category(), ErrorCategory::NotFound);
    }

    // ── HTTP status codes ─────────────────────────────────────────────────────

    #[test]
    fn unauthorized_maps_to_401() {
        let e = AppError::Auth(AuthError::Unauthorized("bad token".into()));
        assert_eq!(e.status_code(), 401);
    }

    #[test]
    fn forbidden_maps_to_403() {
        let e = AppError::Auth(AuthError::Forbidden("no access".into()));
        assert_eq!(e.status_code(), 403);
    }

    #[test]
    fn validation_maps_to_422() {
        let e = from_validation_field("name", "required");
        assert_eq!(e.status_code(), 422);
    }

    #[test]
    fn not_found_maps_to_404() {
        let e = AppError::NotFound {
            resource: "participant",
            id: "p1".into(),
        };
        assert_eq!(e.status_code(), 404);
    }

    #[test]
    fn rate_limit_maps_to_429() {
        let e = AppError::RateLimitExceeded;
        assert_eq!(e.status_code(), 429);
    }

    #[test]
    fn internal_maps_to_500() {
        let e = AppError::Internal("db gone".into());
        assert_eq!(e.status_code(), 500);
    }

    #[test]
    fn contract_insufficient_balance_maps_to_402() {
        let e = AppError::Contract(ContractError::InsufficientBalance {
            required: 100,
            available: 50,
        });
        assert_eq!(e.status_code(), 402);
    }

    // ── Error codes ───────────────────────────────────────────────────────────

    #[test]
    fn auth_code_matches_constant() {
        let e = AppError::Auth(AuthError::Unauthorized("x".into()));
        assert_eq!(e.code(), codes::AUTH_UNAUTHORIZED);
    }

    #[test]
    fn export_csv_code_matches_constant() {
        let e = AppError::Export(ExportError::Csv("fail".into()));
        assert_eq!(e.code(), codes::EXPORT_CSV_ERROR);
    }

    #[test]
    fn not_found_code_contains_resource() {
        let e = AppError::NotFound {
            resource: "waste",
            id: "w1".into(),
        };
        assert!(e.code().starts_with("not_found.waste"));
    }

    #[test]
    fn storage_not_found_has_correct_code() {
        let e = AppError::Storage(StorageError::NotFound("file.pdf".into()));
        assert_eq!(e.code(), codes::STORAGE_NOT_FOUND);
    }

    // ── Serialization ─────────────────────────────────────────────────────────

    #[test]
    fn to_json_contains_code_and_status() {
        let e = AppError::RateLimitExceeded;
        let v = e.to_json();
        assert_eq!(v["error"]["code"], codes::RATE_LIMIT_EXCEEDED);
        assert_eq!(v["error"]["status"], 429);
    }

    #[test]
    fn validation_json_includes_fields_array() {
        let e = from_validation_errors(vec![
            ("email".into(), "invalid".into()),
            ("name".into(), "required".into()),
        ]);
        let v = e.to_json();
        let fields = v["error"]["fields"].as_array().expect("fields array");
        assert_eq!(fields.len(), 2);
    }

    #[test]
    fn non_validation_json_omits_fields() {
        let e = AppError::RateLimitExceeded;
        let v = e.to_json();
        assert!(v["error"]["fields"].is_null());
    }

    // ── Conversion helpers ────────────────────────────────────────────────────

    #[test]
    fn from_validation_field_builds_correct_variant() {
        let e = from_validation_field("weight", "must be positive");
        match e {
            AppError::Validation(ValidationError::Field { field, message }) => {
                assert_eq!(field, "weight");
                assert_eq!(message, "must be positive");
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn from_validation_errors_builds_multiple_variant() {
        let e = from_validation_errors(vec![("a".into(), "b".into())]);
        match e {
            AppError::Validation(ValidationError::Multiple(fields)) => {
                assert_eq!(fields.len(), 1);
                assert_eq!(fields[0].field, "a");
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn from_anyhow_becomes_internal() {
        let anyhow_err = anyhow::anyhow!("something broke");
        let e: AppError = anyhow_err.into();
        assert_eq!(e.category(), ErrorCategory::Internal);
    }

    // ── is_client_error ───────────────────────────────────────────────────────

    #[test]
    fn auth_errors_are_client_errors() {
        let e = AppError::Auth(AuthError::TokenExpired);
        assert!(e.is_client_error());
    }

    #[test]
    fn internal_errors_are_not_client_errors() {
        let e = AppError::Internal("broken".into());
        assert!(!e.is_client_error());
    }
}
