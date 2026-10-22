//! Cryptographic error types
//!
//! #1161: crypto operations must fail closed with a *consistent, non-leaky*
//! message. `Display` (via `thiserror`) is kept for internal logs/tracing —
//! it never interpolates key material, plaintext, or library-internal
//! detail, only which class of operation failed. Anything crossing a trust
//! boundary to an external caller (an HTTP response body, for instance)
//! should go through [`CryptoError::external_message`] instead of
//! `Display`/`to_string()`, since that collapses distinct failure modes
//! (e.g. "wrong key size" vs. "ciphertext tampered") into one of a handful
//! of generic buckets. Keeping those indistinguishable to the outside world
//! avoids handing an attacker an oracle for which stage of a crypto
//! operation failed.

use thiserror::Error;

#[derive(Error, Debug, Clone, PartialEq)]
pub enum CryptoError {
    #[error("Invalid key size")]
    InvalidKeySize,

    #[error("Encryption failed")]
    EncryptionFailed,

    #[error("Decryption failed")]
    DecryptionFailed,

    #[error("Integrity check failed")]
    IntegrityCheckFailed,

    #[error("HMAC creation failed")]
    HmacCreationFailed,

    #[error("HMAC verification failed")]
    HmacVerificationFailed,

    #[error("Key derivation failed")]
    KeyDerivationFailed,

    #[error("Password hash failed")]
    PasswordHashFailed,

    #[error("Password verification failed")]
    PasswordVerificationFailed,

    #[error("Invalid ciphertext format")]
    InvalidCiphertextFormat,

    #[error("Invalid signature")]
    InvalidSignature,

    #[error("Algorithm not supported")]
    AlgorithmNotSupported,

    #[error("Operation timed out")]
    OperationTimeout,

    #[error("Random number generation failed")]
    RngFailed,
}

impl CryptoError {
    /// Generic, non-leaky message safe to return to an external caller.
    ///
    /// Every variant maps to one of a small set of fixed, static strings
    /// with no interpolated data (no algorithm name, no key size, no
    /// underlying library error text), so callers outside the crypto
    /// boundary can never learn *why* an operation failed beyond its broad
    /// category. This is deliberately coarser than `Display`: collapsing
    /// e.g. `InvalidKeySize`/`EncryptionFailed`/`AlgorithmNotSupported` into
    /// one bucket prevents a caller from probing which specific precondition
    /// tripped.
    pub fn external_message(&self) -> &'static str {
        match self {
            CryptoError::InvalidKeySize
            | CryptoError::EncryptionFailed
            | CryptoError::DecryptionFailed
            | CryptoError::InvalidCiphertextFormat
            | CryptoError::AlgorithmNotSupported
            | CryptoError::RngFailed => "Cryptographic operation failed",

            CryptoError::IntegrityCheckFailed
            | CryptoError::HmacCreationFailed
            | CryptoError::HmacVerificationFailed
            | CryptoError::InvalidSignature => "Integrity verification failed",

            CryptoError::KeyDerivationFailed
            | CryptoError::PasswordHashFailed
            | CryptoError::PasswordVerificationFailed => "Credential processing failed",

            CryptoError::OperationTimeout => "Operation timed out",
        }
    }
}

pub type CryptoResult<T> = Result<T, CryptoError>;

#[cfg(test)]
mod tests {
    use super::*;

    fn all_variants() -> Vec<CryptoError> {
        vec![
            CryptoError::InvalidKeySize,
            CryptoError::EncryptionFailed,
            CryptoError::DecryptionFailed,
            CryptoError::IntegrityCheckFailed,
            CryptoError::HmacCreationFailed,
            CryptoError::HmacVerificationFailed,
            CryptoError::KeyDerivationFailed,
            CryptoError::PasswordHashFailed,
            CryptoError::PasswordVerificationFailed,
            CryptoError::InvalidCiphertextFormat,
            CryptoError::InvalidSignature,
            CryptoError::AlgorithmNotSupported,
            CryptoError::OperationTimeout,
            CryptoError::RngFailed,
        ]
    }

    #[test]
    fn every_variant_has_an_external_message() {
        for variant in all_variants() {
            assert!(!variant.external_message().is_empty());
        }
    }

    #[test]
    fn external_messages_never_mention_implementation_detail() {
        // None of the generic external messages should leak which
        // algorithm, library, or primitive was involved.
        let banned_terms = [
            "aes", "gcm", "argon2", "hmac", "sha", "nonce", "iv", "salt", "key size", "reqwest", "openssl",
        ];
        for variant in all_variants() {
            let msg = variant.external_message().to_lowercase();
            for term in banned_terms {
                assert!(
                    !msg.contains(term),
                    "external_message() for {:?} leaked implementation detail {:?}: {}",
                    variant,
                    term,
                    msg
                );
            }
        }
    }

    #[test]
    fn distinct_failure_causes_collapse_into_the_same_external_bucket() {
        // Wrong key size and a corrupted ciphertext are different internal
        // failures but must be indistinguishable externally.
        assert_eq!(
            CryptoError::InvalidKeySize.external_message(),
            CryptoError::EncryptionFailed.external_message()
        );
        assert_eq!(
            CryptoError::HmacVerificationFailed.external_message(),
            CryptoError::InvalidSignature.external_message()
        );
    }

    #[test]
    fn external_message_is_stable_across_clones() {
        let err = CryptoError::DecryptionFailed;
        assert_eq!(err.clone().external_message(), err.external_message());
    }
}
