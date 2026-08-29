//! Cryptographic error types

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

pub type CryptoResult<T> = Result<T, CryptoError>;
