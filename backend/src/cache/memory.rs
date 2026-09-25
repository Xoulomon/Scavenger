//! In-memory cache backend implementation.
//!
//! Provides a fast, thread-safe in-memory cache with LRU eviction policy
//! and TTL support.

use super::{
    CacheBackend, CacheEntry, CacheError, CacheKey, CacheResult, CacheStats,
};
use async_trait::async_trait;
use dashmap::DashMap;
use lru::LruCache;
use serde::{de::DeserializeOwned, Serialize};
use std::hash::Hash;
use std::num::NonZeroUsize;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// In-memory cache backend with LRU eviction.
pub struct MemoryBackend {
    /// Primary cache storage.
    cache: Arc<DashMap<CacheKey, CacheEntry<String>>>,
    
    /// LRU tracking for eviction.
    lru: Arc<RwLock<LruCache<CacheKey, ()>>>,
    
    /// Maximum number of items.
    max_items: usize,
    
    /// Current cache size in bytes.
    size_bytes: Arc<RwLock<usize>>,
    
    /// Cache metrics.
    metrics: Arc<RwLock<super::error::CacheMetrics>>,
}

impl MemoryBackend {
    /// Create a new memory cache with specified capacity.
    pub fn new(max_items: usize) -> Self {
        let lru_capacity = NonZeroUsize::new(max_items).unwrap_or(NonZeroUsize::new(1000).unwrap());
        
        Self {
            cache: Arc::new(DashMap::new()),
            lru: Arc::new(RwLock::new(LruCache::new(lru_capacity))),
            max_items,
            size_bytes: Arc::new(RwLock::new(0)),
            metrics: Arc::new(RwLock::new(super::error::CacheMetrics::default())),
        }
    }
    
    /// Clean up expired entries.
    async fn cleanup_expired(&self) {
        let start_time = Instant::now();
        let mut expired_keys = Vec::new();
        let mut freed_bytes = 0;
        
        // Collect expired keys
        for entry in self.cache.iter() {
            let (key, cache_entry) = entry.pair();
            if cache_entry.is_expired() {
                expired_keys.push(key.clone());
                freed_bytes += cache_entry.value.len();
            }
        }
        
        // Remove expired entries
        for key in expired_keys {
            if let Some((_, entry)) = self.cache.remove(&key) {
                self.remove_from_lru(&key).await;
                freed_bytes += entry.value.len();
            }
        }
        
        // Update size
        if freed_bytes > 0 {
            let mut size = self.size_bytes.write().await;
            *size = size.saturating_sub(freed_bytes);
        }
        
        // Update metrics
        let cleanup_duration = start_time.elapsed();
        let mut metrics = self.metrics.write().await;
        metrics.record_success(cleanup_duration.as_millis() as f64);
    }
    
    /// Add key to LRU tracker.
    async fn add_to_lru(&self, key: &CacheKey) {
        let mut lru = self.lru.write().await;
        lru.put(key.clone(), ());
    }
    
    /// Remove key from LRU tracker.
    async fn remove_from_lru(&self, key: &CacheKey) {
        let mut lru = self.lru.write().await;
        lru.pop(key);
    }
    
    /// Touch key in LRU (mark as recently used).
    async fn touch_lru(&self, key: &CacheKey) {
        let mut lru = self.lru.write().await;
        lru.get(key); // Just getting it touches it in LRU
    }
    
    /// Evict least recently used item if at capacity.
    async fn evict_if_needed(&self) -> CacheResult<()> {
        let current_size = *self.size_bytes.read().await;
        let item_count = self.cache.len();
        
        // Check if we need to evict based on item count
        if item_count >= self.max_items {
            let mut lru = self.lru.write().await;
            if let Some((key, _)) = lru.pop_lru() {
                if let Some((_, entry)) = self.cache.remove(&key) {
                    let mut size = self.size_bytes.write().await;
                    *size = size.saturating_sub(entry.value.len());
                    
                    let mut metrics = self.metrics.write().await;
                    metrics.record_failure(0.0); // Count eviction as "failure" for stats
                }
            }
        }
        
        Ok(())
    }
    
