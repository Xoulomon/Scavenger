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
struct DistributedCacheEntry {
    data: Vec<u8>,
    expires_at: Instant,
    version: u64,
}

#[derive(Clone)]
pub struct DistributedCache {
    store: Arc<Mutex<HashMap<String, DistributedCacheEntry>>>,
    default_ttl: Duration,
    metrics: Arc<Mutex<CacheMetrics>>,
    redis_url: Option<String>,
}

impl DistributedCache {
    /// Create a new `DistributedCache` with an optional Redis URL.
    ///
    /// Pass `redis_url` from [`crate::config::AppConfig::redis_url`] rather
    /// than reading `REDIS_URL` directly here (#1159).
    pub fn new(default_ttl_secs: u64, redis_url: Option<String>) -> Self {
        Self {
            store: Arc::new(Mutex::new(HashMap::new())),
            default_ttl: Duration::from_secs(default_ttl_secs),
            metrics: Arc::new(Mutex::new(CacheMetrics::default())),
            redis_url,
        }
    }

    pub fn with_redis(default_ttl_secs: u64, redis_url: String) -> Self {
        Self {
            store: Arc::new(Mutex::new(HashMap::new())),
            default_ttl: Duration::from_secs(default_ttl_secs),
            metrics: Arc::new(Mutex::new(CacheMetrics::default())),
            redis_url: Some(redis_url),
        }
    }

    pub fn get(&self, key: &str) -> Option<Vec<u8>> {
        let mut metrics = self.metrics.lock().unwrap();
        let store = self.store.lock().ok()?;

        if let Some(entry) = store.get(key) {
            if entry.expires_at > Instant::now() {
                metrics.record_hit();
                return Some(entry.data.clone());
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
            let version = store.get(&key).map(|e| e.version + 1).unwrap_or(1);
            store.insert(
                key,
                DistributedCacheEntry {
                    data,
                    expires_at: Instant::now() + ttl,
                    version,
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

    pub fn get_metrics(&self) -> CacheMetrics {
        self.metrics.lock().unwrap().clone()
    }

    pub fn get_version(&self, key: &str) -> Option<u64> {
        self.store.lock().unwrap().get(key).map(|e| e.version)
    }

    pub fn invalidate_with_pattern(&self, pattern: &str) {
        if let Ok(mut store) = self.store.lock() {
            let keys: Vec<String> = store.keys().filter(|k| k.contains(pattern)).cloned().collect();
            for key in keys {
                store.remove(&key);
            }
        }
    }
}

#[derive(Clone)]
pub struct CacheWarmer {
    cache: DistributedCache,
}

impl CacheWarmer {
    pub fn new(cache: DistributedCache) -> Self {
        Self { cache }
    }

    pub async fn warm_key(&self, key: String, data: Vec<u8>) {
        self.cache.set(key, data);
    }

    pub async fn warm_keys(&self, entries: Vec<(String, Vec<u8>)>) {
        for (key, data) in entries {
            self.cache.set(key, data);
        }
    }
}
