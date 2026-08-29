use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Clone, Debug)]
pub struct CacheMetrics {
    pub hits: u64,
    pub misses: u64,
    pub evictions: u64,
    pub errors: u64,
    pub total_requests: u64,
}

impl Default for CacheMetrics {
    fn default() -> Self {
        Self {
            hits: 0,
            misses: 0,
            evictions: 0,
            errors: 0,
            total_requests: 0,
        }
    }
}

impl CacheMetrics {
    pub fn hit_rate(&self) -> f64 {
        if self.total_requests == 0 {
            0.0
        } else {
            self.hits as f64 / self.total_requests as f64
        }
    }

    pub fn record_hit(&mut self) {
        self.hits += 1;
        self.total_requests += 1;
    }

    pub fn record_miss(&mut self) {
        self.misses += 1;
        self.total_requests += 1;
    }

    pub fn record_eviction(&mut self) {
        self.evictions += 1;
    }

    pub fn record_error(&mut self) {
        self.errors += 1;
    }
}

#[derive(Clone)]
struct CacheEntry {
    data: Vec<u8>,
    expires_at: Instant,
}

#[derive(Clone)]
pub struct Cache {
    store: Arc<Mutex<HashMap<String, CacheEntry>>>,
    default_ttl: Duration,
    metrics: Arc<Mutex<CacheMetrics>>,
}

impl Cache {
    pub fn new(default_ttl_secs: u64) -> Self {
        Self {
            store: Arc::new(Mutex::new(HashMap::new())),
            default_ttl: Duration::from_secs(default_ttl_secs),
            metrics: Arc::new(Mutex::new(CacheMetrics::default())),
        }
    }

    pub fn get(&self, key: &str) -> Option<Vec<u8>> {
        let mut metrics = self.metrics.lock().unwrap();
        if let Ok(store) = self.store.lock() {
            if let Some(entry) = store.get(key) {
                if entry.expires_at > Instant::now() {
                    metrics.record_hit();
                    return Some(entry.data.clone());
                }
            }
        }
        metrics.record_miss();
        None
    }

    pub fn set(&self, key: String, data: Vec<u8>) {
        self.set_with_ttl(key, data, self.default_ttl);
    }

    pub fn set_with_ttl(&self, key: String, data: Vec<u8>, ttl: Duration) {
        if let Ok(mut store) = self.store.lock() {
            if store.len() >= 10000 {
                self.metrics.lock().unwrap().record_eviction();
                store.clear();
            }
            store.insert(
                key,
                CacheEntry {
                    data,
                    expires_at: Instant::now() + ttl,
                },
            );
        }
    }

    pub fn invalidate(&self, key: &str) {
        if let Ok(mut store) = self.store.lock() {
            store.remove(key);
        }
    }

    pub fn clear(&self) {
        if let Ok(mut store) = self.store.lock() {
            store.clear();
        }
    }

    pub fn cleanup(&self) {
        if let Ok(mut store) = self.store.lock() {
            store.retain(|_, entry| entry.expires_at > Instant::now());
        }
    }

    pub fn len(&self) -> usize {
        self.store.lock().map(|s| s.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn get_metrics(&self) -> CacheMetrics {
        self.metrics.lock().unwrap().clone()
    }

    pub fn invalidate_pattern(&self, pattern: &str) {
        if let Ok(mut store) = self.store.lock() {
            let keys: Vec<String> = store.keys().filter(|k| k.contains(pattern)).cloned().collect();
            for key in keys {
                store.remove(&key);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_set_get() {
        let cache = Cache::new(60);
        cache.set("key1".to_string(), b"value1".to_vec());
        assert_eq!(cache.get("key1"), Some(b"value1".to_vec()));
    }

    #[test]
    fn test_cache_miss() {
        let cache = Cache::new(60);
        assert_eq!(cache.get("nonexistent"), None);
    }

    #[test]
    fn test_cache_invalidate() {
        let cache = Cache::new(60);
        cache.set("key1".to_string(), b"value1".to_vec());
        cache.invalidate("key1");
        assert_eq!(cache.get("key1"), None);
    }

    #[test]
    fn test_cache_clear() {
        let cache = Cache::new(60);
        cache.set("key1".to_string(), b"value1".to_vec());
        cache.set("key2".to_string(), b"value2".to_vec());
        cache.clear();
        assert_eq!(cache.get("key1"), None);
        assert_eq!(cache.get("key2"), None);
    }

    #[test]
    fn test_cache_with_ttl() {
        let cache = Cache::new(60);
        cache.set_with_ttl("key1".to_string(), b"value1".to_vec(), Duration::from_secs(0));
        std::thread::sleep(Duration::from_millis(10));
        assert_eq!(cache.get("key1"), None);
    }

    #[test]
    fn test_cache_len() {
        let cache = Cache::new(60);
        assert_eq!(cache.len(), 0);
        cache.set("key1".to_string(), b"v1".to_vec());
        assert_eq!(cache.len(), 1);
    }

    #[test]
    fn test_cache_metrics() {
        let cache = Cache::new(60);
        cache.set("key1".to_string(), b"value1".to_vec());

        cache.get("key1");
        cache.get("key1");
        cache.get("nonexistent");

        let metrics = cache.get_metrics();
        assert_eq!(metrics.hits, 2);
        assert_eq!(metrics.misses, 1);
        assert_eq!(metrics.total_requests, 3);
        assert!((metrics.hit_rate() - 2.0 / 3.0).abs() < 0.001);
    }

    #[test]
    fn test_cache_invalidate_pattern() {
        let cache = Cache::new(60);
        cache.set("waste_1".to_string(), b"value1".to_vec());
        cache.set("waste_2".to_string(), b"value2".to_vec());
        cache.set("other_1".to_string(), b"value3".to_vec());

        cache.invalidate_pattern("waste");

        assert_eq!(cache.get("waste_1"), None);
        assert_eq!(cache.get("waste_2"), None);
        assert_eq!(cache.get("other_1"), Some(b"value3".to_vec()));
    }

    #[test]
    fn test_cache_eviction() {
        let cache = Cache::new(60);
        for i in 0..10001 {
            cache.set(format!("key_{}", i), vec![0; 100]);
        }
        let metrics = cache.get_metrics();
        assert!(metrics.evictions > 0);
    }
}
