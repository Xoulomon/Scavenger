//! Shared commitment key-hashing primitive for the ZKP modules.
//!
//! Both `zkp.rs` (on-chain commitment scheme) and `zkp_verifier.rs`
//! (off-chain/test verifier) previously duplicated the SHA-256 preimage
//! construction `SHA-256(secret ‖ nonce)`.  This module is the single
//! authoritative implementation of that operation.
//!
//! Centralising it here ensures that both proof-generation and proof-
//! verification paths hash the preimage with **exactly the same byte layout**,
//! preventing the class of bug described in issue #1521 where a silent format
//! mismatch would cause valid proofs to be rejected.

use soroban_sdk::{BytesN, Env};

/// The size of a secret or nonce value, in bytes.
pub const KEY_SIZE: usize = 32;

/// Compute `SHA-256(secret ‖ nonce)` using the Soroban host SHA-256 function.
///
/// This is the **single canonical preimage construction** for the hash-based
/// commitment scheme used by both `zkp.rs` and `zkp_verifier.rs`.
///
/// # Parameters
/// * `secret` — 32-byte secret value.
/// * `nonce`  — 32-byte random nonce.
///
/// # Returns
/// A 32-byte SHA-256 digest (the commitment hash).
pub fn hash_commitment(env: &Env, secret: &BytesN<32>, nonce: &BytesN<32>) -> BytesN<32> {
    let mut preimage = soroban_sdk::Bytes::new(env);
    preimage.extend_from_array(&secret.to_array());
    preimage.extend_from_array(&nonce.to_array());
    env.crypto().sha256(&preimage)
}

/// Compute `SHA-256(secret ‖ nonce)` from raw byte arrays.
///
/// Convenience variant used by `zkp_verifier.rs`, which receives the inputs
/// as `[u8; 32]` arrays before they are wrapped in `BytesN<32>`.
pub fn hash_commitment_raw(env: &Env, secret: &[u8; 32], nonce: &[u8; 32]) -> BytesN<32> {
    let mut preimage_bytes = [0u8; 64];
    preimage_bytes[0..32].copy_from_slice(secret);
    preimage_bytes[32..64].copy_from_slice(nonce);
    let preimage = soroban_sdk::Bytes::from_array(env, &preimage_bytes);
    env.crypto().sha256(&preimage)
}

/// Shared test vectors: `(secret_fill_byte, nonce_fill_byte)` pairs that both
/// `zkp.rs` and `zkp_verifier.rs` test suites must agree on.
///
/// Each vector is a `(secret_byte, nonce_byte, description)` triple where
/// `secret_byte` / `nonce_byte` are the fill values used to construct 32-byte
/// inputs.  A shared test vector ensures that the two call-sites
/// (`hash_commitment` vs `hash_commitment_raw`) produce identical digests.
pub const TEST_VECTORS: &[(u8, u8, &str)] = &[
    (0x01, 0x02, "standard non-zero inputs"),
    (0x00, 0x00, "all-zero inputs"),
    (0xFF, 0xFF, "all-ones inputs"),
    (0xAA, 0xBB, "alternating bit pattern"),
    (0x10, 0x20, "typical usage bytes"),
];

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    fn bytes32(env: &Env, fill: u8) -> BytesN<32> {
        BytesN::from_array(env, &[fill; 32])
    }

    /// The two call-sites must produce the same digest for every test vector.
    #[test]
    fn hash_commitment_and_raw_agree_on_all_test_vectors() {
        let env = Env::default();
        for (s, n, desc) in TEST_VECTORS {
            let secret_bn = bytes32(&env, *s);
            let nonce_bn = bytes32(&env, *n);

            let via_bytesn = hash_commitment(&env, &secret_bn, &nonce_bn);
            let via_raw = hash_commitment_raw(&env, &[*s; 32], &[*n; 32]);

            assert_eq!(
                via_bytesn, via_raw,
                "hash_commitment vs hash_commitment_raw disagree on vector '{}'",
                desc
            );
        }
    }

    #[test]
    fn hash_commitment_is_deterministic() {
        let env = Env::default();
        let secret = bytes32(&env, 0xAA);
        let nonce = bytes32(&env, 0xBB);
        assert_eq!(
            hash_commitment(&env, &secret, &nonce),
            hash_commitment(&env, &secret, &nonce)
        );
    }

    #[test]
    fn different_secrets_produce_different_hashes() {
        let env = Env::default();
        let nonce = bytes32(&env, 0x01);
        let h1 = hash_commitment(&env, &bytes32(&env, 0x01), &nonce);
        let h2 = hash_commitment(&env, &bytes32(&env, 0x02), &nonce);
        assert_ne!(h1, h2);
    }

    #[test]
    fn different_nonces_produce_different_hashes() {
        let env = Env::default();
        let secret = bytes32(&env, 0x01);
        let h1 = hash_commitment(&env, &secret, &bytes32(&env, 0x01));
        let h2 = hash_commitment(&env, &secret, &bytes32(&env, 0x02));
        assert_ne!(h1, h2);
    }
}
