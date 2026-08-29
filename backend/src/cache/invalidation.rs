use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum InvalidationEvent {
    WasteCreated(String),
    WasteUpdated(String),
    WasteDeleted(String),
    ParticipantUpdated(String),
    StatsUpdated,
    GlobalInvalidation,
}

#[derive(Debug, Clone, Serialize)]
pub struct InvalidationStrategy {
    pub strategy_type: InvalidationStrategyType,
    pub pattern: Option<String>,
    pub keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum InvalidationStrategyType {
    ExactKey,
    PatternMatch,
    TagBased,
    TimeBased,
    EventBased,
}

pub struct CacheInvalidationManager {
    subscribers: Arc<Mutex<Vec<String>>>,
    event_history: Arc<Mutex<Vec<(InvalidationEvent, chrono::DateTime<chrono::Utc>)>>>,
}

impl CacheInvalidationManager {
    pub fn new() -> Self {
        Self {
            subscribers: Arc::new(Mutex::new(Vec::new())),
            event_history: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn subscribe(&self, cache_key: String) {
        self.subscribers.lock().unwrap().push(cache_key);
    }

    pub fn trigger(&self, event: InvalidationEvent) -> Vec<String> {
        let keys: Vec<String> = self.subscribers.lock().unwrap().clone();
        self.event_history
            .lock()
            .unwrap()
            .push((event.clone(), chrono::Utc::now()));
        keys
    }

    pub fn get_history(&self, limit: usize) -> Vec<(InvalidationEvent, chrono::DateTime<chrono::Utc>)> {
        let history = self.event_history.lock().unwrap();
        history.iter().rev().take(limit).cloned().collect()
    }

    pub fn invalidate_related(&self, primary_key: &str) -> Vec<String> {
        vec![
            format!("contract:waste:{}", primary_key),
            format!("contract:participant:{}", primary_key),
            "contract:stats".to_string(),
            "contract:wastes:".to_string(),
        ]
    }

    pub fn generate_invalidation_strategy(
        &self,
        event: &InvalidationEvent,
        cache: &crate::cache::Cache,
    ) -> Vec<InvalidationStrategy> {
        let mut strategies = Vec::new();
        match event {
            InvalidationEvent::WasteCreated(id) => {
                strategies.push(InvalidationStrategy {
                    strategy_type: InvalidationStrategyType::ExactKey,
                    pattern: None,
                    keys: vec![format!("contract:waste:{}", id)],
                });
                strategies.push(InvalidationStrategy {
                    strategy_type: InvalidationStrategyType::PatternMatch,
                    pattern: Some("contract:wastes:".to_string()),
                    keys: vec![],
                });
            }
            InvalidationEvent::WasteUpdated(id) => {
                strategies.push(InvalidationStrategy {
                    strategy_type: InvalidationStrategyType::ExactKey,
                    pattern: None,
                    keys: vec![format!("contract:waste:{}", id)],
                });
                strategies.push(InvalidationStrategy {
                    strategy_type: InvalidationStrategyType::TimeBased,
                    pattern: None,
                    keys: vec!["contract:stats".to_string()],
                });
            }
            InvalidationEvent::StatsUpdated => {
                strategies.push(InvalidationStrategy {
                    strategy_type: InvalidationStrategyType::ExactKey,
                    pattern: None,
                    keys: vec!["contract:stats".to_string()],
                });
            }
            InvalidationEvent::GlobalInvalidation => {
                strategies.push(InvalidationStrategy {
                    strategy_type: InvalidationStrategyType::PatternMatch,
                    pattern: Some("contract:".to_string()),
                    keys: vec![],
                });
            }
            _ => {}
        }
        strategies
    }

    pub fn apply_strategy(&self, strategy: &InvalidationStrategy, cache: &crate::cache::Cache) {
        match strategy.strategy_type {
            InvalidationStrategyType::ExactKey => {
                for key in &strategy.keys {
                    cache.invalidate(key);
                }
            }
            InvalidationStrategyType::PatternMatch => {
                if let Some(pattern) = &strategy.pattern {
                    cache.invalidate_pattern(pattern);
                }
            }
            _ => {}
        }
    }
}

impl Default for CacheInvalidationManager {
    fn default() -> Self {
        Self::new()
    }
}

pub struct CacheWarmingStrategy {
    pub priority_keys: Vec<String>,
    pub warm_on_startup: bool,
    pub warm_interval: u64,
}

impl Default for CacheWarmingStrategy {
    fn default() -> Self {
        Self {
            priority_keys: vec![
                "contract:stats".to_string(),
                "contract:wastes".to_string(),
                "contract:participants".to_string(),
            ],
            warm_on_startup: true,
            warm_interval: 300,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::{Cache, CacheInvalidationManager};

    #[test]
    fn test_invalidation_manager_new() {
        let manager = CacheInvalidationManager::new();
        assert!(manager.subscribers.lock().unwrap().is_empty());
    }

    #[test]
    fn test_subscribe_and_trigger() {
        let manager = CacheInvalidationManager::new();
        manager.subscribe("test_key".to_string());
        let keys = manager.trigger(InvalidationEvent::WasteCreated("w1".to_string()));
        assert_eq!(keys.len(), 1);
        assert_eq!(keys[0], "test_key");
    }

    #[test]
    fn test_invalidation_strategy_generation() {
        let manager = CacheInvalidationManager::new();
        let cache = Cache::new(300);
        let event = InvalidationEvent::WasteCreated("w1".to_string());
        let strategies = manager.generate_invalidation_strategy(&event, &cache);
        assert!(!strategies.is_empty());
    }

    #[test]
    fn test_cache_warming_strategy_default() {
        let strategy = CacheWarmingStrategy::default();
        assert!(strategy.warm_on_startup);
        assert_eq!(strategy.priority_keys.len(), 3);
    }

    #[test]
    fn test_get_history() {
        let manager = CacheInvalidationManager::new();
        manager.trigger(InvalidationEvent::WasteCreated("w1".to_string()));
        manager.trigger(InvalidationEvent::StatsUpdated);
        let history = manager.get_history(10);
        assert_eq!(history.len(), 2);
    }
}
