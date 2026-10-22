//! Shared proof encoding for the ZKP modules (issue #1521).
//!
//! `zkp_verifier.rs` previously defined the raw-proof byte layout
//! (`secret ‖ nonce ‖ commitment`, 96 bytes) inline.  This module
//! is the single authoritative definition of that layout so both
//! `zkp.rs` and `zkp_verifier.rs` reference the same constants.

/// Fixed-width raw proof layout: `secret (32) ++ nonce (32) ++ commitment (32)`.
///
/// Any change to the proof format must be made here; `zkp.rs` and
/// `zkp_verifier.rs` import this constant rather than defining it themselves.
pub const RAW_PROOF_LEN: usize = 96;

/// Byte offsets within a [`RAW_PROOF_LEN`]-byte proof blob.
pub mod offsets {
    /// Start (inclusive) of the secret field.
    pub const SECRET_START: usize = 0;
    /// End (exclusive) of the secret field.
    pub const SECRET_END: usize = 32;

    /// Start (inclusive) of the nonce field.
    pub const NONCE_START: usize = 32;
    /// End (exclusive) of the nonce field.
    pub const NONCE_END: usize = 64;

    /// Start (inclusive) of the commitment field.
    pub const COMMITMENT_START: usize = 64;
    /// End (exclusive) of the commitment field.
    pub const COMMITMENT_END: usize = 96;
}

/// Parse error returned when a raw proof blob has the wrong shape.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProofParseError {
    /// The byte slice was not exactly [`RAW_PROOF_LEN`] bytes.
    InvalidLength { expected: usize, actual: usize },
    /// The byte slice was empty.
    EmptyInput,
}

/// A proof that has been deserialized from raw bytes but not yet verified.
///
/// Parsing is purely structural — it only checks lengths.  Cryptographic
/// verification is a separate step.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedProof {
    pub secret: [u8; 32],
    pub nonce: [u8; 32],
    pub commitment: [u8; 32],
}

/// Parse a raw proof blob (`secret ‖ nonce ‖ commitment`) into a [`ParsedProof`].
///
/// Performs **no cryptographic verification** — structural shape only.
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
    secret.copy_from_slice(&raw[offsets::SECRET_START..offsets::SECRET_END]);
    nonce.copy_from_slice(&raw[offsets::NONCE_START..offsets::NONCE_END]);
    commitment.copy_from_slice(&raw[offsets::COMMITMENT_START..offsets::COMMITMENT_END]);

    Ok(ParsedProof {
        secret,
        nonce,
        commitment,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_raw(s: u8, n: u8, c: u8) -> Vec<u8> {
        let mut v = vec![s; 32];
        v.extend(vec![n; 32]);
        v.extend(vec![c; 32]);
        v
    }

    #[test]
    fn parse_proof_rejects_empty() {
        assert_eq!(parse_proof(&[]), Err(ProofParseError::EmptyInput));
    }

    #[test]
    fn parse_proof_rejects_too_short() {
        let raw = vec![0u8; RAW_PROOF_LEN - 1];
        assert_eq!(
            parse_proof(&raw),
            Err(ProofParseError::InvalidLength {
                expected: RAW_PROOF_LEN,
                actual: RAW_PROOF_LEN - 1
            })
        );
    }

    #[test]
    fn parse_proof_rejects_too_long() {
        let raw = vec![0u8; RAW_PROOF_LEN + 1];
        assert_eq!(
            parse_proof(&raw),
            Err(ProofParseError::InvalidLength {
                expected: RAW_PROOF_LEN,
                actual: RAW_PROOF_LEN + 1
            })
        );
    }

    #[test]
    fn parse_proof_well_formed() {
        let raw = sample_raw(1, 2, 3);
        let p = parse_proof(&raw).unwrap();
        assert_eq!(p.secret, [1u8; 32]);
        assert_eq!(p.nonce, [2u8; 32]);
        assert_eq!(p.commitment, [3u8; 32]);
    }
}
