//! # ZKP Verifier Trait Interface — Issue: decouple proof parsing from verification
//!
//! `zkp.rs` mixes proof-record parsing (deserializing raw bytes into a
//! [`ParsedProof`]) with verification (recomputing the commitment hash and
//! comparing it). That coupling makes it hard to unit test verification logic
//! in isolation, and impossible to substitute a mock verifier in tests that
//! don't want to depend on the real hashing host function.
//!
//! This module introduces:
//! * [`ParsedProof`] / [`parse_proof`] — pure parsing/deserialization, no
//!   verification side effects.
//! * [`ProofVerifier`] — a trait abstracting "verify a parsed proof", so
//!   production code can use [`Sha256Verifier`] while tests can use
//!   [`MockVerifier`].
//! * Unit tests covering malformed and edge-case proof byte layouts.

use soroban_sdk::{BytesN, Env};

/// Fixed-width raw proof layout: `secret (32) ++ nonce (32) ++ commitment (32)`.
pub const RAW_PROOF_LEN: usize = 96;

/// Errors that can occur while parsing a raw proof byte blob.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProofParseError {
    /// The byte slice was not exactly [`RAW_PROOF_LEN`] bytes.
    InvalidLength { expected: usize, actual: usize },
    /// The byte slice was empty.
    EmptyInput,
}

/// A proof that has been deserialized from raw bytes but not yet verified.
///
/// Parsing is pure and infallible with respect to cryptography — it only
/// checks structural shape (lengths). Verification (does the commitment
/// actually match?) is a separate step performed by a [`ProofVerifier`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedProof {
    pub secret: [u8; 32],
    pub nonce: [u8; 32],
    pub commitment: [u8; 32],
}

/// Parse a raw proof blob (`secret ‖ nonce ‖ commitment`) into a [`ParsedProof`].
///
/// This function performs **no cryptographic verification** — it only
/// validates structural shape so verification logic downstream can assume a
/// well-formed input.
pub fn parse_proof(raw: &[u8]) -> Result<ParsedProof, ProofParseError> {
    if raw.is_empty() {
        return Err(ProofParseError::EmptyInput);
    }
    if raw.len() != RAW_PROOF_LEN {
        return Err(ProofParseError::InvalidLength {
            expected: RAW_PROOF_LEN,
            actual: raw.len(),
        });
    }

    let mut secret = [0u8; 32];
    let mut nonce = [0u8; 32];
    let mut commitment = [0u8; 32];
    secret.copy_from_slice(&raw[0..32]);
    nonce.copy_from_slice(&raw[32..64]);
    commitment.copy_from_slice(&raw[64..96]);

    Ok(ParsedProof {
        secret,
        nonce,
        commitment,
    })
}

/// Abstraction over "verify that a parsed proof's commitment is valid".
///
/// Production code uses [`Sha256Verifier`] (backed by the Soroban host's
/// SHA-256 implementation); tests can substitute [`MockVerifier`] to avoid
/// depending on a live `Env` / host crypto function.
pub trait ProofVerifier {
    /// Returns `true` if `proof.commitment == SHA-256(proof.secret ++ proof.nonce)`.
    fn verify(&self, proof: &ParsedProof) -> bool;
}

/// Real verifier backed by the Soroban host's SHA-256 implementation.
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
        let mut preimage_bytes = [0u8; 64];
        preimage_bytes[0..32].copy_from_slice(&proof.secret);
        preimage_bytes[32..64].copy_from_slice(&proof.nonce);

        let preimage = soroban_sdk::Bytes::from_array(self.env, &preimage_bytes);
        let hash = self.env.crypto().sha256(&preimage);
        let expected: BytesN<32> = hash.into();

        expected.to_array() == proof.commitment
    }
}

/// Test-only verifier that returns a fixed, caller-controlled result,
/// letting verification-consuming code be unit tested without an `Env`.
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
///
/// Returns `Ok(true)`/`Ok(false)` for structurally valid proofs depending on
/// verification outcome, or `Err` if the raw bytes could not be parsed.
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
}
