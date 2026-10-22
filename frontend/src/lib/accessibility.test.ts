import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateId,
  announce,
  applyHighContrast,
  applyReducedMotion,
  applyFontSize,
  createSkipLink,
} from './accessibility';

describe('accessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.className = '';
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should use custom prefix', () => {
      const id = generateId('custom');
      expect(id).toMatch(/^custom-\d+$/);
    });
  });

  describe('announce', () => {
    it('should create ARIA live region', () => {
      announce('Test message');
      const region = document.querySelector('[role="status"]');
      expect(region).toBeTruthy();
      expect(region?.textContent).toBe('Test message');
    });

    it('should support assertive priority', () => {
      announce('Urgent!', 'assertive');
      const region = document.querySelector('[aria-live="assertive"]');
      expect(region).toBeTruthy();
    });
  });

  describe('applyHighContrast', () => {
    it('should add high-contrast class when enabled', () => {
      applyHighContrast(true);
      expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
    });

    it('should remove high-contrast class when disabled', () => {
      document.documentElement.classList.add('high-contrast');
      applyHighContrast(false);
      expect(document.documentElement.classList.contains('high-contrast')).toBe(false);
    });
  });

  describe('applyReducedMotion', () => {
    it('should add reduce-motion class when enabled', () => {
      applyReducedMotion(true);
      expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
    });

    it('should remove reduce-motion class when disabled', () => {
      document.documentElement.classList.add('reduce-motion');
      applyReducedMotion(false);
      expect(document.documentElement.classList.contains('reduce-motion')).toBe(false);
    });
  });

  describe('applyFontSize', () => {
    it('should apply small font size', () => {
      applyFontSize('small');
      expect(document.documentElement.classList.contains('font-small')).toBe(true);
    });

    it('should apply large font size', () => {
      applyFontSize('large');
      expect(document.documentElement.classList.contains('font-large')).toBe(true);
    });

    it('should switch between font sizes', () => {
      applyFontSize('small');
      applyFontSize('large');
      expect(document.documentElement.classList.contains('font-small')).toBe(false);
      expect(document.documentElement.classList.contains('font-large')).toBe(true);
    });
  });

  describe('createSkipLink', () => {
    it('should create skip link with correct attributes', () => {
      const link = createSkipLink('main-content');
      expect(link.href).toContain('#main-content');
      expect(link.textContent).toBe('Skip to main content');
    });
  });
});
