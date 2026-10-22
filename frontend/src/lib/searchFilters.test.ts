import { describe, it, expect, beforeEach } from 'vitest';
import {
  fuzzyMatch,
  searchData,
  applyFilters,
  saveFilter,
  getSavedFilters,
  deleteSavedFilter,
  type FilterGroup,
} from './searchFilters';

describe('searchFilters', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('fuzzyMatch', () => {
    it('should match exact strings', () => {
      expect(fuzzyMatch('hello', 'hello')).toBe(true);
    });

    it('should match substring', () => {
      expect(fuzzyMatch('hello world', 'world')).toBe(true);
    });

    it('should match with typos', () => {
      expect(fuzzyMatch('plastic', 'plastik', 0.7)).toBe(true);
    });

    it('should not match very different strings', () => {
      expect(fuzzyMatch('plastic', 'glass')).toBe(false);
    });
  });

  describe('searchData', () => {
    const data = [
      { id: 1, name: 'Plastic Bottle', type: 'plastic' },
      { id: 2, name: 'Glass Container', type: 'glass' },
      { id: 3, name: 'Metal Can', type: 'metal' },
    ];

    it('should return all data when query is empty', () => {
      const result = searchData(data, '', ['name']);
      expect(result).toEqual(data);
    });

    it('should filter by exact match', () => {
      const result = searchData(data, 'Glass', ['name']);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Glass Container');
    });

    it('should search across multiple fields', () => {
      const result = searchData(data, 'plastic', ['name', 'type']);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('plastic');
    });

    it('should support fuzzy search', () => {
      const result = searchData(data, 'plasstik', ['type'], true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('applyFilters', () => {
    const data = [
      { id: 1, weight: 10, verified: true },
      { id: 2, weight: 20, verified: false },
      { id: 3, weight: 30, verified: true },
    ];

    it('should filter with single condition', () => {
      const filter: FilterGroup = {
        logic: 'AND',
        filters: [{ field: 'verified', operator: 'eq', value: true }],
      };
      const result = applyFilters(data, filter);
      expect(result).toHaveLength(2);
    });

    it('should filter with AND logic', () => {
      const filter: FilterGroup = {
        logic: 'AND',
        filters: [
          { field: 'verified', operator: 'eq', value: true },
          { field: 'weight', operator: 'gte', value: 20 },
        ],
      };
      const result = applyFilters(data, filter);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });

    it('should filter with OR logic', () => {
      const filter: FilterGroup = {
        logic: 'OR',
        filters: [
          { field: 'weight', operator: 'lt', value: 15 },
          { field: 'weight', operator: 'gt', value: 25 },
        ],
      };
      const result = applyFilters(data, filter);
      expect(result).toHaveLength(2);
    });

    it('should handle nested filter groups', () => {
      const filter: FilterGroup = {
        logic: 'AND',
        filters: [
          { field: 'verified', operator: 'eq', value: true },
          {
            logic: 'OR',
            filters: [
              { field: 'weight', operator: 'lt', value: 15 },
              { field: 'weight', operator: 'gt', value: 25 },
            ],
          },
        ],
      };
      const result = applyFilters(data, filter);
      expect(result).toHaveLength(2);
    });
  });

  describe('saved filters', () => {
    it('should save and retrieve filters', () => {
      const filter = saveFilter({
        name: 'Test Filter',
        filter: {
          logic: 'AND',
          filters: [{ field: 'type', operator: 'eq', value: 'plastic' }],
        },
      });

      expect(filter.id).toBeDefined();
      expect(filter.createdAt).toBeInstanceOf(Date);

      const saved = getSavedFilters();
      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe('Test Filter');
    });

    it('should delete saved filters', () => {
      const filter = saveFilter({
        name: 'Test Filter',
        filter: { logic: 'AND', filters: [] },
      });

      deleteSavedFilter(filter.id);

      const saved = getSavedFilters();
      expect(saved).toHaveLength(0);
    });
  });
});