    /// Serialize value to string for storage.
    fn serialize_value<V>(value: &V) -> CacheResult<String>
    where
        V: Serialize,
    {
        serde_json::to_string(value).map_err(CacheError::from)
    }
    
    /// Deserialize value from string.
    fn deserialize_value<V>(json: &str) -> CacheResult<V>
    where
        V: DeserializeOwned,
    {
        serde_json::from_str(json).map_err(|e| CacheError::Deserialization(e.to_string()))
    }
    
    /// Update size metrics.
    async fn update_size_metrics(&self, key: &CacheKey, old_value: Option<&str>, new_value: &str) {
        let size_change = new_value.len() as i64 - old_value.map(|v| v.len() as i64).unwrap_or(0);
        
        let mut size = self.size_bytes.write().await;
        if size_change > 0 {
            *size = size.saturating_add(size_change as usize);
        } else {
            *size = size.saturating_sub((-size_change) as usize);
        }
        
        let mut metrics = self.metrics.write().await;
        metrics.update_size(*size, self.cache.len() as u64);
    }
}

#[async_trait]
impl CacheBackend for MemoryBackend {
    async fn get<V>(&self, key: &CacheKey) -> CacheResult<Option<CacheEntry<V>>>
    where
        V: DeserializeOwned + Send + Sync,
    {
        let start_time = Instant::now();
        
        // Clean up expired entries periodically
        if start_time.elapsed().as_secs() % 60 == 0 {
            self.cleanup_expired().await;
        }
        
        match self.cache.get(key) {
            Some(entry_ref) => {
                let entry = entry_ref.value();
                
                // Check if expired
                if entry.is_expired() {
                    // Remove expired entry
                    self.cache.remove(key);
                    self.remove_from_lru(key).await;
                    
                    let mut metrics = self.metrics.write().await;
                    metrics.record_miss();
                    metrics.record_failure(start_time.elapsed().as_millis() as f64);
                    
                    return Ok(None);
                }
                
                // Touch in LRU
                self.touch_lru(key).await;
                
                // Deserialize value
                let value = Self::deserialize_value(&entry.value)?;
                
                let result = CacheEntry {
                    value,
                    ttl: entry.ttl,
                    created_at: entry.created_at,
                };
                
                // Update metrics
                let duration = start_time.elapsed();
                let mut metrics = self.metrics.write().await;
                metrics.record_success(duration.as_millis() as f64);
                metrics.record_hit();
                
                Ok(Some(result))
            }
            None => {
                // Update metrics
                let duration = start_time.elapsed();
                let mut metrics = self.metrics.write().await;
                metrics.record_success(duration.as_millis() as f64);
                metrics.record_miss();
                
                Ok(None)
            }
        }
    }
    
    async fn set<V>(&self, key: &CacheKey, value: V, ttl: Option<Duration>) -> CacheResult<()>
    where
        V: Serialize + Send + Sync,
    {
        let start_time = Instant::now();
        
        // Clean up if needed
        self.cleanup_expired().await;
        
        // Serialize value
        let serialized = Self::serialize_value(&value)?;
        
        // Check current value for size calculation
        let old_value = self.cache.get(key).map(|entry| entry.value().value.as_str());
        
        // Create cache entry
        let cache_entry = CacheEntry {
            value: serialized.clone(),
            ttl,
            created_at: Instant::now(),
        };
        
        // Store in cache
        self.cache.insert(key.clone(), cache_entry);
        
        // Add to LRU
        self.add_to_lru(key).await;
        
        // Update size metrics
        self.update_size_metrics(key, old_value, &serialized).await;
        
        // Evict if needed
        self.evict_if_needed().await?;
        
        // Update metrics
        let duration = start_time.elapsed();
        let mut metrics = self.metrics.write().await;
        metrics.record_success(duration.as_millis() as f64);
        
        Ok(())
    }
    
    async fn delete(&self, key: &CacheKey) -> CacheResult<()> {
        let start_time = Instant::now();
        
        if let Some((_, entry)) = self.cache.remove(key) {
            // Update size
            let mut size = self.size_bytes.write().await;
            *size = size.saturating_sub(entry.value.len());
            
            // Remove from LRU
            self.remove_from_lru(key).await;
            
            // Update metrics
            let mut metrics = self.metrics.write().await;
            metrics.update_size(*size, self.cache.len() as u64);
        }
        
        let duration = start_time.elapsed();
        let mut metrics = self.metrics.write().await;
        metrics.record_success(duration.as_millis() as f64);
        
        Ok(())
    }
    
