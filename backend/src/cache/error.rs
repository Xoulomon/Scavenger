//! Cache error types and utilities.

use thiserror::Error;

/// Cache operation result type.
pub type CacheResult<T> = Result<T, CacheError>;

/// Cache operation errors.
#[derive(Debug, Error)]
pub enum CacheError {
    /// Serialization error.
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    /// Deserialization error.
    #[error("Deserialization error: {0}")]
    Deserialization(String),
    
    /// Connection error.
    #[error("Connection error: {0}")]
    Connection(String),
    
    /// Timeout error.
    #[error("Operation timeout: {0}")]
    Timeout(String),
    
    /// Key not found (non-error for get operations).
    #[error("Key not found: {0}")]
    NotFound(String),
    
    /// Invalid operation.
    #[error("Invalid operation: {0}")]
    InvalidOperation(String),
    
    /// Cache backend error.
    #[error("Backend error: {0}")]
    Backend(String),
    
    /// Configuration error.
    #[error("Configuration error: {0}")]
    Configuration(String),
    
    /// Memory limit exceeded.
    #[error("Memory limit exceeded: {0}")]
    MemoryLimit(String),
    
    /// IO error.
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    /// Generic error.
    #[error("Cache error: {0}")]
    Generic(String),
}

impl CacheError {
    /// Check if error is recoverable (cache can continue operating).
    pub fn is_recoverable(&self) -> bool {
        match self {
            CacheError::NotFound(_) => true,  // Not found is expected
            CacheError::Connection(_) => true, // Can retry connection
            CacheError::Timeout(_) => true,   // Can retry timeout
            CacheError::Backend(_) => true,   // Backend might recover
            _ => false,
        }
    }
    
    /// Check if error indicates cache is unavailable.
    pub fn is_unavailable(&self) -> bool {
        match self {
            CacheError::Connection(_) => true,
            CacheError::Backend(_) => true,
            CacheError::Configuration(_) => true,
            _ => false,
        }
    }
    
    /// Convert to a user-friendly message.
    pub fn user_message(&self) -> String {
        match self {
            CacheError::NotFound(key) => format!("Cache entry not found: {}", key),
            CacheError::Connection(msg) => format!("Cache connection issue: {}", msg),
            CacheError::Timeout(msg) => format!("Cache operation timed out: {}", msg),
            CacheError::MemoryLimit(msg) => format!("Cache memory limit reached: {}", msg),
            _ => "Cache operation failed".to_string(),
        }
    }
}

impl From<String> for CacheError {
    fn from(err: String) -> Self {
        CacheError::Generic(err)
    }
}

impl From<&str> for CacheError {
    fn from(err: &str) -> Self {
        CacheError::Generic(err.to_string())
    }
}

/// Cache metrics for monitoring.
#[derive(Debug, Clone, Default)]
pub struct CacheMetrics {
    /// Total operations performed.
    pub total_operations: u64,
    
    /// Successful operations.
    pub successful_operations: u64,
    
    /// Failed operations.
    pub failed_operations: u64,
    
    /// Cache hits.
    pub hits: u64,
    
    /// Cache misses.
    pub misses: u64,
    
    /// Average operation latency in milliseconds.
    pub average_latency_ms: f64,
    
    /// Current cache size in bytes.
    pub cache_size_bytes: u64,
    
    /// Number of items in cache.
    pub item_count: u64,
}

impl CacheMetrics {
    /// Record a successful operation.
    pub fn record_success(&mut self, latency_ms: f64) {
        self.total_operations += 1;
        self.successful_operations += 1;
        self.update_average_latency(latency_ms);
    }
    
    /// Record a failed operation.
    pub fn record_failure(&mut self, latency_ms: f64) {
        self.total_operations += 1;
        self.failed_operations += 1;
        self.update_average_latency(latency_ms);
    }
    
    /// Record a cache hit.
    pub fn record_hit(&mut self) {
        self.hits += 1;
    }
    
    /// Record a cache miss.
    pub fn record_miss(&mut self) {
        self.misses += 1;
    }
    
