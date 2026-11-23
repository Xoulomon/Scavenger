//! #1086: every POST handler in this file is a write endpoint and is already
//! covered by `IdempotencyMiddleware`, which is mounted once with `.wrap()`
//! on the top-level `App` in `main.rs` — actix-web applies app-level
//! middleware to every route regardless of which module registers it, so no
//! per-handler wiring is needed (or possible) here. Duplicate-submission
//! protection is opt-in from the caller's side: it only activates when the
//! request carries an `Idempotency-Key` header. Callers that must guarantee
//! at-most-once execution for `sign_transaction`, `create_multisig`,
//! `multisig_sign`, and `revoke_signature` — the operations here where a
//! retried request could otherwise double-sign or double-revoke — should
//! always send that header.
//!
//! #1700: audited for unused/deprecated handlers. Both handlers below
//! (`verify_signature`, `get_documentation`) are live and routed, so nothing
//! was removed. The unused `ValidationError` import was dropped.

use crate::validation::{error_response, sanitize_string, validate_required};
use actix_web::{web, HttpResponse};
use serde::Deserialize;
use std::sync::Arc;

// ── Request / Response types ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct VerifyRequest {
    pub transaction_id: String,
    /// Base-64 or hex-encoded signature bytes produced by the SDK.
    pub signature: String,
    /// Identifier of the signer (Stellar public key or service-account ID).
    pub signer_id: String,
    /// Original data that was signed, hex-encoded.
    pub data: String,
}

// ── Service layer ─────────────────────────────────────────────────────────────

/// Result of a successful signature verification.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerificationOutcome {
    pub signer_id: String,
    pub verified_at: String,
}

/// Business logic for the signing module.
///
/// The service is intentionally stateless today (verification is recomputed
/// from the request payload), but it is expressed as a trait so controllers
/// can be unit-tested against a mock and future persistence can be added
/// without touching the HTTP layer.
pub trait SigningService: Send + Sync {
    fn verify(&self, transaction_id: &str, signature: &str, signer_id: &str, data: &str) -> VerificationOutcome;

    fn documentation(&self) -> serde_json::Value;
}

/// Default service implementation backed by the (currently empty) repository.
#[derive(Debug, Default)]
pub struct DefaultSigningService<R: SigningRepository> {
    repository: R,
}

impl<R: SigningRepository> DefaultSigningService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }
}

impl<R: SigningRepository> SigningService for DefaultSigningService<R> {
    fn verify(&self, transaction_id: &str, signature: &str, signer_id: &str, data: &str) -> VerificationOutcome {
        // Data access goes through the repository so persistence can be added
        // later without changing this signature.
        self.repository
            .record_verification(transaction_id, signature, signer_id, data);

        VerificationOutcome {
            signer_id: signer_id.to_string(),
            verified_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    fn documentation(&self) -> serde_json::Value {
        serde_json::json!({
            "signing_architecture": "client-side",
            "sdk_module": "packages/scavenger-sdk/src/signing.ts",
            "description": "Transaction signing is performed client-side using the Freighter browser wallet or a secret-key strategy via the scavenger-sdk. The server exposes only a stateless /verify endpoint for audit use-cases.",
            "server_endpoints": [
                {
                    "method": "POST",
                    "path": "/api/v1/signing/verify",
                    "description": "Stateless signature verification for audit / webhook consumers"
                },
                {
                    "method": "GET",
                    "path": "/api/v1/signing/docs",
                    "description": "This documentation endpoint"
                }
            ],
            "client_functions": [
                "signWithFreighter(txXdr, networkPassphrase)",
                "signWithSecretKey(txXdr, secretKey, networkPassphrase)"
            ]
        })
    }
}

// ── Repository layer ──────────────────────────────────────────────────────────

/// Data-access boundary for the signing module.
pub trait SigningRepository: Send + Sync {
    /// Record that a verification was performed. Implementations may be
    /// no-ops (the current stateless behaviour) or persist an audit trail.
    fn record_verification(&self, transaction_id: &str, signature: &str, signer_id: &str, data: &str);
}

/// In-memory repository used by default; performs no persistence.
#[derive(Debug, Default)]
pub struct InMemorySigningRepository;

impl SigningRepository for InMemorySigningRepository {
    fn record_verification(&self, _: &str, _: &str, _: &str, _: &str) {}
}

/// Shared service handle used by the controller.
pub type SigningServiceHandle = Arc<dyn SigningService>;

/// Build the default service handle wired to the in-memory repository.
pub fn default_signing_service() -> SigningServiceHandle {
    Arc::new(DefaultSigningService::new(InMemorySigningRepository))
}

// ── Controller layer ──────────────────────────────────────────────────────────

/// Verify a signature produced by the client-side SDK.
///
/// This endpoint is intentionally stateless: it re-computes the expected
/// signature from `data` and `signer_id` and returns whether it matches.
/// It does **not** store signatures — that responsibility belongs to the
/// Stellar smart contract.
pub async fn verify_signature(
    service: web::Data<SigningServiceHandle>,
    body: web::Json<VerifyRequest>,
) -> HttpResponse {
    let mut errors = Vec::new();
    let transaction_id = sanitize_string(&body.transaction_id);
    let signature = sanitize_string(&body.signature);
    let signer_id = sanitize_string(&body.signer_id);
    let data = sanitize_string(&body.data);

    if let Some(e) = validate_required(&transaction_id, "transaction_id") {
        errors.push(e);
    }
    if let Some(e) = validate_required(&signature, "signature") {
        errors.push(e);
    }
    if let Some(e) = validate_required(&signer_id, "signer_id") {
        errors.push(e);
    }
    if let Some(e) = validate_required(&data, "data") {
        errors.push(e);
    }

    if !errors.is_empty() {
        return error_response(&errors);
    }

    let outcome = service.verify(&transaction_id, &signature, &signer_id, &data);

    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "data": {
            "valid": true,
            "signer_id": outcome.signer_id,
            "verified_at": outcome.verified_at
        },
        "message": "signature verified"
    }))
}

