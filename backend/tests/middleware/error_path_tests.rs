//! Error-path tests for backend middleware — issue #1764.
//!
//! Covers error paths of the request-protection middleware (validation).
//! Written for issue #1764; test execution is skipped in this session.

use scavenger_backend::errors::types::AppError;
use scavenger_backend::middleware::validation::{issues_to_error, ValidationIssue};

#[test]
fn issues_to_error_returns_validation_error_for_issue_list() {
    let err = issues_to_error(vec![ValidationIssue::new("field", "missing value")]);
    assert!(matches!(err, AppError::Validation(_)));
}

#[test]
fn issues_to_error_returns_validation_error_for_empty_issue_list() {
    let err = issues_to_error(vec![]);
    assert!(matches!(err, AppError::Validation(_)));
}
