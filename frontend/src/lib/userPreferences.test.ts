import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUserPreferences,
  saveUserPreferences,
  resetUserPreferences,
  exportPreferences,
  importPreferences,
} from './userPreferences';

describe('userPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return default preferences when none are saved', () => {
    const prefs = getUserPreferences();
    expect(prefs.theme).toBe('system');
    expect(prefs.language).toBe('en');
  });

  it('should save and retrieve preferences', () => {
    saveUserPreferences({ theme: 'dark', language: 'es' });
    const prefs = getUserPreferences();
    expect(prefs.theme).toBe('dark');
    expect(prefs.language).toBe('es');
  });

  it('should merge partial preferences', () => {
    saveUserPreferences({ theme: 'dark' });
    saveUserPreferences({ language: 'fr' });
    const prefs = getUserPreferences();
    expect(prefs.theme).toBe('dark');
    expect(prefs.language).toBe('fr');
  });

  it('should reset preferences to defaults', () => {
    saveUserPreferences({ theme: 'dark' });
    resetUserPreferences();
    const prefs = getUserPreferences();
    expect(prefs.theme).toBe('system');
  });

  it('should export preferences as JSON', () => {
    saveUserPreferences({ theme: 'dark', language: 'es' });
    const json = exportPreferences();
    const parsed = JSON.parse(json);
    expect(parsed.theme).toBe('dark');
    expect(parsed.language).toBe('es');
  });

  it('should import preferences from JSON', () => {
    const json = JSON.stringify({ theme: 'light', language: 'de' });
    const success = importPreferences(json);
    expect(success).toBe(true);
    const prefs = getUserPreferences();
    expect(prefs.theme).toBe('light');
    expect(prefs.language).toBe('de');
  });

  it('should handle invalid JSON during import', () => {
    const success = importPreferences('invalid json');
    expect(success).toBe(false);
  });
});
