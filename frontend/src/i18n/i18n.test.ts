import { describe, it, expect, beforeEach } from 'vitest';
import i18n from './config';
import { RTL_LANGUAGES, getDirection } from './config';

describe('i18n Configuration', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('should initialize with English as default', () => {
    expect(i18n.language).toBe('en');
  });

  it('should change language to Spanish', async () => {
    await i18n.changeLanguage('es');
    expect(i18n.language).toBe('es');
  });

  it('should change language to French', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.language).toBe('fr');
  });

  it('should change language to Chinese', async () => {
    await i18n.changeLanguage('zh');
    expect(i18n.language).toBe('zh');
  });

  it('should change language to Arabic', async () => {
    await i18n.changeLanguage('ar');
    expect(i18n.language).toBe('ar');
  });

  it('should translate common.loading in English', () => {
    expect(i18n.t('common.loading')).toBe('Loading...');
  });

  it('should translate common.loading in Spanish', async () => {
    await i18n.changeLanguage('es');
    expect(i18n.t('common.loading')).toBe('Cargando...');
  });

  it('should translate common.loading in Arabic', async () => {
    await i18n.changeLanguage('ar');
    expect(i18n.t('common.loading')).toBe('جارٍ التحميل...');
  });

  it('should translate error messages', () => {
    expect(i18n.t('errors.network')).toBe('Network error occurred');
  });

  it('should translate new auth keys', () => {
    expect(i18n.t('auth.connect')).toBe('Connect Wallet');
    expect(i18n.t('auth.disconnect')).toBe('Disconnect');
  });

  it('should translate new participants keys', () => {
    expect(i18n.t('participants.roles.recycler')).toBe('Recycler');
    expect(i18n.t('participants.roles.collector')).toBe('Collector');
    expect(i18n.t('participants.roles.manufacturer')).toBe('Manufacturer');
  });

  it('should translate new rewards keys', () => {
    expect(i18n.t('rewards.title')).toBe('Rewards');
    expect(i18n.t('rewards.claim')).toBe('Claim Rewards');
  });

  it('should translate new waste type keys', () => {
    expect(i18n.t('waste.types.plastic')).toBe('Plastic');
    expect(i18n.t('waste.types.metal')).toBe('Metal');
  });

  it('should translate profile keys', () => {
    expect(i18n.t('profile.title')).toBe('Profile');
    expect(i18n.t('profile.totalRewards')).toBe('Total Rewards');
  });

  it('should translate new common keys', () => {
    expect(i18n.t('common.submit')).toBe('Submit');
    expect(i18n.t('common.noData')).toBe('No data available');
  });

  it('should fallback to English for missing translations', async () => {
    await i18n.changeLanguage('invalid');
    // i18next uses fallbackLng ('en') for translation lookups even with an unknown language code
    expect(i18n.t('common.loading')).toBe('Loading...');
  });

  it('should persist language preference', async () => {
    await i18n.changeLanguage('fr');
    const stored = localStorage.getItem('i18nextLng');
    expect(stored).toBe('fr');
  });
});

describe('RTL support', () => {
  it('should identify Arabic as RTL', () => {
    expect(RTL_LANGUAGES.has('ar')).toBe(true);
  });

  it('should not identify English as RTL', () => {
    expect(RTL_LANGUAGES.has('en')).toBe(false);
  });

  it('getDirection returns rtl for Arabic', () => {
    expect(getDirection('ar')).toBe('rtl');
  });

  it('getDirection returns ltr for English', () => {
    expect(getDirection('en')).toBe('ltr');
  });

  it('getDirection returns ltr for French', () => {
    expect(getDirection('fr')).toBe('ltr');
  });
});
