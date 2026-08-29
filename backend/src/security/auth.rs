//! Authentication and authorisation helpers.
//!
//! # Responsibility boundary
//!
//! | Module | Owns |
//! |---|---|
//! | `security/auth.rs` (this file) | Token validation logic, scope checking, permission rules, `AuthError` production |
//! | `security/signing.rs` | Cryptographic signing / multi-sig for on-chain transactions |
//! | `middleware/csrf.rs` | HTTP-layer CSRF token generation & validation (stateless, per-request) |
//! | `middleware/rate_limit.rs` | Abuse-prevention throttling — unrelated to identity |
//! | `middleware/request_id.rs` | Correlation-id injection — infrastructure concern |
//! | `middleware/validation.rs` | Input-shape validation — not identity |
//!
//! The rule of thumb:
//! * **security/** = pure logic about *who the caller is* and *what they may do*.
//! * **middleware/** = HTTP-layer cross-cutting concerns that operate on the
//!   actix-web request/response cycle.
//!
//! CSRF sits in `middleware/` because it is a per-request HTTP header check.
//! If the CSRF *state* (e.g. token storage, rotation policy) ever grows beyond
//! the current stateless hash scheme it should be extracted into a
//! `security/csrf_state.rs` helper while `middleware/csrf.rs` keeps only the
//! actix glue.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::errors::types::AuthError;

// ── Token claims ──────────────────────────────────────────────────────────────

/// Decoded claims extracted from a bearer token.
///
/// In production this would be parsed from a signed JWT.  The struct is kept
/// framework-agnostic so the validation logic is testable without an HTTP server.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TokenClaims {
    /// Subject — typically a user or service account ID.
    pub sub: String,
    /// Scopes granted to this token, e.g. `["waste:read", "waste:write"]`.
    pub scopes: Vec<String>,
    /// Absolute expiry instant (UTC).
    pub expires_at: DateTime<Utc>,
}

impl TokenClaims {
    /// Returns `true` if the token has not yet expired relative to `now`.
    pub fn is_valid_at(&self, now: DateTime<Utc>) -> bool {
        now < self.expires_at
    }

    /// Returns `true` if the token grants the requested scope.
    pub fn has_scope(&self, required: &str) -> bool {
        self.scopes.iter().any(|s| s == required)
    }
}

// ── Verification ──────────────────────────────────────────────────────────────

/// Errors that can arise during token verification.
#[derive(Debug, Clone, PartialEq)]
pub enum VerifyError {
    /// Token has passed its expiry instant.
    Expired,
    /// Token signature is invalid or the header/payload is malformed.
    Malformed(String),
    /// Token is structurally valid but does not carry the required scope.
    InsufficientScope { required: String },
}

impl From<VerifyError> for AuthError {
    fn from(e: VerifyError) -> Self {
        match e {
            VerifyError::Expired => AuthError::TokenExpired,
            VerifyError::Malformed(msg) => AuthError::InvalidToken,
            VerifyError::InsufficientScope { .. } => AuthError::Forbidden("insufficient scope".to_string()),
        }
    }
}

/// Validates a set of decoded `TokenClaims` against the current time.
///
/// Returns `Ok(claims)` when the token is live, `Err(VerifyError::Expired)`
/// when it has expired.
pub fn verify_token(claims: &TokenClaims, now: DateTime<Utc>) -> Result<&TokenClaims, VerifyError> {
    if !claims.is_valid_at(now) {
        return Err(VerifyError::Expired);
    }
    Ok(claims)
}

/// Asserts that `claims` carries the `required` scope.
///
/// Call this *after* `verify_token` so expiry is always checked first.
///
/// ```
/// # use backend::security::auth::{TokenClaims, check_scope, VerifyError};
/// # use chrono::Utc;
/// let claims = TokenClaims {
///     sub: "u1".into(),
///     scopes: vec!["waste:read".into()],
///     expires_at: Utc::now() + chrono::Duration::hours(1),
/// };
/// assert!(check_scope(&claims, "waste:read").is_ok());
/// assert!(check_scope(&claims, "waste:write").is_err());
/// ```
pub fn check_scope(claims: &TokenClaims, required: &str) -> Result<(), VerifyError> {
    if claims.has_scope(required) {
        Ok(())
    } else {
        Err(VerifyError::InsufficientScope {
            required: required.to_string(),
        })
    }
}