    async fn exists(&self, key: &CacheKey) -> CacheResult<bool> {
        let start_time = Instant::now();
        
        let exists = match self.cache.get(key) {
            Some(entry) => {
                if entry.is_expired() {
                    // Clean up expired entry
                    self.cache.remove(key);
                    self.remove_from_lru(key).await;
                    false
                } else {
                    true
                }
            }
            None => false,
        };
        
        let duration = start_time.elapsed();
        let mut metrics = self.metrics.write().await;
        metrics.record_success(duration.as_millis() as f64);
        
        Ok(exists)
    }
    
    async fn set_many<V>(&self, items: Vec<(CacheKey, V)>, ttl: Option<Duration>) -> CacheResult<()>
    where
        V: Serialize + Send + Sync,
    {
        let start_time = Instant::now();
        
        for (key, value) in items {
            self.set(&key, value, ttl).await?;
        }
        
        let duration = start_time.elapsed();
        let mut metrics = self.metrics.write().await;
        metrics.record_success(duration.as_millis() as f64);
        
        Ok(())
    }
    
    async fn get_many<V>(&self, keys: Vec<CacheKey>) -> CacheResult<Vec<Option<CacheEntry<V>>>>
    where
        V: DeserializeOwned + Send + Sync,
    {
        let start_time = Instant::now();
        let mut results = Vec::with_capacity(keys.len());
        
        for key in keys {
            let result = self.get(&key).await?;
            results.push(result);
        }
        
        let duration = start_time.elapsed();
        let mut metrics = self.metrics.write().await;
        metrics.record_success(duration.as_millis() as f64);
        
        Ok(results)
    }
    
    async fn clear(&self) -> CacheResult<()> {
        let start_time = Instant::now();
        
        self.cache.clear();
        
        // Clear LRU
        let mut lru = self.lru.write().await;
        lru.clear();
        
        // Reset size
        let mut size = self.size_bytes.write().await;
        *size = 0;
        
        // Update metrics
        let mut metrics = self.metrics.write().await;
        metrics.update_size(0, 0);
        
        let duration = start_time.elapsed();
        metrics.record_success(duration.as_millis() as f64);
        
        Ok(())
    }
    
