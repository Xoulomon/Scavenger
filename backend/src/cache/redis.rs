//! Redis cache backend implementation.
//!
//! Provides Redis-based caching with connection pooling, automatic
//! reconnection, and comprehensive error handling.

use super::{
    CacheBackend, CacheEntry, CacheError, CacheKey, CacheResult, CacheStats,
};
use async_trait::async_trait;
use redis::{AsyncCommands, Client, RedisError};
use serde::{de::DeserializeOwned, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

/// Redis cache backend.
pub struct RedisBackend {
    /// Redis client.
    client: Client,
    
    /// Connection pool.
    connection: Arc<Mutex<Option<redis::aio::Connection>>>,
    
    /// Redis connection URL.
    redis_url: String,
    
    /// Connection timeout.
    connection_timeout: Duration,
    
    /// Operation timeout.
    operation_timeout: Duration,
    
    /// Whether to automatically reconnect.
    auto_reconnect: bool,
    
    /// Last connection attempt.
    last_connection_attempt: Arc<Mutex<Option<Instant>>>,
    
    /// Cache metrics.
    metrics: Arc<Mutex<super::error::CacheMetrics>>,
}

impl RedisBackend {
    /// Create a new Redis backend.
    pub fn new(redis_url: &str) -> CacheResult<Self> {
        let client = Client::open(redis_url)
            .map_err(|e| CacheError::Configuration(format!("Failed to create Redis client: {}", e)))?;
        
        Ok(Self {
            client,
            connection: Arc::new(Mutex::new(None)),
            redis_url: redis_url.to_string(),
            connection_timeout: Duration::from_secs(5),
            operation_timeout: Duration::from_secs(10),
            auto_reconnect: true,
            last_connection_attempt: Arc::new(Mutex::new(None)),
            metrics: Arc::new(Mutex::new(super::error::CacheMetrics::default())),
        })
    }
    
    /// Set connection timeout.
    pub fn with_connection_timeout(mut self, timeout: Duration) -> Self {
        self.connection_timeout = timeout;
        self
    }
    
    /// Set operation timeout.
    pub fn with_operation_timeout(mut self, timeout: Duration) -> Self {
        self.operation_timeout = timeout;
        self
    }
    
    /// Disable auto-reconnect.
    pub fn without_auto_reconnect(mut self) -> Self {
        self.auto_reconnect = false;
        self
    }
    
    /// Get or create Redis connection.
    async fn get_connection(&self) -> CacheResult<redis::aio::Connection> {
        let mut connection_guard = self.connection.lock().await;
        
        // Check if we have a valid connection
        if let Some(conn) = connection_guard.as_mut() {
            // Ping to check if connection is still alive
            match tokio::time::timeout(
                Duration::from_secs(1),
                redis::cmd("PING").query_async(conn),
            ).await {
                Ok(Ok(_)) => {
                    // Connection is alive, return it
                    return Ok(conn.clone());
                }
                _ => {
                    // Connection is dead, drop it
                    *connection_guard = None;
                }
            }
        }
        
        // Check if we should attempt reconnection
        if !self.auto_reconnect {
            return Err(CacheError::Connection("Auto-reconnect disabled".to_string()));
        }
        
        // Check rate limiting
        let mut last_attempt_guard = self.last_connection_attempt.lock().await;
        if let Some(last_attempt) = *last_attempt_guard {
            if last_attempt.elapsed() < Duration::from_secs(1) {
                return Err(CacheError::Connection(
                    "Rate limited: too many connection attempts".to_string(),
                ));
            }
        }
        
        *last_attempt_guard = Some(Instant::now());
        drop(last_attempt_guard);
        
        // Create new connection with timeout
        let connect_result = tokio::time::timeout(
            self.connection_timeout,
            self.client.get_async_connection(),
        )
        .await;
        
        match connect_result {
            Ok(Ok(conn)) => {
                // Store the connection
                let cloned_conn = conn.clone();
                *connection_guard = Some(conn);
                
                // Update metrics
                let mut metrics = self.metrics.lock().await;
                metrics.record_success(0.0);
                
                Ok(cloned_conn)
            }
            Ok(Err(e)) => {
                let error_msg = format!("Failed to connect to Redis: {}", e);
                log::error!("{}", error_msg);
                
                let mut metrics = self.metrics.lock().await;
                metrics.record_failure(0.0);
                
                Err(CacheError::Connection(error_msg))
            }
            Err(_) => {
                let error_msg = format!(
                    "Connection timeout after {:?}",
                    self.connection_timeout
                );
                log::error!("{}", error_msg);
                
                let mut metrics = self.metrics.lock().await;
                metrics.record_failure(0.0);
                
                Err(CacheError::Timeout(error_msg))
            }
        }
    }
    
    /// Execute Redis command with timeout.
    async fn execute_command<T, F>(&self, command: F) -> CacheResult<T>
    where
        F: FnOnce(&mut redis::aio::Connection) -> redis::RedisFuture<T> + Send,
        T: Send + 'static,
    {
        let start_time = Instant::now();
        
        let mut conn = self.get_connection().await?;
        
        let result = tokio::time::timeout(self.operation_timeout, command(&mut conn)).await;
        
        match result {
            Ok(Ok(value)) => {
                let duration = start_time.elapsed();
                let mut metrics = self.metrics.lock().await;
                metrics.record_success(duration.as_millis() as f64);
                
                Ok(value)
            }
            Ok(Err(e)) => {
                let duration = start_time.elapsed();
                let mut metrics = self.metrics.lock().await;
                metrics.record_failure(duration.as_millis() as f64);
                
                Err(self.handle_redis_error(e))
            }
            Err(_) => {
                let duration = start_time.elapsed();
                let mut metrics = self.metrics.lock().await;
                metrics.record_failure(duration.as_millis() as f64);
                
                Err(CacheError::Timeout(format!(
                    "Operation timeout after {:?}",
                    self.operation_timeout
                )))
            }
        }
    }
    
    /// Handle Redis error and convert to CacheError.
    fn handle_redis_error(&self, error: RedisError) -> CacheError {
        let error_msg = error.to_string();
        
        if error.is_connection_dropped() || error.is_connection_refusal() {
            CacheError::Connection(error_msg)
        } else if error.is_timeout() {
            CacheError::Timeout(error_msg)
        } else {
            CacheError::Backend(error_msg)
        }
    }
    
    /// Serialize value to JSON string.
    fn serialize_value<V>(value: &V) -> CacheResult<String>
    where
        V: Serialize,
    {
        serde_json::to_string(value).map_err(CacheError::from)
    }
    
    /// Deserialize value from JSON string.
    fn deserialize_value<V>(json: &str) -> CacheResult<V>
    where
        V: DeserializeOwned,
    {
        serde_json::from_str(json).map_err(|e| CacheError::Deserialization(e.to_string()))
    }
    
    /// Build Redis key with prefix.
    fn build_redis_key(&self, key: &CacheKey) -> String {
        // Add namespace prefix to avoid key collisions
        format!("cache:{}", key)
    }
    
    /// Convert TTL to Redis EXPIRE format.
    fn ttl_to_redis_expire(&self, ttl: Option<Duration>) -> Option<usize> {
        ttl.map(|d| d.as_secs() as usize)
    }
}

#[async_trait]
impl CacheBackend for RedisBackend {
    async fn get<V>(&self, key: &CacheKey) -> CacheResult<Option<CacheEntry<V>>>
    where
        V: DeserializeOwned + Send + Sync,
    {
        let redis_key = self.build_redis_key(key);
        
        let json: Option<String> = self
            .execute_command(|conn| conn.get(&redis_key))
            .await?;
        
        match json {
            Some(json_str) => {
                // Parse the JSON to extract value and metadata
                // In a real implementation, we might store metadata separately
                let value = Self::deserialize_value(&json_str)?;
                
                // For Redis, we need to check TTL separately
                let ttl_seconds: Option<i64> = self
                    .execute_command(|conn| conn.ttl(&redis_key))
                    .await?;
                
                let ttl = ttl_seconds
                    .filter(|&ttl| ttl > 0)
                    .map(|ttl| Duration::from_secs(ttl as u64));
                
                let entry = CacheEntry {
                    value,
                    ttl,
                    created_at: Instant::now(), // Redis doesn't store creation time
                };
                
                // Update metrics
                let mut metrics = self.metrics.lock().await;
                metrics.record_hit();
                
                Ok(Some(entry))
            }
            None => {
                // Update metrics
                let mut metrics = self.metrics.lock().await;
                metrics.record_miss();
                
                Ok(None)
            }
        }
    }
    
    async fn set<V>(&self, key: &CacheKey, value: V, ttl: Option<Duration>) -> CacheResult<()>
    where
        V: Serialize + Send + Sync,
    {
        let redis_key = self.build_redis_key(key);
        let json = Self::serialize_value(&value)?;
        
        if let Some(expire_seconds) = self.ttl_to_redis_expire(ttl) {
            // SET with EXPIRE
            self.execute_command(|conn| async move {
                let mut pipe = redis::pipe();
                pipe.set(&redis_key, &json).ignore()
                    .expire(&redis_key, expire_seconds).ignore();
                pipe.query_async(conn).await
            })
            .await?;
        } else {
            // SET without expiration
            self.execute_command(|conn| conn.set(&redis_key, &json))
                .await?;
        }
        
        Ok(())
    }
    
    async fn delete(&self, key: &CacheKey) -> CacheResult<()> {
        let redis_key = self.build_redis_key(key);
        
        self.execute_command(|conn| conn.del(&redis_key))
            .await
            .map(|_: i64| ())
    }
    
    async fn exists(&self, key: &CacheKey) -> CacheResult<bool> {
        let redis_key = self.build_redis_key(key);
        
        self.execute_command(|conn| conn.exists(&redis_key))
            .await
    }
    
    async fn set_many<V>(&self, items: Vec<(CacheKey, V)>, ttl: Option<Duration>) -> CacheResult<()>
    where
        V: Serialize + Send + Sync,
    {
        // For Redis, we need to use pipeline for batch operations
        let mut pipe = redis::pipe();
        
        for (key, value) in items {
            let redis_key = self.build_redis_key(&key);
            let json = Self::serialize_value(&value)?;
            
            pipe.set(&redis_key, &json).ignore();
            
            if let Some(expire_seconds) = self.ttl_to_redis_expire(ttl) {
                pipe.expire(&redis_key, expire_seconds).ignore();
            }
        }
        
        self.execute_command(|conn| pipe.query_async(conn))
            .await
            .map(|_: ()| ())
    }
    
    async fn get_many<V>(&self, keys: Vec<CacheKey>) -> CacheResult<Vec<Option<CacheEntry<V>>>>
    where
        V: DeserializeOwned + Send + Sync,
    {
        let redis_keys: Vec<String> = keys.iter()
            .map(|k| self.build_redis_key(k))
            .collect();
        
        let json_values: Vec<Option<String>> = self
            .execute_command(|conn| conn.mget(&redis_keys))
            .await?;
        
        let mut results = Vec::with_capacity(json_values.len());
        
        for (i, json_opt) in json_values.into_iter().enumerate() {
            match json_opt {
                Some(json_str) => {
                    let value = Self::deserialize_value(&json_str)?;
                    
                    // Get TTL for this key
                    let ttl_seconds: Option<i64> = self
                        .execute_command(|conn| conn.ttl(&redis_keys[i]))
                        .await?;
                    
                    let ttl = ttl_seconds
                        .filter(|&ttl| ttl > 0)
                        .map(|ttl| Duration::from_secs(ttl as u64));
                    
                    let entry = CacheEntry {
                        value,
                        ttl,
                        created_at: Instant::now(),
                    };
                    
                    results.push(Some(entry));
                    
                    // Update metrics
                    let mut metrics = self.metrics.lock().await;
                    metrics.record_hit();
                }
                None => {
                    results.push(None);
                    
                    // Update metrics
                    let mut metrics = self.metrics.lock().await;
                    metrics.record_miss();
                }
            }
        }
        
        Ok(results)
    }
    
    async fn clear(&self) -> CacheResult<()> {
        // WARNING: This clears ALL keys with the cache: prefix
        let pattern = "cache:*";
        
        let keys: Vec<String> = self
            .execute_command(|conn| conn.keys(pattern))
            .await?;
        
        if !keys.is_empty() {
            self.execute_command(|conn| conn.del(keys))
                .await
                .map(|_: i64| ())?;
        }
        
        Ok(())
    }
    
    async fn stats(&self) -> CacheResult<CacheStats> {
        // Get Redis info
        let info: String = self
            .execute_command(|conn| conn.info())
            .await?;
        
        // Parse Redis info to get stats
        let mut used_memory = 0;
        let mut total_commands_processed = 0;
        
        for line in info.lines() {
            if line.starts_with("used_memory:") {
                if let Some(value) = line.split(':').nth(1) {
                    used_memory = value.trim().parse().unwrap_or(0);
                }
            } else if line.starts_with("total_commands_processed:") {
                if let Some(value) = line.split(':').nth(1) {
                    total_commands_processed = value.trim().parse().unwrap_or(0);
                }
            }
        }
        
        // Get cache keys count
        let pattern = "cache:*";
        let keys: Vec<String> = self
            .execute_command(|conn| conn.keys(pattern))
            .await?;
        
        let item_count = keys.len();
        
        // Get metrics
        let metrics = self.metrics.lock().await;
        
        Ok(CacheStats {
            item_count,
            memory_usage: used_memory,
            hit_rate: metrics.hit_rate(),
            miss_rate: 1.0 - metrics.hit_rate(),
            evictions: 0, // Redis handles evictions internally
        })
    }
}

impl Drop for RedisBackend {
    fn drop(&mut self) {
        // Attempt to clean up connection
        if self.auto_reconnect {
            log::debug!("RedisBackend dropping, connections will be cleaned up");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};
    use std::time::Duration;
    
    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct TestData {
        id: String,
        value: i32,
    }
    
    // Note: These tests require a Redis server to be running
    // They are marked as ignored by default
    
    #[tokio::test]
    #[ignore = "Requires Redis server"]
    async fn test_redis_backend_integration() {
        let backend = RedisBackend::new("redis://localhost:6379")
            .expect("Failed to create Redis backend");
        
        let data = TestData {
            id: "test-1".to_string(),
            value: 42,
        };
        
        // Test set and get
        backend.set("key1", &data, Some(Duration::from_secs(60))).await
            .expect("Failed to set value");
        
        let retrieved: Option<CacheEntry<TestData>> = backend.get("key1").await
            .expect("Failed to get value");
        assert!(retrieved.is_some());
        
        let entry = retrieved.unwrap();
        assert_eq!(entry.value, data);
        assert!(entry.ttl.is_some());
        
        // Test exists
        let exists = backend.exists("key1").await
            .expect("Failed to check existence");
        assert!(exists);
        
        // Test delete
        backend.delete("key1").await
            .expect("Failed to delete value");
        
        let deleted: Option<CacheEntry<TestData>> = backend.get("key1").await
            .expect("Failed to get deleted value");
        assert!(deleted.is_none());
    }
    
    #[tokio::test]
    #[ignore = "Requires Redis server"]
    async fn test_redis_backend_ttl() {
        let backend = RedisBackend::new("redis://localhost:6379")
            .expect("Failed to create Redis backend");
        
        let data = TestData {
            id: "test-1".to_string(),
            value: 42,
        };
        
        // Set with short TTL
        backend.set("key1", &data, Some(Duration::from_secs(1))).await
            .expect("Failed to set value with TTL");
        
        // Should exist immediately
        let immediate: Option<CacheEntry<TestData>> = backend.get("key1").await
            .expect("Failed to get value immediately");
        assert!(immediate.is_some());
        
        // Wait for expiration
        tokio::time::sleep(Duration::from_secs(2)).await;
        
        // Should be expired
        let expired: Option<CacheEntry<TestData>> = backend.get("key1").await
            .expect("Failed to get expired value");
        assert!(expired.is_none());
    }
    
    #[tokio::test]
    #[ignore = "Requires Redis server"]
    async fn test_redis_backend_set_many() {
        let backend = RedisBackend::new("redis://localhost:6379")
            .expect("Failed to create Redis backend");
        
        let data = TestData {
            id: "test".to_string(),
            value: 42,
        };
        
        let items = vec![
            ("key1".to_string(), &data),
            ("key2".to_string(), &data),
            ("key3".to_string(), &data),
        ];
        
        backend.set_many(items, Some(Duration::from_secs(60))).await
            .expect("Failed to set multiple values");
        
        // All keys should exist
        assert!(backend.exists("key1").await.expect("Failed to check key1"));
        assert!(backend.exists("key2").await.expect("Failed to check key2"));
        assert!(backend.exists("key3").await.expect("Failed to check key3"));
    }
    
    #[tokio::test]
    #[ignore = "Requires Redis server"]
    async fn test_redis_backend_get_many() {
        let backend = RedisBackend::new("redis://localhost:6379")
            .expect("Failed to create Redis backend");
        
        let data = TestData {
            id: "test".to_string(),
            value: 42,
        };
        
        backend.set("key1", &data, None).await.expect("Failed to set key1");
        backend.set("key2", &data, None).await.expect("Failed to set key2");
        
        let keys = vec!["key1".to_string(), "key2".to_string(), "key3".to_string()];
        let results = backend.get_many::<TestData>(keys).await
            .expect("Failed to get multiple values");
        
        assert_eq!(results.len(), 3);
        assert!(results[0].is_some());
        assert!(results[1].is_some());
        assert!(results[2].is_none());
    }
    
    #[test]
    fn test_redis_backend_configuration() {
        // Test invalid URL
        let result = RedisBackend::new("invalid://url");
        assert!(result.is_err());
        
        // Test valid URL format (even if server doesn't exist)
        let result = RedisBackend::new("redis://localhost:9999");
        assert!(result.is_ok()); // Client creation succeeds even if server is unreachable
    }
    
    #[test]
    fn test_serialization_deserialization() {
        let data = TestData {
            id: "test-1".to_string(),
            value: 42,
        };
        
        let json = RedisBackend::serialize_value(&data).expect("Failed to serialize");
        let deserialized: TestData = RedisBackend::deserialize_value(&json).expect("Failed to deserialize");
        
        assert_eq!(data, deserialized);
    }
    
    #[test]
    fn test_build_redis_key() {
        let backend = RedisBackend::new("redis://localhost:6379")
            .expect("Failed to create Redis backend");
        
        let key = "my-key";
        let redis_key = backend.build_redis_key(&key.to_string());
        
        assert_eq!(redis_key, "cache:my-key");
    }
    
    #[test]
    fn test_ttl_conversion() {
        let backend = RedisBackend::new("redis://localhost:6379")
            .expect("Failed to create Redis backend");
        
        // Test with TTL
        let ttl = Some(Duration::from_secs(60));
        let redis_ttl = backend.ttl_to_redis_expire(ttl);
        assert_eq!(redis_ttl, Some(60));
        
        // Test without TTL
        let no_ttl = None;
        let redis_no_ttl = backend.ttl_to_redis_expire(no_ttl);
        assert_eq!(redis_no_ttl, None);
    }
}