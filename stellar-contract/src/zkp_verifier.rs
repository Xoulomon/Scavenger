//! # ZKP Verifier Trait Interface
//!
//! Decouples proof parsing from verification and uses the shared primitives
//! from `zkp::keys` and `zkp::encoding` (issue #1521).
//!
//! * [`ParsedProof`] / [`parse_proof`] — re-exported from [`zkp::encoding`].
//! * [`ProofVerifier`] — a trait abstracting "verify a parsed proof".
//! * [`Sha256Verifier`] — production verifier using `zkp::keys::hash_commitment_raw`.
//! * [`MockVerifier`] — test-only verifier with a fixed result.
//! * [`parse_and_verify`] — high-level helper.

use soroban_sdk::Env;

// Re-export the shared encoding types so callers need only import from here.
pub use crate::zkp::encoding::{parse_proof, ParsedProof, ProofParseError, RAW_PROOF_LEN};

/// Abstraction over "verify that a parsed proof's commitment is valid".
///
/// Production code uses [`Sha256Verifier`]; tests can use [`MockVerifier`].
pub trait ProofVerifier {
    /// Returns `true` if `proof.commitment == SHA-256(proof.secret ++ proof.nonce)`.
    fn verify(&self, proof: &ParsedProof) -> bool;
}

/// Real verifier backed by the Soroban host's SHA-256 implementation.
///
/// Uses [`crate::zkp::keys::hash_commitment_raw`] — the single canonical
/// preimage construction shared with `zkp.rs` (issue #1521).
pub struct Sha256Verifier<'a> {
    pub env: &'a Env,
}

impl<'a> Sha256Verifier<'a> {
    pub fn new(env: &'a Env) -> Self {
        Self { env }
    }
}

impl<'a> ProofVerifier for Sha256Verifier<'a> {
    fn verify(&self, proof: &ParsedProof) -> bool {
        let hash = crate::zkp::keys::hash_commitment_raw(self.env, &proof.secret, &proof.nonce);
        hash.to_array() == proof.commitment
    }
}

/// Test-only verifier that returns a fixed, caller-controlled result.
#[derive(Debug, Clone, Copy)]
pub struct MockVerifier {
    pub result: bool,
}

impl MockVerifier {
    pub fn always_valid() -> Self {
        Self { result: true }
    }

    pub fn always_invalid() -> Self {
        Self { result: false }
    }
}

impl ProofVerifier for MockVerifier {
    fn verify(&self, _proof: &ParsedProof) -> bool {
        self.result
    }
}

