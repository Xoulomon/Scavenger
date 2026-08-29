//! Shared cryptographic types

use serde::{Deserialize, Serialize};

/// Parameters for encryption operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionParams {
    pub algorithm: String,
    pub key_size: usize,
    pub nonce_size: usize,
    pub iterations: u32,
    pub memory_cost: u32,
    pub parallelism: u32,
}

/// Key material for cryptographic operations
#[derive(Debug, Clone)]
pub struct KeyMaterial {
    pub key: Vec<u8>,
    pub algorithm: String,
    pub version: u32,
}

impl KeyMaterial {
    pub fn new(key: [u8; 32]) -> Self {
        Self {
            key: key.to_vec(),
            algorithm: "AES-256-GCM".to_string(),
            version: 1,
        }
    }
}

/// Encrypted data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedData {
    pub ciphertext: Vec<u8>,
    pub iv: Vec<u8>,
    pub hmac: Vec<u8>,
    pub algorithm: String,
}

/// Signature data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signature {
    pub data: Vec<u8>,
    pub algorithm: String,
    pub key_id: Option<String>,
}

/// Data for verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationData {
    pub data: Vec<u8>,
    pub signature: Vec<u8>,
    pub public_key: Option<Vec<u8>>,
}
