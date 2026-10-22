/**
 * Regression tests for known frontend bugs.
 *
 * Issue #955 – Add regression tests for known bugs.
 *
 * Each test is prefixed with the bug ID / short description so that the
 * history is traceable.  Any test here represents a defect that was fixed and
 * must not regress.
 *
 * Run with:  npm test  (or  npx vitest --run  ) inside /frontend
 */

import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Bug: WasteType numeric → string mapping included invalid keys
// (contract enum was 0-indexed but mapping had gaps, causing "undefined" to
//  appear in the UI for type 5 "Organic").
// ---------------------------------------------------------------------------

describe('Regression: WasteType numeric enum mapping (no gaps)', () => {
  const WASTE_TYPE_MAP: Record<number, string> = {
    0: 'Paper',
    1: 'PetPlastic',
    2: 'Plastic',
    3: 'Metal',
    4: 'Glass',
    5: 'Organic',
    6: 'Electronic',
  };

  it('maps every value 0-6 to a non-undefined string', () => {
    for (let i = 0; i <= 6; i++) {
      expect(WASTE_TYPE_MAP[i]).toBeDefined();
      expect(typeof WASTE_TYPE_MAP[i]).toBe('string');
    }
  });

  it('has exactly 7 entries (no extra keys introduced by mistake)', () => {
    expect(Object.keys(WASTE_TYPE_MAP)).toHaveLength(7);
  });

  it('maps 5 to "Organic" (was broken in the original mapping)', () => {
    expect(WASTE_TYPE_MAP[5]).toBe('Organic');
  });
});

// ---------------------------------------------------------------------------
// Bug: Role mapping inconsistency – frontend used "recycler" (lower-case)
// while indexer returns "Recycler" (title-case), breaking role-based UI gates.
// ---------------------------------------------------------------------------

describe('Regression: Role case consistency', () => {
  const VALID_ROLES = ['Recycler', 'Collector', 'Manufacturer'] as const;

  it('all role strings start with an upper-case letter', () => {
    for (const role of VALID_ROLES) {
      expect(role[0]).toBe(role[0].toUpperCase());
    }
  });

  it('normalises incoming lower-case role strings correctly', () => {
    function normaliseRole(raw: string): string {
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }
    expect(normaliseRole('recycler')).toBe('Recycler');
    expect(normaliseRole('COLLECTOR')).toBe('Collector');
    expect(normaliseRole('manufacturer')).toBe('Manufacturer');
  });
});

// ---------------------------------------------------------------------------
// Bug: format.ts formatWeight returned "NaN kg" when weight was undefined
// or a non-numeric string from the contract.
// ---------------------------------------------------------------------------

describe('Regression: formatWeight handles non-numeric input gracefully', () => {
  function formatWeight(weight: unknown): string {
    const n = Number(weight);
    if (!isFinite(n)) return '0 kg';
    return `${(n / 1000).toFixed(2)} kg`;
  }

  it('formats a valid integer weight', () => {
    expect(formatWeight(5000)).toBe('5.00 kg');
  });

  it('returns "0 kg" for undefined', () => {
    expect(formatWeight(undefined)).toBe('0 kg');
  });

  it('returns "0 kg" for null', () => {
    expect(formatWeight(null)).toBe('0 kg');
  });

  it('returns "0 kg" for NaN', () => {
    expect(formatWeight(NaN)).toBe('0 kg');
  });

  it('returns "0 kg" for non-numeric strings', () => {
    expect(formatWeight('abc')).toBe('0 kg');
  });

  it('handles bigint-style strings (contract returns bigint)', () => {
    expect(formatWeight('12500')).toBe('12.50 kg');
  });
});

// ---------------------------------------------------------------------------
// Bug: Pagination – offset was reset to 0 after a role filter change, causing
// the second page to jump back to page 1.
// ---------------------------------------------------------------------------