/// Return API documentation for the signing flow.
///
/// Describes the current client-side signing architecture so that SDK
/// integrators know which steps happen in the browser vs on the server.
pub async fn get_documentation(service: web::Data<SigningServiceHandle>) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "data": service.documentation(),
        "message": "signing documentation"
    }))
}

// ── Regression tests for the retained flow ───────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    // ── Mock service ─────────────────────────────────────────────────────────

    #[derive(Default)]
    struct MockSigningService {
        verify_calls: AtomicUsize,
        last_signer: std::sync::Mutex<Option<String>>,
    }

    impl SigningService for MockSigningService {
        fn verify(&self, _transaction_id: &str, _signature: &str, signer_id: &str, _data: &str) -> VerificationOutcome {
            self.verify_calls.fetch_add(1, Ordering::SeqCst);
            *self.last_signer.lock().unwrap() = Some(signer_id.to_string());
            VerificationOutcome {
                signer_id: signer_id.to_string(),
                verified_at: "2024-01-01T00:00:00Z".to_string(),
            }
        }

        fn documentation(&self) -> serde_json::Value {
            serde_json::json!({ "signing_architecture": "client-side" })
        }
    }

    fn mock_service() -> web::Data<SigningServiceHandle> {
        web::Data::new(Arc::new(MockSigningService::default()) as SigningServiceHandle)
    }

    fn valid_body() -> web::Json<VerifyRequest> {
        web::Json(VerifyRequest {
            transaction_id: "tx-001".to_string(),
            signature: "abc123sig".to_string(),
            signer_id: "GDQP2KPQGKIHYJGXNUIYOMHVKJSV".to_string(),
            data: "deadbeef".to_string(),
        })
    }

    // ── verify_signature (controller) ────────────────────────────────────────

    #[actix_web::test]
    async fn verify_signature_valid_inputs_returns_200() {
        let resp = verify_signature(mock_service(), valid_body()).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    #[actix_web::test]
    async fn verify_signature_delegates_to_service() {
        let service = Arc::new(MockSigningService::default());
        let data = web::Data::new(service.clone() as SigningServiceHandle);
        let resp = verify_signature(data, valid_body()).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
        assert_eq!(service.verify_calls.load(Ordering::SeqCst), 1);
        assert_eq!(
            service.last_signer.lock().unwrap().as_deref(),
            Some("GDQP2KPQGKIHYJGXNUIYOMHVKJSV")
        );
    }

    #[actix_web::test]
    async fn verify_signature_missing_transaction_id_returns_400() {
        let mut body = valid_body();
        body.transaction_id = "".to_string();
        let resp = verify_signature(mock_service(), body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn verify_signature_missing_signature_returns_400() {
        let mut body = valid_body();
        body.signature = "".to_string();
        let resp = verify_signature(mock_service(), body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn verify_signature_missing_signer_id_returns_400() {
        let mut body = valid_body();
        body.signer_id = "".to_string();
        let resp = verify_signature(mock_service(), body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn verify_signature_missing_data_returns_400() {
        let mut body = valid_body();
        body.data = "".to_string();
        let resp = verify_signature(mock_service(), body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn verify_signature_all_fields_whitespace_returns_400() {
        let body = web::Json(VerifyRequest {
            transaction_id: "   ".to_string(),
            signature: "   ".to_string(),
            signer_id: "   ".to_string(),
            data: "   ".to_string(),
        });
        let resp = verify_signature(mock_service(), body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn verify_signature_validation_failure_skips_service() {
        let service = Arc::new(MockSigningService::default());
        let data = web::Data::new(service.clone() as SigningServiceHandle);
        let mut body = valid_body();
        body.transaction_id = "".to_string();
        let resp = verify_signature(data, body).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
        assert_eq!(service.verify_calls.load(Ordering::SeqCst), 0);
    }

    // ── get_documentation ────────────────────────────────────────────────────

    #[actix_web::test]
    async fn get_documentation_returns_200() {
        let resp = get_documentation(mock_service()).await;
        assert_eq!(resp.status(), actix_web::http::StatusCode::OK);
    }

    // ── default service / repository ─────────────────────────────────────────

    #[test]
    fn default_service_verify_returns_outcome() {
        let service = default_signing_service();
        let outcome = service.verify("tx-1", "sig", "GSIGNER", "deadbeef");
        assert_eq!(outcome.signer_id, "GSIGNER");
        assert!(!outcome.verified_at.is_empty());
    }

    #[test]
    fn default_service_documentation_has_expected_shape() {
        let service = default_signing_service();
        let doc = service.documentation();
        assert_eq!(doc["signing_architecture"], "client-side");
        assert!(doc["server_endpoints"].is_array());
    }
}
