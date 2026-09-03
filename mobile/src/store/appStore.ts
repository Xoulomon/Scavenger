/**
 * appStore.ts – Zustand global state for the Scavngr mobile app.
 *
 * Conventions:
 * - All state is serializable (no Dates, no Functions, no class instances).
 * - Mutations always go through the `set` callback — never mutate state directly.
 * - Each logical domain gets its own slice interface.
 * - Exported selectors centralise field access so callers never destructure the store inline.
 */
import { create } from 'zustand';

// ── Participant slice ─────────────────────────────────────────────────────────

export interface Participant {
  /** Stellar public key (G...). */
  address: string;
  /** Display name (1–100 chars). */
  name: string;
  /** Participant role: 'Recycler' | 'Collector' | 'Manufacturer'. */
  role: string;
}

interface ParticipantSlice {
  participant: Participant | null;
  setParticipant: (participant: Participant) => void;
  clearParticipant: () => void;
}

// ── Stats slice ───────────────────────────────────────────────────────────────

export interface Stats {
  /** Total waste items submitted by this participant. */
  total_waste: number;
  /** Total reward tokens earned (as a plain number for serializability). */
  total_rewards: number;
}

interface StatsSlice {
  stats: Stats | null;
  setStats: (stats: Stats) => void;
  clearStats: () => void;
}

// ── Combined store ────────────────────────────────────────────────────────────

export type AppStore = ParticipantSlice & StatsSlice;

export const useAppStore = create<AppStore>((set) => ({
  // Participant slice
  participant: null,
  setParticipant: (participant) => set({ participant }),
  clearParticipant: () => set({ participant: null }),

  // Stats slice
  stats: null,
  setStats: (stats) => set({ stats }),
  clearStats: () => set({ stats: null }),
}));

// ── Selectors ─────────────────────────────────────────────────────────────────
// Use these instead of inline destructuring to keep components decoupled from
// the store shape.

/** Returns the current participant or null. */
export const selectParticipant = (state: AppStore): Participant | null =>
  state.participant;

/** Returns the wallet address, or undefined when not logged in. */
export const selectAddress = (state: AppStore): string | undefined =>
  state.participant?.address;

/** Returns true when a participant is loaded. */
export const selectIsLoggedIn = (state: AppStore): boolean =>
  state.participant !== null;

/** Returns the current stats or null. */
export const selectStats = (state: AppStore): Stats | null => state.stats;

/** Returns total waste count, defaulting to 0. */
export const selectTotalWaste = (state: AppStore): number =>
  state.stats?.total_waste ?? 0;

/** Returns total rewards, defaulting to 0. */
export const selectTotalRewards = (state: AppStore): number =>
  state.stats?.total_rewards ?? 0;
