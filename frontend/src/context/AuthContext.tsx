import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useWallet } from '@/context/WalletContext'

interface Profile {
  role?: string
  name?: string
}

interface User extends Profile {
  address: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (profile: Profile) => void
/**
 * context/AuthContext.tsx
 *
 * Compatibility shim — delegates to the auth store slice.
 * Existing components that call useAuth() continue to work unchanged.
 *
 * The actual state and dispatch live in StoreProvider (store/index.tsx).
 */
import React, { type ReactNode } from 'react'
import { useAuthStore, type AuthUser } from '@/store'

export type { AuthUser }

// Kept for type consumers that import from this file
export interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (user: AuthUser) => void
  logout: () => void
  isLoading: boolean
}

const PROFILE_STORAGE_KEY = 'scavngr_profile'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { address, isLoading: walletLoading, disconnect } = useWallet()
  const [profile, setProfile] = useState<Profile | null>(null)

  // Profile is only meaningful for the currently connected wallet address.
  useEffect(() => {
    if (!address) {
      setProfile(null)
      return
    }
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Profile & { address: string }
      setProfile(parsed.address === address ? { role: parsed.role, name: parsed.name } : null)
    }
  }, [address])

  const login = (newProfile: Profile) => {
    if (!address) return
    setProfile(newProfile)
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ address, ...newProfile }))
  }

  const logout = () => {
    setProfile(null)
    localStorage.removeItem(PROFILE_STORAGE_KEY)
    disconnect()
  }

  const user = address ? { address, ...profile } : null

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!address && !!profile, login, logout, isLoading: walletLoading }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * AuthProvider is now a no-op wrapper — state lives in StoreProvider.
 * Kept so existing JSX (<AuthProvider>) does not need to change.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
  <>{children}</>
)

/**
 * useAuth — thin adapter over the auth store slice.
 * Returns the same shape as the original AuthContext.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const { state, dispatch } = useAuthStore()

  return {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    login: (user: AuthUser) => dispatch({ type: 'AUTH_LOGIN', payload: user }),
    logout: () => dispatch({ type: 'AUTH_LOGOUT' }),
  }
}
