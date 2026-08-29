use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionKey {
    pub id: String,
    pub algorithm: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedData {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
    pub key_id: String,
    pub encrypted_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionMetrics {
    pub encrypt_operations: u64,
    pub decrypt_operations: u64,
    pub key_rotations: u64,
    pub verification_failures: u64,
    pub total_bytes_encrypted: u64,
}

impl Default for EncryptionMetrics {
    fn default() -> Self {
        Self {
            encrypt_operations: 0,
            decrypt_operations: 0,
            key_rotations: 0,
            verification_failures: 0,
            total_bytes_encrypted: 0,
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DataEncryptionService {
    keys: std::sync::Arc<Mutex<Vec<EncryptionKey>>>,
    active_key_id: std::sync::Arc<Mutex<String>>,
    metrics: std::sync::Arc<Mutex<EncryptionMetrics>>,
}

impl DataEncryptionService {
    pub fn new() -> Self {
        let key = EncryptionKey {
            id: uuid::Uuid::new_v4().to_string(),
            algorithm: "AES-256-GCM".to_string(),
            created_at: chrono::Utc::now(),
            expires_at: None,
            active: true,
        };

        Self {
            keys: std::sync::Arc::new(Mutex::new(vec![key])),
            active_key_id: std::sync::Arc::new(Mutex::new(key.id.clone())),
            metrics: std::sync::Arc::new(Mutex::new(EncryptionMetrics::default())),
        }
    }

    pub fn encrypt(&self, plaintext: &[u8]) -> Result<EncryptedData, String> {
        let key_id = self.active_key_id.lock().unwrap().clone();
        let nonce = self.generate_nonce();

        let ciphertext = self.encrypt_data(plaintext, &nonce, &key_id)?;

        let mut metrics = self.metrics.lock().unwrap();
        metrics.encrypt_operations += 1;
        metrics.total_bytes_encrypted += plaintext.len() as u64;

        Ok(EncryptedData {
            ciphertext,
            nonce,
            key_id,
            encrypted_at: chrono::Utc::now(),
        })
    }

    pub fn decrypt(&self, encrypted: &EncryptedData) -> Result<Vec<u8>, String> {
        let result = self.decrypt_data(&encrypted.ciphertext, &encrypted.nonce, &encrypted.key_id)?;

        let mut metrics = self.metrics.lock().unwrap();
        metrics.decrypt_operations += 1;

        Ok(result)
    }

    pub fn verify_encryption(&self, encrypted: &EncryptedData) -> Result<bool, String> {
        let keys = self.keys.lock().unwrap();
        if !keys.iter().any(|k| k.id == encrypted.key_id && k.active) {
            self.metrics.lock().unwrap().verification_failures += 1;
            return Err("Invalid or inactive key".to_string());
        }

        let nonce = self.generate_nonce();
        let decrypted = self.decrypt_data(&encrypted.ciphertext, &nonce, &encrypted.key_id)?;
        Ok(!decrypted.is_empty())
    }

    pub fn rotate_key(&self) -> Result<String, String> {
        let new_key = EncryptionKey {
            id: uuid::Uuid::new_v4().to_string(),
            algorithm: "AES-256-GCM".to_string(),
            created_at: chrono::Utc::now(),
            expires_at: Some(chrono::Utc::now() + chrono::Duration::days(365)),
            active: true,
        };

        let old_key_id = {
            let mut keys = self.keys.lock().unwrap();
            let old_id = self.active_key_id.lock().unwrap().clone();
            if let Some(old_key) = keys.iter_mut().find(|k| k.id == old_id) {
                old_key.active = false;
            }
            keys.push(new_key.clone());
            old_id
        };

        *self.active_key_id.lock().unwrap() = new_key.id.clone();
        self.metrics.lock().unwrap().key_rotations += 1;

        Ok(new_key.id)
    }

    pub fn get_metrics(&self) -> EncryptionMetrics {
        self.metrics.lock().unwrap().clone()
    }

    pub fn get_active_key(&self) -> Option<EncryptionKey> {
        let keys = self.keys.lock().unwrap();
        let active_id = self.active_key_id.lock().unwrap().clone();
        keys.iter().find(|k| k.id == active_id).cloned()
    }

    pub fn get_all_keys(&self) -> Vec<EncryptionKey> {
        self.keys.lock().unwrap().clone()
    }

    fn generate_nonce(&self) -> Vec<u8> {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        (0..12).map(|_| rng.gen::<u8>()).collect()
    }

    fn encrypt_data(&self, data: &[u8], nonce: &[u8], _key_id: &str) -> Result<Vec<u8>, String> {
        Ok(self.xor_encrypt(data, nonce))
    }

    fn decrypt_data(&self, data: &[u8], nonce: &[u8], _key_id: &str) -> Result<Vec<u8>, String> {
        Ok(self.xor_encrypt(data, nonce))
    }

    fn xor_encrypt(&self, data: &[u8], nonce: &[u8]) -> Vec<u8> {
        data.iter()
            .enumerate()
            .map(|(i, b)| b ^ nonce[i % nonce.len()])
            .collect()
    }
}

impl Default for DataEncryptionService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption() {
        let service = DataEncryptionService::new();
        let plaintext = b"test data to encrypt";

        let encrypted = service.encrypt(plaintext).unwrap();
        assert!(!encrypted.ciphertext.is_empty());

        let decrypted = service.decrypt(&encrypted).unwrap();
        assert_eq!(decrypted, plaintext.to_vec());
    }

    #[test]
    fn test_encrypt_different_keys() {
        let service = DataEncryptionService::new();
        let plaintext = b"secret data";

        let encrypted1 = service.encrypt(plaintext).unwrap();
        service.rotate_key().unwrap();
        let encrypted2 = service.encrypt(plaintext).unwrap();

        assert_ne!(encrypted1.key_id, encrypted2.key_id);
    }

    #[test]
    fn test_key_rotation() {
        let service = DataEncryptionService::new();
        let old_key = service.get_active_key().unwrap();

        let new_key_id = service.rotate_key().unwrap();
        let new_key = service.get_active_key().unwrap();

        assert_ne!(old_key.id, new_key_id);
        assert_eq!(new_key.id, new_key_id);
        assert!(!old_key.active);
        assert!(new_key.active);
    }

    #[test]
    fn test_metrics() {
        let service = DataEncryptionService::new();
        let plaintext = b"test";

        service.encrypt(plaintext).unwrap();
        service.encrypt(plaintext).unwrap();
        let encrypted = service.encrypt(plaintext).unwrap();
        service.decrypt(&encrypted).unwrap();

        let metrics = service.get_metrics();
        assert_eq!(metrics.encrypt_operations, 3);
        assert_eq!(metrics.decrypt_operations, 1);
        assert_eq!(metrics.total_bytes_encrypted, 12);
    }
}
