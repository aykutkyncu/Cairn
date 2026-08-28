/**
 * Cairn tasarım tokenları.
 *
 * Marka fikri dağ patikalarındaki taş işaretidir (cairn): sakin, sıcak, güven veren
 * ve klinik olmayan. Palet sıcak taş/kum nötrleri ve yosun yeşili bir vurgudan oluşur.
 * Turkuaz, mor degrade ve neon kullanılmaz.
 *
 * Bu dosya, doğrudan renk değeri (hex) yazılmasına izin verilen TEK modüldür.
 * Diğer tüm modüller renge yalnız semantik token üzerinden erişir.
 */

/** Anlamı olan renk rolleri. Ham renk adı değil, kullanım amacı taşır. */
export type ColorTokens = {
  /** Ekranın taban yüzeyi. */
  readonly surface: string;
  /** Taban yüzeyin içine gömülü alanlar: kart arkası, girdi zemini. */
  readonly surfaceSunk: string;
  /** Birincil metin. */
  readonly ink: string;
  /** İkincil metin: açıklama, yardımcı satır. */
  readonly inkSoft: string;
  /** Üçüncül metin: etiket, zaman damgası, devre dışı içerik. */
  readonly muted: string;
  /** Ayırıcı çizgi ve kenarlık. */
  readonly rule: string;
  /** Birincil eylem ve seçili durum. */
  readonly accent: string;
  /** Vurgu üzerindeki metin/ikon. */
  readonly onAccent: string;
  /** Tamamlanmış, olumlu durum. */
  readonly success: string;
  /** Dikkat gerektiren ama hata olmayan durum. */
  readonly warning: string;
  /** Hata ve yıkıcı eylem. */
  readonly danger: string;
  /** Tehlike renginin üzerindeki metin/ikon. */
  readonly onDanger: string;
  /** Sheet arkasındaki karartma. */
  readonly scrim: string;
};

/** 4 pt tabanlı boşluk düzeni. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Köşe yarıçapları. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/**
 * Erişilebilir en küçük dokunma hedefi (pt).
 * Sözleşme gereği hiçbir etkileşimli öğe bunun altına inmez.
 */
export const MIN_TOUCH_TARGET = 44;

/** Tipografi ölçeği. Yükseklikler sabit değil, en az değerdir; metin büyüyebilir. */
export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '600' },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 20, fontWeight: '400' },
  mono: { fontSize: 14, lineHeight: 22, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Yumuşak, klinik olmayan yükselti. */
export const elevation = {
  none: {
    shadowColor: '#000000',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sheet: {
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
} as const;

const lightColors: ColorTokens = {
  surface: '#FBF8F4',
  surfaceSunk: '#F0EAE1',
  ink: '#241F1A',
  inkSoft: '#544C43',
  muted: '#6E655C',
  rule: '#DED5C9',
  accent: '#4A6141',
  onAccent: '#FBF8F4',
  success: '#2F5E36',
  warning: '#7A5314',
  danger: '#8C3A2F',
  onDanger: '#FBF8F4',
  scrim: 'rgba(36, 31, 26, 0.45)',
};

const darkColors: ColorTokens = {
  surface: '#17150F',
  surfaceSunk: '#211E17',
  ink: '#F4EFE7',
  inkSoft: '#CFC5B8',
  muted: '#A79C8E',
  rule: '#38322A',
  accent: '#A8BE96',
  onAccent: '#17150F',
  success: '#8FBF87',
  warning: '#E0B26A',
  danger: '#E89588',
  onDanger: '#17150F',
  scrim: 'rgba(0, 0, 0, 0.6)',
};

export type ThemeName = 'light' | 'dark';

export type Theme = {
  readonly name: ThemeName;
  readonly colors: ColorTokens;
  readonly spacing: typeof spacing;
  readonly radius: typeof radius;
  readonly typography: typeof typography;
  readonly elevation: typeof elevation;
};

export const lightTheme: Theme = {
  name: 'light',
  colors: lightColors,
  spacing,
  radius,
  typography,
  elevation,
};

export const darkTheme: Theme = {
  name: 'dark',
  colors: darkColors,
  spacing,
  radius,
  typography,
  elevation,
};

export const themes: Readonly<Record<ThemeName, Theme>> = {
  light: lightTheme,
  dark: darkTheme,
};
