// #322 – alias that satisfies the useStats contract
// delegates to the canonical useSupplyChainStats implementation
//
// #1684 – Standardized data fetching with TanStack Query.
// The canonical implementation (useSupplyChainStats) now uses the
// centralized `cacheKeys` registry and `queryCachePolicy` defaults
// (staleTime / gcTime / retry / invalidation conventions). This alias
// intentionally re-exports it so callers keep the same public contract.
//
// Backwards-compatibility: `useStats` remains a drop-in alias for
// `useSupplyChainStats`; no caller changes are required.
export { useSupplyChainStats as useStats } from '@/hooks/useSupplyChainStats'
