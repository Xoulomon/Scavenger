/**
 * Advanced search and filtering utilities
 * Supports full-text search, fuzzy matching, and complex filters
 */

export interface FilterOperator {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: unknown;
}

export interface FilterGroup {
  logic: 'AND' | 'OR';
  filters: (FilterOperator | FilterGroup)[];
}

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  filter: FilterGroup;
  createdAt: Date;
}

/**
 * Fuzzy search with Levenshtein distance
 */
export function fuzzyMatch(text: string, query: string, threshold = 0.6): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  
  if (t.includes(q)) return true;
  
  const distance = levenshteinDistance(t, q);
  const similarity = 1 - distance / Math.max(t.length, q.length);
  return similarity >= threshold;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Full-text search across multiple fields
 */
export function searchData<T extends Record<string, unknown>>(
  data: T[],
  query: string,
  fields: (keyof T)[],
  fuzzy = false,
): T[] {
  if (!query.trim()) return data;
  
  return data.filter((item) =>
    fields.some((field) => {
      const value = String(item[field] ?? '');
      return fuzzy ? fuzzyMatch(value, query) : value.toLowerCase().includes(query.toLowerCase());
    }),
  );
}

/**
 * Apply filter operator to a value
 */
function applyOperator(value: unknown, operator: FilterOperator['operator'], filterValue: unknown): boolean {
  switch (operator) {
    case 'eq':
      return value === filterValue;
    case 'ne':
      return value !== filterValue;
    case 'gt':
      return Number(value) > Number(filterValue);
    case 'lt':
      return Number(value) < Number(filterValue);
    case 'gte':
      return Number(value) >= Number(filterValue);
    case 'lte':
      return Number(value) <= Number(filterValue);
    case 'in':
      return Array.isArray(filterValue) && filterValue.includes(value);
    case 'contains':
      return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
    default:
      return false;
  }
}

/**
 * A compiled filter group: a flat list of predicates that can be evaluated
 * against an item without re-walking the filter tree on every call.
 */
type CompiledPredicate<T> = (item: T) => boolean;

interface CompiledFilterGroup<T> {
  logic: 'AND' | 'OR';
  predicates: CompiledPredicate<T>[];
}

const compiledFilterCache = new WeakMap<FilterGroup, CompiledFilterGroup<Record<string, unknown>>>();

function compileFilterGroup<T extends Record<string, unknown>>(group: FilterGroup): CompiledFilterGroup<T> {
  const cached = compiledFilterCache.get(group);
  if (cached) return cached as CompiledFilterGroup<T>;

  const predicates = group.filters.map<CompiledPredicate<T>>((filter) => {
    if ('logic' in filter) {
      const nested = compileFilterGroup<T>(filter as FilterGroup);
      return (item) => evaluateCompiled(item, nested);
    }
    const operator = filter as FilterOperator;
    return (item) => applyOperator(item[operator.field], operator.operator, operator.value);
  });

  const compiled: CompiledFilterGroup<T> = { logic: group.logic, predicates };
  compiledFilterCache.set(group, compiled as CompiledFilterGroup<Record<string, unknown>>);
  return compiled;
}

function evaluateCompiled<T>(item: T, compiled: CompiledFilterGroup<T>): boolean {
  const { logic, predicates } = compiled;
  if (logic === 'AND') {
    for (const predicate of predicates) {
      if (!predicate(item)) return false;
    }
    return true;
  }
  for (const predicate of predicates) {
    if (predicate(item)) return true;
  }
  return false;
}

/**
 * Apply a filter group to data
 */
export function applyFilters<T extends Record<string, unknown>>(data: T[], filterGroup: FilterGroup): T[] {
  const compiled = compileFilterGroup<T>(filterGroup);
  return data.filter((item) => evaluateCompiled(item, compiled));
}

function _evaluateFilterGroup<T extends Record<string, unknown>>(item: T, group: FilterGroup): boolean {
  return evaluateCompiled(item, compileFilterGroup<T>(group));
}

/**
 * Save filter to localStorage
 */
export function saveFilter(filter: Omit<SavedFilter, 'id' | 'createdAt'>): SavedFilter {
  const savedFilter: SavedFilter = {
    ...filter,
    id: crypto.randomUUID(),
    createdAt: new Date(),
  };
  
  const saved = getSavedFilters();
  saved.push(savedFilter);
  localStorage.setItem('savedFilters', JSON.stringify(saved));
  
  return savedFilter;
}

/**
 * Get all saved filters
 */
export function getSavedFilters(): SavedFilter[] {
  const saved = localStorage.getItem('savedFilters');
  if (!saved) return [];
  
  return JSON.parse(saved, (key, value) => {
    if (key === 'createdAt') return new Date(value);
    return value;
  });
}

/**
 * Delete a saved filter
 */
export function deleteSavedFilter(id: string): void {
  const saved = getSavedFilters();
  const filtered = saved.filter((f) => f.id !== id);
  localStorage.setItem('savedFilters', JSON.stringify(filtered));
}
