/**
 * Convention tests: null vs undefined in frontend/src/lib utilities (issue #1157).
 *
 * These tests assert that utility functions follow the convention:
 *   - undefined = absent / not found
 *   - null = explicit API value
 */
import { convertWeight, toWeightInGrams } from '../validation/wasteSubmission';

describe('convertWeight convention (returns undefined, not null, for invalid input)', () => {
  it('returns undefined for NaN input', () => {
    expect(convertWeight('abc', 'grams')).toBeUndefined();
  });

  it('returns undefined for zero weight', () => {
    expect(convertWeight('0', 'grams')).toBeUndefined();
  });

  it('returns undefined for negative weight', () => {
    expect(convertWeight('-1', 'grams')).toBeUndefined();
  });

  it('returns a string for valid grams input', () => {
    const result = convertWeight('1000', 'grams');
    expect(typeof result).toBe('string');
    expect(result).toBe('1.000 kg');
  });

  it('returns a string for valid kilograms input', () => {
    const result = convertWeight('1.5', 'kilograms');
    expect(typeof result).toBe('string');
    expect(result).toBe('1500 g');
  });
});

describe('toWeightInGrams convention (always returns a number)', () => {
  it('converts grams without change', () => {
    expect(toWeightInGrams('500', 'grams')).toBe(500);
  });

  it('converts kilograms to grams', () => {
    expect(toWeightInGrams('1.5', 'kilograms')).toBe(1500);
  });

  it('accepts a number directly', () => {
    expect(toWeightInGrams(250, 'grams')).toBe(250);
  });
});
