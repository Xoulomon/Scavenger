use crate::cache::invalidation::{CacheInvalidationManager, InvalidationEvent};
use crate::cache::Cache;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct WarmTask {
    pub name: String,
    pub key: String,
    pub data: Vec<u8>,
    pub ttl: Duration,
}

pub struct CacheWarmer {
    cache: Arc<Cache>,
    invalidation_manager: Arc<Mutex<CacheInvalidationManager>>,
    warming_tasks: Arc<Mutex<HashMap<String, WarmTask>>>,
    last_warm: Arc<Mutex<chrono::DateTime<chrono::Utc>>>,
    warm_interval_secs: u64,
}

impl CacheWarmer {
    pub fn new(cache: Arc<Cache>, warm_interval_secs: u64) -> Self {
        Self {
            cache,
            invalidation_manager: Arc::new(Mutex::new(CacheInvalidationManager::new())),
            warming_tasks: Arc::new(Mutex::new(HashMap::new())),
            last_warm: Arc::new(Mutex::new(chrono::Utc::now() - chrono::Duration::hours(1))),
            warm_interval_secs,
        }
    }

    pub async fn warm_key(&self, key: String, data: Vec<u8>) {
        self.cache.set(key.clone(), data);
        tracing::debug!(key = %key, "cache key warmed");
    }

    pub async fn register_warming_task(&self, task: WarmTask) {
        self.warming_tasks.lock().unwrap().insert(task.key.clone(), task);
    }

    pub async fn warm_on_startup(&self) {
        tracing::info!("running startup cache warming");
        let tasks = self.warming_tasks.lock().unwrap().clone();
        let mut count = 0;
        for (_, task) in tasks {
            self.cache.set(task.key.clone(), task.data.clone());
            count += 1;
        }
        *self.last_warm.lock().unwrap() = chrono::Utc::now();
        tracing::info!(entries_warmed = count, "startup warming complete");
    }

    pub fn should_warm(&self, last_warm: chrono::DateTime<chrono::Utc>) -> bool {
        let now = chrono::Utc::now();
        let interval = chrono::Duration::seconds(self.warm_interval_secs as i64);
        now - last_warm > interval
    }

    pub fn get_invalidation_manager(&self) -> Arc<Mutex<CacheInvalidationManager>> {
        Arc::clone(&self.invalidation_manager)
    }

    pub fn get_warming_tasks(&self) -> Arc<Mutex<HashMap<String, WarmTask>>> {
        Arc::clone(&self.warming_tasks)
    }
}