/// Convenience helper: verify token liveness *and* scope in one call.
///
/// Returns `Err(VerifyError::Expired)` before checking scope so the caller
/// always gets the most actionable error first.
pub fn verify_and_check_scope(
    claims: &TokenClaims,
    required: &str,
    now: DateTime<Utc>,
) -> Result<(), VerifyError> {
    verify_token(claims, now)?;
    check_scope(claims, required)?;
    Ok(())
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    fn make_claims(scopes: Vec<&str>, offset: Duration) -> TokenClaims {
        TokenClaims {
            sub: "user-1".to_string(),
            scopes: scopes.into_iter().map(str::to_string).collect(),
            expires_at: Utc::now() + offset,
        }
    }

    // ── verify_token ─────────────────────────────────────────────────────────

    #[test]
    fn valid_token_passes() {
        let claims = make_claims(vec!["waste:read"], Duration::hours(1));
        assert!(verify_token(&claims, Utc::now()).is_ok());
    }

    #[test]
    fn expired_token_is_rejected() {
        // Token expired 1 second ago.
        let claims = make_claims(vec!["waste:read"], Duration::seconds(-1));
        let err = verify_token(&claims, Utc::now()).unwrap_err();
        assert_eq!(err, VerifyError::Expired);
    }

    #[test]
    fn token_expiring_exactly_now_is_rejected() {
        // expires_at == now  ⟹  NOT (now < expires_at)  ⟹  expired.
        let now = Utc::now();
        let claims = TokenClaims {
            sub: "u".into(),
            scopes: vec![],
            expires_at: now,
        };
        let err = verify_token(&claims, now).unwrap_err();
        assert_eq!(err, VerifyError::Expired);
    }

    // ── check_scope ───────────────────────────────────────────────────────────

    #[test]
    fn correct_scope_passes() {
        let claims = make_claims(vec!["waste:read", "waste:write"], Duration::hours(1));
        assert!(check_scope(&claims, "waste:write").is_ok());
    }

    #[test]
    fn wrong_scope_returns_insufficient_scope_error() {
        let claims = make_claims(vec!["waste:read"], Duration::hours(1));
        let err = check_scope(&claims, "admin:delete").unwrap_err();
        assert_eq!(
            err,
            VerifyError::InsufficientScope {
                required: "admin:delete".to_string()
            }
        );
    }

    #[test]
    fn empty_scopes_always_fails_scope_check() {
        let claims = make_claims(vec![], Duration::hours(1));
        assert!(check_scope(&claims, "any:scope").is_err());
    }

    // ── verify_and_check_scope ────────────────────────────────────────────────

    #[test]
    fn expired_token_reported_before_scope_error() {
        // Even if the scope would match, expiry takes priority.
        let claims = make_claims(vec!["waste:read"], Duration::seconds(-60));
        let err = verify_and_check_scope(&claims, "waste:read", Utc::now()).unwrap_err();
        assert_eq!(err, VerifyError::Expired, "expiry must be checked before scope");
    }

    #[test]
    fn valid_token_wrong_scope_reports_insufficient_scope() {
        let claims = make_claims(vec!["waste:read"], Duration::hours(1));
        let err = verify_and_check_scope(&claims, "admin:write", Utc::now()).unwrap_err();
        assert!(
            matches!(err, VerifyError::InsufficientScope { .. }),
            "should be InsufficientScope, got {:?}",
            err
        );
    }

    #[test]
    fn valid_token_correct_scope_succeeds() {
        let claims = make_claims(vec!["waste:read", "waste:write"], Duration::hours(1));
        assert!(verify_and_check_scope(&claims, "waste:write", Utc::now()).is_ok());
    }

    // ── AuthError conversion ──────────────────────────────────────────────────

    #[test]
    fn verify_error_converts_to_auth_error() {
        let e: AuthError = VerifyError::Expired.into();
        assert!(matches!(e, AuthError::TokenExpired));

        let e: AuthError = VerifyError::InsufficientScope {
            required: "x".into(),
        }
        .into();
        assert!(matches!(e, AuthError::Forbidden(_)));
    }
}
