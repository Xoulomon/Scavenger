//! Shared cryptographic primitives for the Scavenger backend
//! 
//! This module consolidates all cryptographic operations into a single
//! source of truth to prevent drift between encryption and verification logic.

pub mod primitives;
pub mod errors;
pub mod types;

// Re-export commonly used items
pub use primitives::{
    encrypt, decrypt, verify, sign,
    generate_key, generate_iv, generate_salt,
    derive_key, hash_password, verify_password,
    create_hmac, verify_hmac,
};
pub use errors::CryptoError;
pub use types::{EncryptionParams, KeyMaterial, EncryptedData};
