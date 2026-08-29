use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("Storage error: {0}")]
    ServiceError(String),
    #[error("Invalid file: {0}")]
    InvalidFile(String),
    #[error("File not found: {0}")]
    NotFound(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub file_id: String,
    pub filename: String,
    pub content_type: String,
    pub size: u64,
    pub created_at: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadRequest {
    pub filename: String,
    pub content_type: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedUrlRequest {
    pub file_id: String,
    pub expiration_seconds: u64,
}

#[async_trait::async_trait]
pub trait StorageService: Send + Sync {
    async fn upload_file(&self, request: UploadRequest) -> Result<FileMetadata, StorageError>;
    async fn delete_file(&self, file_id: &str) -> Result<(), StorageError>;
    async fn get_signed_url(&self, request: SignedUrlRequest) -> Result<String, StorageError>;
    async fn get_file_metadata(&self, file_id: &str) -> Result<FileMetadata, StorageError>;
}

pub struct S3StorageService {
    bucket: String,
    region: String,
}

impl S3StorageService {
    pub fn new(bucket: String, region: String) -> Self {
        Self { bucket, region }
    }

    fn validate_file(&self, request: &UploadRequest) -> Result<(), StorageError> {
        if request.data.is_empty() {
            return Err(StorageError::InvalidFile("Empty file".to_string()));
        }
        if request.filename.is_empty() {
            return Err(StorageError::InvalidFile("Empty filename".to_string()));
        }
        Ok(())
    }
}

#[async_trait::async_trait]
impl StorageService for S3StorageService {
    async fn upload_file(&self, request: UploadRequest) -> Result<FileMetadata, StorageError> {
        self.validate_file(&request)?;

        let file_id = uuid::Uuid::new_v4().to_string();
        let size = request.data.len() as u64;

        Ok(FileMetadata {
            file_id: file_id.clone(),
            filename: request.filename,
            content_type: request.content_type,
            size,
            created_at: chrono::Utc::now().to_rfc3339(),
            url: format!("https://{}.s3.{}.amazonaws.com/{}", self.bucket, self.region, file_id),
        })
    }

    async fn delete_file(&self, file_id: &str) -> Result<(), StorageError> {
        if file_id.is_empty() {
            return Err(StorageError::InvalidFile("Empty file_id".to_string()));
        }
        Ok(())
    }

    async fn get_signed_url(&self, request: SignedUrlRequest) -> Result<String, StorageError> {
        if request.file_id.is_empty() {
            return Err(StorageError::InvalidFile("Empty file_id".to_string()));
        }
        if request.expiration_seconds == 0 {
            return Err(StorageError::InvalidFile("Invalid expiration".to_string()));
        }

        Ok(format!(
            "https://{}.s3.{}.amazonaws.com/{}?expires={}",
            self.bucket, self.region, request.file_id, request.expiration_seconds
        ))
    }

    async fn get_file_metadata(&self, file_id: &str) -> Result<FileMetadata, StorageError> {
        if file_id.is_empty() {
            return Err(StorageError::NotFound("File not found".to_string()));
        }

        Ok(FileMetadata {
            file_id: file_id.to_string(),
            filename: "document.pdf".to_string(),
            content_type: "application/pdf".to_string(),
            size: 1024,
            created_at: chrono::Utc::now().to_rfc3339(),
            url: format!("https://{}.s3.{}.amazonaws.com/{}", self.bucket, self.region, file_id),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_validation() {
        let service = S3StorageService::new("bucket".to_string(), "us-east-1".to_string());
        let valid = UploadRequest {
            filename: "test.pdf".to_string(),
            content_type: "application/pdf".to_string(),
            data: vec![1, 2, 3],
        };
        assert!(service.validate_file(&valid).is_ok());

        let empty_data = UploadRequest {
            filename: "test.pdf".to_string(),
            content_type: "application/pdf".to_string(),
            data: vec![],
        };
        assert!(service.validate_file(&empty_data).is_err());
    }

    #[tokio::test]
    async fn test_upload_file() {
        let service = S3StorageService::new("bucket".to_string(), "us-east-1".to_string());
        let request = UploadRequest {
            filename: "test.pdf".to_string(),
            content_type: "application/pdf".to_string(),
            data: vec![1, 2, 3],
        };
        let result = service.upload_file(request).await;
        assert!(result.is_ok());
        let metadata = result.unwrap();
        assert_eq!(metadata.filename, "test.pdf");
        assert_eq!(metadata.size, 3);
    }

    #[tokio::test]
    async fn test_delete_file() {
        let service = S3StorageService::new("bucket".to_string(), "us-east-1".to_string());
        assert!(service.delete_file("file-id").await.is_ok());
        assert!(service.delete_file("").await.is_err());
    }

    #[tokio::test]
    async fn test_signed_url() {
        let service = S3StorageService::new("bucket".to_string(), "us-east-1".to_string());
        let request = SignedUrlRequest {
            file_id: "file-id".to_string(),
            expiration_seconds: 3600,
        };
        let result = service.get_signed_url(request).await;
        assert!(result.is_ok());
        assert!(result.unwrap().contains("expires=3600"));
    }

    #[tokio::test]
    async fn test_get_file_metadata() {
        let service = S3StorageService::new("bucket".to_string(), "us-east-1".to_string());
        let result = service.get_file_metadata("file-id").await;
        assert!(result.is_ok());
        let metadata = result.unwrap();
        assert_eq!(metadata.file_id, "file-id");
    }
}