/// High-level helper: parse then verify using any [`ProofVerifier`] impl.
pub fn parse_and_verify<V: ProofVerifier>(
    raw: &[u8],
    verifier: &V,
) -> Result<bool, ProofParseError> {
    let proof = parse_proof(raw)?;
    Ok(verifier.verify(&proof))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_raw(secret_byte: u8, nonce_byte: u8, commitment_byte: u8) -> Vec<u8> {
        let mut v = vec![secret_byte; 32];
        v.extend(vec![nonce_byte; 32]);
        v.extend(vec![commitment_byte; 32]);
        v
    }

    #[test]
    fn parse_proof_rejects_empty_input() {
        let err = parse_proof(&[]).unwrap_err();
        assert_eq!(err, ProofParseError::EmptyInput);
    }

    #[test]
    fn parse_proof_rejects_too_short() {
        let raw = vec![0u8; RAW_PROOF_LEN - 1];
        let err = parse_proof(&raw).unwrap_err();
        assert_eq!(
            err,
            ProofParseError::InvalidLength {
                expected: RAW_PROOF_LEN,
                actual: RAW_PROOF_LEN - 1
            }
        );
    }

    #[test]
    fn parse_proof_rejects_too_long() {
        let raw = vec![0u8; RAW_PROOF_LEN + 5];
        let err = parse_proof(&raw).unwrap_err();
        assert_eq!(
            err,
            ProofParseError::InvalidLength {
                expected: RAW_PROOF_LEN,
                actual: RAW_PROOF_LEN + 5
            }
        );
    }

    #[test]
    fn parse_proof_accepts_well_formed_input() {
        let raw = sample_raw(1, 2, 3);
        let parsed = parse_proof(&raw).expect("should parse");
        assert_eq!(parsed.secret, [1u8; 32]);
        assert_eq!(parsed.nonce, [2u8; 32]);
        assert_eq!(parsed.commitment, [3u8; 32]);
    }

    #[test]
    fn parse_proof_all_zero_bytes_is_still_structurally_valid() {
        let raw = vec![0u8; RAW_PROOF_LEN];
        let parsed = parse_proof(&raw).expect("all-zero is structurally valid");
        assert_eq!(parsed.secret, [0u8; 32]);
        assert_eq!(parsed.commitment, [0u8; 32]);
    }

    #[test]
    fn mock_verifier_always_valid_returns_true() {
        let proof = parse_proof(&sample_raw(9, 9, 9)).unwrap();
        let verifier = MockVerifier::always_valid();
        assert!(verifier.verify(&proof));
    }

    #[test]
    fn mock_verifier_always_invalid_returns_false() {
        let proof = parse_proof(&sample_raw(9, 9, 9)).unwrap();
        let verifier = MockVerifier::always_invalid();
        assert!(!verifier.verify(&proof));
    }

    #[test]
    fn parse_and_verify_propagates_parse_error_before_verifying() {
        let verifier = MockVerifier::always_valid();
        let result = parse_and_verify(&[1, 2, 3], &verifier);
        assert!(result.is_err());
    }

    #[test]
    fn parse_and_verify_returns_mock_result_on_well_formed_proof() {
        let verifier = MockVerifier::always_invalid();
        let raw = sample_raw(1, 1, 1);
        let result = parse_and_verify(&raw, &verifier).expect("should parse");
        assert!(!result);
    }

    #[test]
    fn malformed_proof_with_random_garbage_length_is_rejected() {
        let raw = vec![0xFFu8; 13];
        assert!(matches!(
            parse_proof(&raw),
            Err(ProofParseError::InvalidLength { .. })
        ));
    }

    #[test]
    fn parsed_proof_equality_distinguishes_different_secrets() {
        let a = parse_proof(&sample_raw(1, 2, 3)).unwrap();
        let b = parse_proof(&sample_raw(4, 2, 3)).unwrap();
        assert_ne!(a, b);
    }

    // ── Shared test vectors (issue #1521) ─────────────────────────────────────
    // Sha256Verifier must accept proofs built with the canonical hash, and must
    // reject proofs with a mismatched commitment.

    #[test]
    fn sha256_verifier_accepts_correct_proof_for_all_test_vectors() {
        use soroban_sdk::{BytesN, Env};
        let env = Env::default();
        for (s, n, desc) in crate::zkp::keys::TEST_VECTORS {
            // Build a genuine commitment via the shared key hash.
            let commitment = crate::zkp::keys::hash_commitment_raw(&env, &[*s; 32], &[*n; 32]);
            let mut raw = vec![*s; 32];
            raw.extend(vec![*n; 32]);
            raw.extend(commitment.to_array());

            let proof = parse_proof(&raw).expect("should parse");
            let verifier = Sha256Verifier::new(&env);
            assert!(
                verifier.verify(&proof),
                "Sha256Verifier rejected a valid proof for vector '{}'",
                desc
            );
        }
    }

    #[test]
    fn sha256_verifier_rejects_tampered_commitment_for_all_test_vectors() {
        use soroban_sdk::Env;
        let env = Env::default();
        for (s, n, desc) in crate::zkp::keys::TEST_VECTORS {
            // Use a zeroed-out commitment (wrong hash).
            let mut raw = vec![*s; 32];
            raw.extend(vec![*n; 32]);
            raw.extend(vec![0u8; 32]); // wrong commitment

            let proof = parse_proof(&raw).expect("should parse");
            let verifier = Sha256Verifier::new(&env);
            assert!(
                !verifier.verify(&proof),
                "Sha256Verifier accepted a tampered commitment for vector '{}'",
                desc
            );
        }
    }
}
