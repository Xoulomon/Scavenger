'use client'

import React, { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useOnlineStatus, useConnectionQuality } from '@/hooks/useOnlineStatus'

/**
 * Shape of the network status exposed by {@link NetworkContext}.
 *
 * This context is one of the three scoped contexts (Auth, Network, Theme)
 * introduced for #1673 to replace prop drilling of network status through
 * components in `frontend/src/components`.
 */
export interface NetworkContextValue {
  /** Whether the browser currently reports an active network connection. */
  isOnline: boolean
  /**
   * Effective connection type reported by the Network Information API
   * (e.g. `'4g'`, `'3g'`, `'2g'`, `'slow-2g'`), or `undefined` when the
   * API is unavailable.
   */
  effectiveType?: string
  /**
   * Estimated round-trip time in milliseconds reported by the Network
   * Information API, or `undefined` when the API is unavailable.
   */
  rtt?: number
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined)

export interface NetworkProviderProps {
  children: ReactNode
  /**
   * Optional override for the online status. Primarily useful for tests
   * and for consumers that already know the status from another source.
   */
  isOnline?: boolean
  /** Optional override for the effective connection type. */
  effectiveType?: string
  /** Optional override for the estimated round-trip time (ms). */
  rtt?: number
}

/**
 * Provides scoped network status to descendant components.
 *
 * Wraps `useOnlineStatus` and `useConnectionQuality` from
 * `@/hooks/useOnlineStatus` so that components no longer need to receive
 * network status via props. Any explicit props passed to the provider take
 * precedence over the values reported by the hooks.
 */
export function NetworkProvider({
  children,
  isOnline: isOnlineOverride,
  effectiveType: effectiveTypeOverride,
  rtt: rttOverride
}: NetworkProviderProps) {
  const hookIsOnline = useOnlineStatus()
  const connectionQuality = useConnectionQuality()

  const value = useMemo<NetworkContextValue>(() => {
    const isOnline = isOnlineOverride !== undefined ? isOnlineOverride : hookIsOnline

    const effectiveType =
      effectiveTypeOverride !== undefined ? effectiveTypeOverride : connectionQuality?.effectiveType

    const rtt = rttOverride !== undefined ? rttOverride : connectionQuality?.rtt

    return { isOnline, effectiveType, rtt }
  }, [hookIsOnline, connectionQuality, isOnlineOverride, effectiveTypeOverride, rttOverride])

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}

/**
 * Access the scoped network status.
 *
 * Must be called from within a {@link NetworkProvider}. Throws a descriptive
 * error when used outside of a provider to surface misconfiguration early.
 */
export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext)

  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider')
  }

  return context
}

export default NetworkContext
