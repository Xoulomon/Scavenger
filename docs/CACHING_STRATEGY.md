# Frontend Caching Strategy

> Decision record: [ADR-0010](adr/0010-frontend-caching-layers.md).


## Layers

### 1. React Query (In-Memory + IndexedDB Persistence)

Configured in `frontend/src/main.tsx` with `persistQueryClient`. Stale times per data type:

| Data | Hook | Stale Time | Notes |
|---|---|---|---|
| Participant | `useParticipant` | 60s | Changes infrequently |
| Participant stats | `useParticipantStats` | 60s | Updated on transactions |
| Waste item | `useWaste` | 30s | May change on transfer |
| Global metrics | `useMetrics` | 2min | Aggregates, low churn |
| Incentives | `useIncentives` | 5min | Rarely change |
| Supply chain stats | `useSupplyChainStats` | 2min | Aggregates |

All queries persist to IndexedDB with a 24h `gcTime`, so data survives page refreshes and is available offline.

### 2. Service Worker (Workbox)

Configured in `vite.config.ts`:

- `/api/(participants|wastes|metrics|incentives|stats)` → `NetworkFirst`, 60s TTL, 5s network timeout
- `*.stellar.org/*` → `NetworkFirst`, 7 day TTL
- `*.ipfs.io/*` → `CacheFirst`, 30 day TTL
- Static assets → `StaleWhileRevalidate` (default PWA)

### 3. Cache Keys

All query keys are defined in `frontend/src/lib/cacheKeys.ts` for consistent invalidation:

```ts
import { cacheKeys } from '@/lib/cacheKeys'
import { useQueryClient } from '@tanstack/react-query'

// Invalidate after a mutation
const qc = useQueryClient()
await qc.invalidateQueries({ queryKey: cacheKeys.participant(address) })
```

## Hooks

Import from `@/hooks/useContractQueries`:

```ts
import { useParticipant, useMetrics, useActiveIncentives } from '@/hooks/useContractQueries'

const { data: participant, isLoading } = useParticipant(address)
const { data: metrics } = useMetrics()
```