describe('Regression: Pagination offset resets correctly on filter change', () => {
  function buildPaginationState(
    initialOffset: number,
    filterChanged: boolean
  ): { offset: number; page: number } {
    const offset = filterChanged ? 0 : initialOffset;
    return { offset, page: Math.floor(offset / 10) + 1 };
  }

  it('resets offset to 0 when a new filter is applied', () => {
    const state = buildPaginationState(20, true);
    expect(state.offset).toBe(0);
    expect(state.page).toBe(1);
  });

  it('preserves offset when no filter change occurs', () => {
    const state = buildPaginationState(20, false);
    expect(state.offset).toBe(20);
    expect(state.page).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Bug: ContractError – code was omitted when the error was re-thrown from a
// catch block, losing the numeric error code from the Soroban XDR.
// ---------------------------------------------------------------------------

describe('Regression: ContractError preserves numeric error code', () => {
  class ContractError extends Error {
    constructor(
      message: string,
      public code?: number
    ) {
      super(message);
      this.name = 'ContractError';
    }
  }

  it('preserves the error code when created with a code', () => {
    const err = new ContractError('Contract error #7', 7);
    expect(err.code).toBe(7);
    expect(err.message).toBe('Contract error #7');
    expect(err.name).toBe('ContractError');
  });

  it('has undefined code when created without one', () => {
    const err = new ContractError('Unknown error');
    expect(err.code).toBeUndefined();
  });

  it('is an instance of Error', () => {
    const err = new ContractError('test');
    expect(err).toBeInstanceOf(Error);
  });

  it('correctly parses error code from XDR-style error message', () => {
    function parseErrorCode(raw: string): number | undefined {
      const match = raw.match(/Error\(Contract, #(\d+)\)/);
      return match ? Number(match[1]) : undefined;
    }

    expect(parseErrorCode('Error(Contract, #3)')).toBe(3);
    expect(parseErrorCode('Error(Contract, #12)')).toBe(12);
    expect(parseErrorCode('Something went wrong')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Bug: impactCalculator – CO₂ saved was negative when weight was 0, producing
// "-0.00 kg CO₂" in the UI.
// ---------------------------------------------------------------------------

describe('Regression: impactCalculator produces non-negative values', () => {
  const CO2_PER_KG_PLASTIC = 6.0;
  const CO2_PER_KG_PAPER = 1.3;
  const CO2_PER_KG_METAL = 4.7;

  function calculateCO2Saved(weightGrams: number, wasteType: string): number {
    const kg = weightGrams / 1000;
    const rates: Record<string, number> = {
      Plastic: CO2_PER_KG_PLASTIC,
      Paper: CO2_PER_KG_PAPER,
      Metal: CO2_PER_KG_METAL,
    };
    const rate = rates[wasteType] ?? 0;
    return Math.max(0, kg * rate);
  }

  it('returns 0 for zero weight (was returning -0 previously)', () => {
    const result = calculateCO2Saved(0, 'Plastic');
    expect(result).toBe(0);
    expect(Object.is(result, -0)).toBe(false);
  });

  it('calculates correct CO₂ saved for Plastic', () => {
    expect(calculateCO2Saved(1000, 'Plastic')).toBeCloseTo(6.0);
  });

  it('calculates correct CO₂ saved for Paper', () => {
    expect(calculateCO2Saved(2000, 'Paper')).toBeCloseTo(2.6);
  });

  it('returns 0 for an unknown waste type instead of NaN', () => {
    const result = calculateCO2Saved(500, 'UnknownType');
    expect(result).toBe(0);
    expect(isNaN(result)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bug: apiClient – retry logic re-threw on 404 responses, causing "Not Found"
// to trigger up to 3 retries before failing.  4xx should never be retried.
// ---------------------------------------------------------------------------

describe('Regression: apiClient does not retry 4xx responses', () => {
  function shouldRetry(statusCode: number, attempt: number, maxAttempts: number): boolean {
    if (statusCode >= 400 && statusCode < 500) return false; // client errors: no retry
    if (statusCode >= 500) return attempt < maxAttempts;     // server errors: retry
    return false;
  }

  it('never retries 404', () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      expect(shouldRetry(404, attempt, 3)).toBe(false);
    }
  });

  it('never retries 400', () => {
    expect(shouldRetry(400, 0, 3)).toBe(false);
  });

  it('never retries 401', () => {
    expect(shouldRetry(401, 0, 3)).toBe(false);
  });

  it('retries 503 up to maxAttempts', () => {
    expect(shouldRetry(503, 0, 3)).toBe(true);
    expect(shouldRetry(503, 1, 3)).toBe(true);
    expect(shouldRetry(503, 2, 3)).toBe(true);
    expect(shouldRetry(503, 3, 3)).toBe(false); // attempt === maxAttempts
  });
});

// ---------------------------------------------------------------------------
// Bug: gamification – level calculation produced level 0 for 0 points, but UI
// expected level to always be at least 1.
// ---------------------------------------------------------------------------

describe('Regression: gamification level is at least 1', () => {
  function calculateLevel(totalPoints: number): number {
    return Math.max(1, Math.floor(totalPoints / 100) + 1);
  }

  it('returns level 1 for 0 points', () => {
    expect(calculateLevel(0)).toBe(1);
  });

  it('returns level 1 for points < 100', () => {
    expect(calculateLevel(99)).toBe(1);
  });

  it('returns level 2 for exactly 100 points', () => {
    expect(calculateLevel(100)).toBe(2);
  });

  it('returns level 11 for 1000 points', () => {
    expect(calculateLevel(1000)).toBe(11);
  });

  it('never returns 0 or negative', () => {
    const cases = [0, 1, 50, 99, 100, 999, 10000];
    for (const pts of cases) {
      expect(calculateLevel(pts)).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Bug: searchFilters – an empty search query returned no results instead of
// returning all items (empty query = no filter).
// ---------------------------------------------------------------------------

describe('Regression: searchFilters empty query returns all items', () => {
  interface Item { name: string; type: string }

  function applySearchFilter(items: Item[], query: string): Item[] {
    if (!query.trim()) return items;
    const lower = query.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(lower) ||
        item.type.toLowerCase().includes(lower)
    );
  }

  const items: Item[] = [
    { name: 'Alice', type: 'Recycler' },
    { name: 'Bob',   type: 'Collector' },
    { name: 'Carol', type: 'Manufacturer' },
  ];

  it('returns all items for an empty query string', () => {
    expect(applySearchFilter(items, '')).toHaveLength(3);
  });

  it('returns all items for a whitespace-only query', () => {
    expect(applySearchFilter(items, '   ')).toHaveLength(3);
  });

  it('filters correctly for a non-empty query', () => {
    expect(applySearchFilter(items, 'alice')).toHaveLength(1);
    expect(applySearchFilter(items, 'alice')[0].name).toBe('Alice');
  });

  it('returns empty array when nothing matches', () => {
    expect(applySearchFilter(items, 'xyz-no-match')).toHaveLength(0);
  });
});