    async fn stats(&self) -> CacheResult<CacheStats> {
        let metrics = self.metrics.read().await;
        let size = *self.size_bytes.read().await;
        let item_count = self.cache.len();
        
        Ok(CacheStats {
            item_count,
            memory_usage: size,
            hit_rate: metrics.hit_rate(),
            miss_rate: 1.0 - metrics.hit_rate(),
            evictions: (metrics.failed_operations / 2) as usize, // Rough estimate
        })
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
    
    #[tokio::test]
    async fn test_memory_backend_basic() {
        let backend = MemoryBackend::new(100);
        
        let data = TestData {
            id: "test-1".to_string(),
            value: 42,
        };
        
        // Test set and get
        backend.set("key1", &data, Some(Duration::from_secs(60))).await.unwrap();
        
        let retrieved: Option<CacheEntry<TestData>> = backend.get("key1").await.unwrap();
        assert!(retrieved.is_some());
        
        let entry = retrieved.unwrap();
        assert_eq!(entry.value, data);
        assert!(entry.ttl.is_some());
        
        // Test exists
        let exists = backend.exists("key1").await.unwrap();
        assert!(exists);
        
        // Test delete
        backend.delete("key1").await.unwrap();
        let deleted: Option<CacheEntry<TestData>> = backend.get("key1").await.unwrap();
        assert!(deleted.is_none());
    }
    
    #[tokio::test]
    async fn test_memory_backend_expiry() {
        let backend = MemoryBackend::new(100);
        
        let data = TestData {
            id: "test-1".to_string(),
            value: 42,
        };
        
        // Set with very short TTL
        backend.set("key1", &data, Some(Duration::from_millis(10))).await.unwrap();
        
        // Should still be there immediately
        let retrieved: Option<CacheEntry<TestData>> = backend.get("key1").await.unwrap();
        assert!(retrieved.is_some());
        
        // Wait for expiry
        tokio::time::sleep(Duration::from_millis(20)).await;
        
        // Should be gone now
        let expired: Option<CacheEntry<TestData>> = backend.get("key1").await.unwrap();
        assert!(expired.is_none());
    }
    
    #[tokio::test]
    async fn test_memory_backend_lru_eviction() {
        let backend = MemoryBackend::new(2); // Very small cache
        
        let data = TestData {
            id: "test".to_string(),
            value: 42,
        };
        
        // Fill cache
        backend.set("key1", &data, None).await.unwrap();
        backend.set("key2", &data, None).await.unwrap();
        
        // Access key1 to make it recently used
        backend.get::<TestData>("key1").await.unwrap();
        
        // Add third item - should evict key2 (least recently used)
        backend.set("key3", &data, None).await.unwrap();
        
        // key2 should be evicted
        let key2_result: Option<CacheEntry<TestData>> = backend.get("key2").await.unwrap();
        assert!(key2_result.is_none());
        
        // key1 and key3 should still be there
        let key1_result: Option<CacheEntry<TestData>> = backend.get("key1").await.unwrap();
        assert!(key1_result.is_some());
        
        let key3_result: Option<CacheEntry<TestData>> = backend.get("key3").await.unwrap();
        assert!(key3_result.is_some());
    }
    
    #[tokio::test]
    async fn test_memory_backend_set_many() {
        let backend = MemoryBackend::new(100);
        
        let data = TestData {
            id: "test".to_string(),
            value: 42,
        };
        
        let items = vec![
            ("key1".to_string(), &data),
            ("key2".to_string(), &data),
            ("key3".to_string(), &data),
        ];
        
        backend.set_many(items, Some(Duration::from_secs(60))).await.unwrap();
        
        // All keys should exist
        assert!(backend.exists("key1").await.unwrap());
        assert!(backend.exists("key2").await.unwrap());
        assert!(backend.exists("key3").await.unwrap());
    }
    
    #[tokio::test]
    async fn test_memory_backend_get_many() {
        let backend = MemoryBackend::new(100);
        
        let data = TestData {
            id: "test".to_string(),
            value: 42,
        };
        
        backend.set("key1", &data, None).await.unwrap();
        backend.set("key2", &data, None).await.unwrap();
        
        let keys = vec!["key1".to_string(), "key2".to_string(), "key3".to_string()];
        let results = backend.get_many::<TestData>(keys).await.unwrap();
        
        assert_eq!(results.len(), 3);
        assert!(results[0].is_some());
        assert!(results[1].is_some());
        assert!(results[2].is_none());
    }
    
    #[tokio::test]
    async fn test_memory_backend_clear() {
        let backend = MemoryBackend::new(100);
        
        let data = TestData {
            id: "test".to_string(),
            value: 42,
        };
        
        backend.set("key1", &data, None).await.unwrap();
        backend.set("key2", &data, None).await.unwrap();
        
        let stats_before = backend.stats().await.unwrap();
        assert_eq!(stats_before.item_count, 2);
        
        backend.clear().await.unwrap();
        
        let stats_after = backend.stats().await.unwrap();
        assert_eq!(stats_after.item_count, 0);
        assert_eq!(stats_after.memory_usage, 0);
    }
    
    #[tokio::test]
    async fn test_memory_backend_stats() {
        let backend = MemoryBackend::new(100);
        
        let data = TestData {
            id: "test".to_string(),
            value: 42,
        };
        
        // Perform some operations
        backend.set("key1", &data, None).await.unwrap();
        backend.get::<TestData>("key1").await.unwrap(); // Hit
        backend.get::<TestData>("key2").await.unwrap(); // Miss
        
        let stats = backend.stats().await.unwrap();
        
        assert_eq!(stats.item_count, 1);
        assert!(stats.memory_usage > 0);
        assert!((stats.hit_rate - 0.5).abs() < 0.01); // 1 hit, 1 miss = 0.5 hit rate
        assert!((stats.miss_rate - 0.5).abs() < 0.01); // 1 hit, 1 miss = 0.5 miss rate
    }
}