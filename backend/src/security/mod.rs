//! Security module — pure identity and cryptographic concerns.
//!
//! # Responsibility boundary
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────────┐
//! │  security/                                                      │
//! │  ┌──────────────────┐  ┌────────────────────────────────────┐  │
//! │  │  auth.rs         │  │  signing.rs                        │  │
//! │  │                  │  │                                    │  │
//! │  │  • TokenClaims   │  │  • TransactionSigningService       │  │
//! │  │  • verify_token  │  │  • SignatureScheme / Request       │  │
//! │  │  • check_scope   │  │  • MultiSignatureSupport           │  │
//! │  │  • VerifyError   │  │  • SignatureRevocation             │  │
//! │  └──────────────────┘  └────────────────────────────────────┘  │
//! └─────────────────────────────────────────────────────────────────┘
//!
//! ┌─────────────────────────────────────────────────────────────────┐
//! │  middleware/    (HTTP-layer cross-cutting concerns)              │
//! │                                                                 │
//! │  • csrf.rs         — stateless CSRF token check per request     │
//! │  • rate_limit.rs   — throttling / abuse prevention              │
//! │  • request_id.rs   — correlation-id injection                   │
//! │  • validation.rs   — request-body shape validation              │
//! │  • idempotency.rs  — idempotency-key replay protection          │
//! └─────────────────────────────────────────────────────────────────┘
//! ```
//!
//! ## Decision rules
//!
//! * Put logic in **`security/`** when it is about *who the caller is*, *what
//!   keys they hold*, or *what actions they are permitted to perform*.
//! * Put logic in **`middleware/`** when it operates on the actix-web
//!   `ServiceRequest` / `ServiceResponse` cycle and does not need to know about
//!   user identity or cryptographic material.
//!
//! CSRF sits in `middleware/` because it is a per-request HTTP header check.
//! If CSRF *state* (e.g. token storage, rotation policy) ever grows beyond the
//! current stateless hash scheme it should be extracted into a
//! `security/csrf_state.rs` helper while `middleware/csrf.rs` retains only the
//! actix glue.

pub mod auth;
pub mod signing;

pub use auth::{check_scope, verify_and_check_scope, verify_token, TokenClaims, VerifyError};
pub use signing::*;
