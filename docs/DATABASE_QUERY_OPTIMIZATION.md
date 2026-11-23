# Database Query Optimization Guide

## Indexes Added (Migration 003)

### Composite Indexes

| Index                             | Table           | Columns                                             | Use Case                      |
| --------------------------------- | --------------- | --------------------------------------------------- | ----------------------------- |
| `idx_wastes_type_registered`      | wastes          | `(waste_type, registered_at DESC)`                  | Filter by type sorted by time |
| `idx_wastes_recycler_active_time` | wastes          | `(recycler_address, is_active, registered_at DESC)` | User's active waste list      |
| `idx_transfers_waste_time`        | waste_transfers | `(waste_id, transferred_at DESC)`                   | Transfer history for a waste  |
| `idx_rewards_recipient_time`      | token_rewards   | `(recipient_address, rewarded_at DESC)`             | User's reward history         |
| `idx_raw_events_ledger_type`      | raw_events      | `(ledger_sequence DESC, event_type)`                | Event replay by range + type  |

### Partial Indexes

| Index                         | Condition                                        | Use Case                           |
| ----------------------------- | ------------------------------------------------ | ---------------------------------- |
| `idx_wastes_active_only`      | `WHERE is_active = true`                         | Dashboard active waste count       |
| `idx_wastes_confirmed_active` | `WHERE is_confirmed = true AND is_active = true` | Confirmed active waste by recycler |

## Query Cache

Use `withQueryCache` from `queryOptimizer.ts` to wrap expensive queries with Redis caching:

```ts
import { withQueryCache } from '../db/queryOptimizer'

const result = await withQueryCache(
  `metrics:global`,
  'metrics',
  () => computeExpensiveMetrics(client),
  cacheManager // optional
)
```

## Performance Monitoring

```ts
import { getQueryStats, getSlowQueries } from '../db/queryOptimizer'

// Summary
console.log(getQueryStats())
// { total: 142, slow: 3, avgDuration: 12, slowThreshold: 100 }

// Slow query details
console.log(getSlowQueries(200))
```

Slow queries (>100ms) are also logged to stderr automatically.

## Query Patterns to Avoid

- `SELECT *` on `wastes` without filtering — use `WHERE is_active = true` and index
- Unindexed `ORDER BY` — ensure order column has a matching index
- N+1 queries — batch with `WHERE id = ANY($1)` instead of looping
