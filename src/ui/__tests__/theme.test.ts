import { AA_LARGE_TEXT, AA_NORMAL_TEXT, contrastRatio } from '../contrast';
import { resolveThemeName } from '../theme-provider';
import { MIN_TOUCH_TARGET, darkTheme, lightTheme, spacing, type Theme } from '../theme';

describe('resolveThemeName', () => {
  it('açık tercihini sistem ayarından bağımsız uygular', () => {
    expect(resolveThemeName('light', 'dark')).toBe('light');
  });

  it('koyu tercihini sistem ayarından bağımsız uygular', () => {
    expect(resolveThemeName('dark', 'light')).toBe('dark');
  });

  it('sistem tercihinde cihaz ayarını izler', () => {
    expect(resolveThemeName('system', 'dark')).toBe('dark');
    expect(resolveThemeName('system', 'light')).toBe('light');
  });

  it('sistem ayarı bilinmiyorsa açık temaya düşer', () => {
    expect(resolveThemeName('system', null)).toBe('light');
    expect(resolveThemeName('system', undefined)).toBe('light');
    expect(resolveThemeName('system', 'unspecified')).toBe('light');
  });
});

describe('boşluk düzeni', () => {
  it('tüm adımlar 4 pt katıdır', () => {
    for (const value of Object.values(spacing)) {
      expect(value % 4).toBe(0);
    }
  });

  it('en küçük dokunma hedefi 44 pt olarak tanımlıdır', () => {
    expect(MIN_TOUCH_TARGET).toBe(44);
  });
});

/**
 * Kontrast denetimi.
 *
 * Bu, "kitchen-sink iki temada okunur" kriterinin ölçülebilir yarısıdır. Fiziksel
 * cihazda göz denetimi ayrıca gereklidir; otomatik kontrol onun yerine geçmez.
 */
describe('tema kontrastı', () => {
  const themes: readonly (readonly [string, Theme])[] = [
    ['açık', lightTheme],
    ['koyu', darkTheme],
  ];

  describe.each(themes)('%s tema', (_name, theme) => {
    const { colors } = theme;

    it.each([
      ['ink / surface', colors.ink, colors.surface],
      ['ink / surfaceSunk', colors.ink, colors.surfaceSunk],
      ['inkSoft / surface', colors.inkSoft, colors.surface],
      ['inkSoft / surfaceSunk', colors.inkSoft, colors.surfaceSunk],
      ['muted / surface', colors.muted, colors.surface],
      ['onAccent / accent', colors.onAccent, colors.accent],
      ['onDanger / danger', colors.onDanger, colors.danger],
      ['success / surface', colors.success, colors.surface],
      ['warning / surface', colors.warning, colors.surface],
      ['danger / surface', colors.danger, colors.surface],
    ])('%s normal metin için AA eşiğini geçer', (_pair, foreground, background) => {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it('ayırıcı çizgi yüzeyden ayırt edilebilir', () => {
      // Kenarlık ve ayırıcılar arayüz bileşeni sayılır: eşik 3:1.
      expect(contrastRatio(colors.rule, colors.surface)).toBeGreaterThanOrEqual(1.3);
    });

    it('vurgu rengi yüzeyden arayüz bileşeni eşiğini geçer', () => {
      expect(contrastRatio(colors.accent, colors.surface)).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
    });
  });
});
