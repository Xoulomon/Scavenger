# Caching Guide

## Overview

Scavenger implements a multi-level caching strategy to improve performance across the platform.

## Architecture

- **Memory Cache**: In-process LRU-style cache with TTL support
- **Distributed Cache**: Multi-node cache with Redis URL support and versioning
- **Cache Warmer**: Automated cache warming on startup and scheduled intervals
- **Invalidation Manager**: Event-driven cache invalidation with pattern matching

## Usage

### Memory Cache

```rust
use scavenger_backend::cache::Cache;

let cache = Cache::new(300); // 5 minutes TTL
cache.set("key".to_string(), b"value".to_vec());
let data = cache.get("key");
```

### Distributed Cache

```rust
use scavenger_backend::cache::DistributedCache;

let cache = DistributedCache::new(300);
cache.set("key".to_string(), b"value".to_vec());
```

### Cache Warming

```rust
use scavenger_backend::cache::{CacheWarmer, Cache};
use std::sync::Arc;

let cache = Arc::new(Cache::new(300));
let warmer = CacheWarmer::new(cache, 300);

warmer.register_warming_task(WarmTask {
    name: "stats".to_string(),
    key: "contract:stats".to_string(),
    data: b"...".to_vec(),
    ttl: Duration::from_secs(300),
}).await;

warmer.warm_on_startup().await;
```

### Invalidation

```rust
use scavenger_backend::cache::CacheInvalidationManager;

let manager = CacheInvalidationManager::new();
manager.subscribe("contract:waste:1".to_string());

let strategies = manager.generate_invalidation_strategy(
    &InvalidationEvent::WasteCreated("w1".to_string()),
    &cache,
);
```

## Monitoring

Metrics available via `cache.get_metrics()`:

- `hits` / `misses`
- `evictions`
- `hit_rate`

## Tests

Run `cargo test --lib cache` to execute caching tests.
