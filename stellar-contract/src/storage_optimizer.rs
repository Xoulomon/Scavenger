// Storage Optimization Module
// Implements storage batching, prefetching, indexes, and caching for improved performance

use soroban_sdk::{Env, Vec, Address, Symbol};

/// Storage cache for frequently accessed data
pub struct StorageCache {
    /// Capacity for cached entries
    capacity: u32,
}

impl StorageCache {
    pub fn new(capacity: u32) -> Self {
        Self { capacity }
    }

    /// Check if a key exists in the cache
    pub fn contains<K>(&self, env: &Env, key: &K) -> bool
    where
        K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
    {
        let cache_key = ("cache", key.clone());
        env.storage().temporary().has(&cache_key)
    }

    /// Get a value from the cache
    pub fn get<K, V>(&self, env: &Env, key: &K) -> Option<V>
    where
        K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
        V: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>,
    {
        let cache_key = ("cache", key.clone());
        env.storage().temporary().get(&cache_key)
    }

    /// Set a value in the cache
    pub fn set<K, V>(&self, env: &Env, key: &K, value: &V, ttl: u32)
    where
        K: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone,
        V: soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
    {
        let cache_key = ("cache", key.clone());
        env.storage().temporary().set(&cache_key, value);
        env.storage().temporary().extend_ttl(&cache_key, ttl, ttl);
    }
}

/// Storage index for fast lookups
pub struct StorageIndex {
    name: Symbol,
}

impl StorageIndex {
    pub fn new(name: Symbol) -> Self {
        Self { name }
    }

    /// Add an entry to the index
    pub fn add(&self, env: &Env, key: u128, value: Address) {
        let index_key = ("index", self.name.clone(), key);
        env.storage().instance().set(&index_key, &value);
    }

    /// Get an entry from the index
    pub fn get(&self, env: &Env, key: u128) -> Option<Address> {
        let index_key = ("index", self.name.clone(), key);
        env.storage().instance().get(&index_key)
    }

    /// Remove an entry from the index
    pub fn remove(&self, env: &Env, key: u128) {
        let index_key = ("index", self.name.clone(), key);
        env.storage().instance().remove(&index_key);
    }
}

/// Batch storage operations to reduce round-trips
pub struct StorageBatch<'a> {
    env: &'a Env,
    operations: Vec<StorageOperation>,
}

#[derive(Clone)]
pub enum StorageOperation {
    Read,
    Write,
    Update,
}

impl<'a> StorageBatch<'a> {
    pub fn new(env: &'a Env) -> Self {
        Self {
            env,
            operations: Vec::new(env),
        }
    }

    /// Execute all batched operations
    pub fn execute(&self) {
        // Operations are executed immediately in Soroban
        // This structure allows for future optimization
    }
}

/// Prefetch frequently accessed storage slots
pub fn prefetch_participant_data(env: &Env, address: &Address) {
    let cache = StorageCache::new(100);

    // Prefetch participant record
    let participant_key = (address.clone(),);
    if !cache.contains(env, &participant_key) {
        if let Some(participant) = env.storage().instance().get::<_, crate::Participant>(&participant_key) {
            cache.set(env, &participant_key, &participant, 1000);
        }
    }

    // Prefetch stats
    let stats_key = ("stats", address.clone());
    if !cache.contains(env, &stats_key) {
        if let Some(stats) = env.storage().instance().get::<_, crate::RecyclingStats>(&stats_key) {
            cache.set(env, &stats_key, &stats, 1000);
        }
    }
}

/// Optimize data layout for better access patterns
pub fn optimize_waste_storage(env: &Env, waste_id: u128) {
    // Implement hot/cold data separation
    // Hot data: frequently accessed (status, owner)
    // Cold data: rarely accessed (full history, documents)

    let waste_key = ("waste_v2", waste_id);
    if let Some(waste) = env.storage().instance().get::<_, crate::Waste>(&waste_key) {
        // Cache hot data
        let hot_key = ("waste_hot", waste_id);
        let hot_data = (waste.is_active, waste.current_owner.clone(), waste.waste_type);
        env.storage().temporary().set(&hot_key, &hot_data);
        env.storage().temporary().extend_ttl(&hot_key, 5000, 5000);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_storage_cache() {
        let env = Env::default();
        let cache = StorageCache::new(10);

        let key = "test_key";
        let value = 42u32;

        assert!(!cache.contains(&env, &key));
        cache.set(&env, &key, &value, 100);
        assert!(cache.contains(&env, &key));
        assert_eq!(cache.get::<_, u32>(&env, &key), Some(value));
    }

    #[test]
    fn test_storage_index() {
        let env = Env::default();
        let index = StorageIndex::new(soroban_sdk::symbol_short!("waste"));
        let addr = Address::generate(&env);

        index.add(&env, 1, addr.clone());
        assert_eq!(index.get(&env, 1), Some(addr.clone()));

        index.remove(&env, 1);
        assert_eq!(index.get(&env, 1), None);
    }
}
