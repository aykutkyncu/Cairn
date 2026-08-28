/**
 * WCAG kontrast oranı hesabı.
 *
 * Tema tokenlarının okunabilirliğini otomatik denetlemek için kullanılır.
 * Faz 14'te tüm metin/arka plan çiftlerine genişletilecektir.
 */

/** WCAG 2.2 AA: normal metin için en az 4.5:1. */
export const AA_NORMAL_TEXT = 4.5;
/** WCAG 2.2 AA: büyük metin ve arayüz bileşenleri için en az 3:1. */
export const AA_LARGE_TEXT = 3;

const HEX_PATTERN = /^#([0-9a-f]{6})$/i;

type Rgb = { readonly r: number; readonly g: number; readonly b: number };

export const parseHex = (value: string): Rgb => {
  const match = HEX_PATTERN.exec(value.trim());
  if (match === null) {
    throw new Error(`Beklenen biçim #rrggbb, alınan: ${value}`);
  }
  const hex = match[1] ?? '';
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
};

const channelLuminance = (channel: number): number => {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
};

export const relativeLuminance = (color: string): number => {
  const { r, g, b } = parseHex(color);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
};

/** İki renk arasındaki WCAG kontrast oranı (1:1 ile 21:1 arası). */
export const contrastRatio = (foreground: string, background: string): number => {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
};