    /// Update cache size.
    pub fn update_size(&mut self, size_bytes: u64, item_count: u64) {
        self.cache_size_bytes = size_bytes;
        self.item_count = item_count;
    }
    
    /// Get hit rate (0.0 to 1.0).
    pub fn hit_rate(&self) -> f64 {
        let total_accesses = self.hits + self.misses;
        if total_accesses > 0 {
            self.hits as f64 / total_accesses as f64
        } else {
            0.0
        }
    }
    
    /// Get success rate (0.0 to 1.0).
    pub fn success_rate(&self) -> f64 {
        if self.total_operations > 0 {
            self.successful_operations as f64 / self.total_operations as f64
        } else {
            0.0
        }
    }
    
    fn update_average_latency(&mut self, new_latency_ms: f64) {
        let total_ops = self.total_operations as f64;
        if total_ops == 1.0 {
            self.average_latency_ms = new_latency_ms;
        } else {
            self.average_latency_ms = (self.average_latency_ms * (total_ops - 1.0) + new_latency_ms) / total_ops;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_cache_error_recoverable() {
        assert!(CacheError::NotFound("key".to_string()).is_recoverable());
        assert!(CacheError::Connection("failed".to_string()).is_recoverable());
        assert!(CacheError::Timeout("timeout".to_string()).is_recoverable());
        assert!(CacheError::Backend("error".to_string()).is_recoverable());
        
        assert!(!CacheError::Serialization(serde_json::Error::custom("test")).is_recoverable());
        assert!(!CacheError::Configuration("config".to_string()).is_recoverable());
    }
    
    #[test]
    fn test_cache_error_unavailable() {
        assert!(CacheError::Connection("failed".to_string()).is_unavailable());
        assert!(CacheError::Backend("error".to_string()).is_unavailable());
        assert!(CacheError::Configuration("config".to_string()).is_unavailable());
        
        assert!(!CacheError::NotFound("key".to_string()).is_unavailable());
        assert!(!CacheError::Timeout("timeout".to_string()).is_unavailable());
    }
    
    #[test]
    fn test_cache_metrics() {
        let mut metrics = CacheMetrics::default();
        
        metrics.record_success(10.0);
        metrics.record_success(20.0);
        metrics.record_failure(30.0);
        
        metrics.record_hit();
        metrics.record_hit();
        metrics.record_miss();
        
        metrics.update_size(1024, 10);
        
        assert_eq!(metrics.total_operations, 3);
        assert_eq!(metrics.successful_operations, 2);
        assert_eq!(metrics.failed_operations, 1);
        assert_eq!(metrics.hits, 2);
        assert_eq!(metrics.misses, 1);
        assert_eq!(metrics.cache_size_bytes, 1024);
        assert_eq!(metrics.item_count, 10);
        
        // Hit rate should be 2/3 ≈ 0.666...
        assert!((metrics.hit_rate() - 0.666).abs() < 0.001);
        
        // Success rate should be 2/3 ≈ 0.666...
        assert!((metrics.success_rate() - 0.666).abs() < 0.001);
        
        // Average latency should be (10 + 20 + 30) / 3 = 20.0
        assert!((metrics.average_latency_ms - 20.0).abs() < 0.001);
    }
    
    #[test]
    fn test_cache_metrics_edge_cases() {
        let metrics = CacheMetrics::default();
        
        // No operations should give 0.0 rates
        assert_eq!(metrics.hit_rate(), 0.0);
        assert_eq!(metrics.success_rate(), 0.0);
        assert_eq!(metrics.average_latency_ms, 0.0);
    }
    
    #[test]
    fn test_cache_error_user_message() {
        let not_found = CacheError::NotFound("my-key".to_string());
        assert!(not_found.user_message().contains("not found"));
        
        let connection = CacheError::Connection("connection refused".to_string());
        assert!(connection.user_message().contains("connection issue"));
        
        let timeout = CacheError::Timeout("operation timed out".to_string());
        assert!(timeout.user_message().contains("timed out"));
        
        let memory = CacheError::MemoryLimit("limit exceeded".to_string());
        assert!(memory.user_message().contains("memory limit"));
    }
}