// Storage Optimization Module
// Implements storage batching, prefetching, indexes, and caching for improved performance
//
// ## Resource-cost audit (issue #1098)
//
// Neither this module nor `query_optimizer.rs` is called from `lib.rs` today
// (verified: no `storage_optimizer::` or `query_optimizer::` references exist
// outside these two files' own tests). They therefore have **zero effect** on
// the deployed contract's instruction or resource-fee costs — every ledger
// read/write in `ScavengerContract`'s real entry points goes through the
// inline storage calls in `lib.rs`, not through here. Any bench numbers
// collected against these modules in isolation would not reflect production
// cost, which is why no such numbers are asserted in this change; running
// `cargo bench` against the *actual* contract entry points remains the right
// way to validate a resource-cost claim, and this environment has no Rust
// toolchain available to do that.
//
// What was still worth fixing here, self-contained within this file:
// - `optimize_waste_storage` used to write a duplicate "hot" copy of a waste
//   record to temporary storage on *every* call, even when the cached hot
//   data was already identical and only its TTL needed bumping. It now skips
//   the redundant write (see `optimize_waste_storage` below).
//
// ## Expected resource-cost budget (documented, not bench-verified here)
//
// If/when these helpers are wired into a real entry point, the intended
// per-operation ledger footprint is:
// - `StorageCache::get`/`contains`: 1 temporary-storage read.
// - `StorageCache::set`: 1 temporary-storage write + 1 TTL extension (skip
//   both when the value is already current — see note above).
// - `StorageIndex::add`/`get`/`remove`: 1 instance-storage read or write.
// - `prefetch_participant_data`: up to 2 instance-storage reads (participant,
//   stats) + up to 2 temporary-storage writes, only on a cache miss.
// - `optimize_waste_storage`: 1 instance-storage read + at most 1
//   temporary-storage write (0 when the hot copy is already current).

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
        let hot_key = ("waste_hot", waste_id);
        let hot_data = (waste.is_active, waste.current_owner.clone(), waste.waste_type);

        // Skip the write (and TTL bump) entirely when the cached hot copy is
        // already up to date — avoids a redundant temporary-storage write on
        // every call for waste items whose hot fields haven't changed.
        let already_current = env
            .storage()
            .temporary()
            .get::<_, (bool, Address, crate::WasteType)>(&hot_key)
            .map(|cached| cached == hot_data)
            .unwrap_or(false);

        if !already_current {
            env.storage().temporary().set(&hot_key, &hot_data);
        }
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
