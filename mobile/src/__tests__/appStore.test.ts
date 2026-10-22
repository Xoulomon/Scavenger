/**
 * Unit tests for appStore (issue #1155).
 *
 * Verifies:
 * - Initial state is correct and serializable
 * - setParticipant / clearParticipant work correctly
 * - setStats / clearStats work correctly
 * - All selector functions return correct values
 * - State never contains non-serializable values
 */
import {
  useAppStore,
  selectParticipant,
  selectAddress,
  selectIsLoggedIn,
  selectStats,
  selectTotalWaste,
  selectTotalRewards,
  type Participant,
  type Stats,
} from '../store/appStore';

const PARTICIPANT: Participant = {
  address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
  name: 'Alice',
  role: 'Recycler',
};

const STATS: Stats = {
  total_waste: 42,
  total_rewards: 1000,
};

function getStore() {
  return useAppStore.getState();
}

beforeEach(() => {
  // Reset store to initial state before each test
  useAppStore.setState({ participant: null, stats: null });
});

describe('Initial state', () => {
  it('participant is null', () => {
    expect(getStore().participant).toBeNull();
  });

  it('stats is null', () => {
    expect(getStore().stats).toBeNull();
  });

  it('initial state is fully serializable (no Dates, Functions, class instances)', () => {
    const state = getStore();
    const serialized = JSON.stringify(state);
    const parsed = JSON.parse(serialized);
    // Actions are functions and will be stripped — that's fine
    expect(parsed.participant).toBeNull();
    expect(parsed.stats).toBeNull();
  });
});

describe('setParticipant', () => {
  it('sets the participant correctly', () => {
    getStore().setParticipant(PARTICIPANT);
    expect(getStore().participant).toEqual(PARTICIPANT);
  });

  it('stores only serializable fields', () => {
    getStore().setParticipant(PARTICIPANT);
    const { participant } = getStore();
    expect(typeof participant!.address).toBe('string');
    expect(typeof participant!.name).toBe('string');
    expect(typeof participant!.role).toBe('string');
  });

  it('replaces the previous participant', () => {
    getStore().setParticipant(PARTICIPANT);
    const updated: Participant = { ...PARTICIPANT, name: 'Bob' };
    getStore().setParticipant(updated);
    expect(getStore().participant?.name).toBe('Bob');
  });
});

describe('clearParticipant', () => {
  it('sets participant to null', () => {
    getStore().setParticipant(PARTICIPANT);
    getStore().clearParticipant();
    expect(getStore().participant).toBeNull();
  });
});

describe('setStats', () => {
  it('sets stats correctly', () => {
    getStore().setStats(STATS);
    expect(getStore().stats).toEqual(STATS);
  });

  it('stats fields are plain numbers', () => {
    getStore().setStats(STATS);
    expect(typeof getStore().stats!.total_waste).toBe('number');
    expect(typeof getStore().stats!.total_rewards).toBe('number');
  });
});

describe('clearStats', () => {
  it('sets stats to null', () => {
    getStore().setStats(STATS);
    getStore().clearStats();
    expect(getStore().stats).toBeNull();
  });
});

describe('Selectors', () => {
  it('selectParticipant returns null when not set', () => {
    expect(selectParticipant(getStore())).toBeNull();
  });

  it('selectParticipant returns participant when set', () => {
    getStore().setParticipant(PARTICIPANT);
    expect(selectParticipant(getStore())).toEqual(PARTICIPANT);
  });

  it('selectAddress returns undefined when not logged in', () => {
    expect(selectAddress(getStore())).toBeUndefined();
  });

  it('selectAddress returns address when logged in', () => {
    getStore().setParticipant(PARTICIPANT);
    expect(selectAddress(getStore())).toBe(PARTICIPANT.address);
  });

  it('selectIsLoggedIn returns false initially', () => {
    expect(selectIsLoggedIn(getStore())).toBe(false);
  });

  it('selectIsLoggedIn returns true after setParticipant', () => {
    getStore().setParticipant(PARTICIPANT);
    expect(selectIsLoggedIn(getStore())).toBe(true);
  });

  it('selectIsLoggedIn returns false after clearParticipant', () => {
    getStore().setParticipant(PARTICIPANT);
    getStore().clearParticipant();
    expect(selectIsLoggedIn(getStore())).toBe(false);
  });

  it('selectStats returns null when not set', () => {
    expect(selectStats(getStore())).toBeNull();
  });

  it('selectStats returns stats when set', () => {
    getStore().setStats(STATS);
    expect(selectStats(getStore())).toEqual(STATS);
  });

  it('selectTotalWaste returns 0 when stats is null', () => {
    expect(selectTotalWaste(getStore())).toBe(0);
  });

  it('selectTotalWaste returns value when stats set', () => {
    getStore().setStats(STATS);
    expect(selectTotalWaste(getStore())).toBe(42);
  });

  it('selectTotalRewards returns 0 when stats is null', () => {
    expect(selectTotalRewards(getStore())).toBe(0);
  });

  it('selectTotalRewards returns value when stats set', () => {
    getStore().setStats(STATS);
    expect(selectTotalRewards(getStore())).toBe(1000);
  });
});

describe('No direct state mutation', () => {
  it('setParticipant does not mutate the existing state object', () => {
    getStore().setParticipant(PARTICIPANT);
    const stateBefore = getStore();
    const participantBefore = stateBefore.participant;
    getStore().setParticipant({ ...PARTICIPANT, name: 'Charlie' });
    // The old participant reference should be unchanged
    expect(participantBefore?.name).toBe('Alice');
  });
});
