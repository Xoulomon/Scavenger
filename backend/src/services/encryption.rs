//! Encryption service using shared cryptographic primitives
//! 
//! This service provides high-level encryption operations for the application.
//! All cryptographic operations are delegated to the shared crypto module
//! to ensure consistency with verification logic.

use crate::crypto::{
    encrypt as crypto_encrypt,
    decrypt as crypto_decrypt,
    generate_key, generate_iv,
    EncryptedData, KeyMaterial, CryptoError,
};
use crate::crypto::types::EncryptionParams;

/// Service for encrypting and decrypting data
pub struct EncryptionService {
    params: EncryptionParams,
}

impl Default for EncryptionService {
    fn default() -> Self {
        Self::new()
    }
}

impl EncryptionService {
    /// Create a new encryption service with default parameters
    pub fn new() -> Self {
        Self {
            params: crate::crypto::primitives::default_params(),
        }
    }

    /// Encrypt data using the shared cryptographic primitives
    pub fn encrypt(&self, data: &[u8], key: &KeyMaterial) -> Result<EncryptedData, CryptoError> {
        let key_array = key.key.as_slice().try_into()
            .map_err(|_| CryptoError::InvalidKeySize)?;
        crypto_encrypt(data, &key_array)
    }

    /// Decrypt data using the shared cryptographic primitives
    pub fn decrypt(&self, encrypted: &EncryptedData, key: &KeyMaterial) -> Result<Vec<u8>, CryptoError> {
        let key_array = key.key.as_slice().try_into()
            .map_err(|_| CryptoError::InvalidKeySize)?;
        crypto_decrypt(encrypted, &key_array)
    }

    /// Generate a new encryption key
    pub fn generate_key() -> KeyMaterial {
        let key = generate_key();
        KeyMaterial::new(key)
    }

    /// Generate a new IV
    pub fn generate_iv() -> Vec<u8> {
        generate_iv().to_vec()
    }

    /// Verify encrypted data integrity
    pub fn verify(&self, data: &[u8], hmac: &[u8], key: &KeyMaterial) -> Result<bool, CryptoError> {
        let key_array = key.key.as_slice().try_into()
            .map_err(|_| CryptoError::InvalidKeySize)?;
        crate::crypto::primitives::verify(data, hmac, &key_array)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_service_encrypt_decrypt() {
        let service = EncryptionService::new();
        let key = EncryptionService::generate_key();
        let data = b"secret data";
        
        let encrypted = service.encrypt(data, &key).unwrap();
        let decrypted = service.decrypt(&encrypted, &key).unwrap();
        
        assert_eq!(decrypted, data);
    }

    #[test]
    fn test_encryption_service_verify() {
        let service = EncryptionService::new();
        let key = EncryptionService::generate_key();
        let data = b"test data";
        
        let encrypted = service.encrypt(data, &key).unwrap();
        let verified = service.verify(&encrypted.ciphertext, &encrypted.hmac, &key).unwrap();
        
        assert!(verified);
    }
}
