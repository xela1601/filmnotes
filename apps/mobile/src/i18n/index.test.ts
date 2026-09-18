import {
  DEFAULT_LANGUAGE,
  i18n,
  registerFeatureTranslations,
  resolveLanguage,
  setAppLanguage,
} from './index';

describe('i18n', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  afterEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('uses German as default and fallback language', () => {
    expect(DEFAULT_LANGUAGE).toBe('de');
    expect(i18n.options.fallbackLng).toEqual(['de']);
  });

  it('translates into German', () => {
    expect(i18n.t('tabs.rolls')).toBe('Filme');
  });

  it('translates into English', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('tabs.rolls')).toBe('Rolls');
  });

  it('translates every validation code in both languages', async () => {
    const codes = [
      'bulb_only_in_m',
      'aperture_not_on_lens',
      'filter_thread_mismatch',
      'polarizer_blocks_af',
      'flash_forces_sync_speed',
      'compensation_ignored_in_m',
      'handheld_shake_risk',
      'focal_length_out_of_range',
      'frame_no_out_of_range',
      'frame_no_duplicate',
      'shutter_not_available',
    ];

    for (const language of ['de', 'en'] as const) {
      await i18n.changeLanguage(language);
      for (const code of codes) {
        expect(i18n.exists(`validation.${code}`)).toBe(true);
        expect(i18n.t(`validation.${code}`)).not.toBe(`validation.${code}`);
      }
    }
  });

  it('interpolates validation parameters', () => {
    expect(i18n.t('validation.handheld_shake_risk', { limit: '1/60' })).toContain('1/60');
  });

  it('lets features register their own namespace', async () => {
    registerFeatureTranslations('x', { de: { a: 'A' }, en: { a: 'B' } });

    expect(i18n.t('x:a')).toBe('A');
    await i18n.changeLanguage('en');
    expect(i18n.t('x:a')).toBe('B');
  });

  describe('resolveLanguage', () => {
    it('maps the explicit settings values', () => {
      expect(resolveLanguage('de')).toBe('de');
      expect(resolveLanguage('en')).toBe('en');
    });

    it('falls back to a supported language for "system"', () => {
      expect(['de', 'en']).toContain(resolveLanguage('system'));
    });
  });

  describe('setAppLanguage', () => {
    it('switches the active i18next language', async () => {
      await setAppLanguage('en');
      expect(i18n.language).toBe('en');
    });
  });
});
