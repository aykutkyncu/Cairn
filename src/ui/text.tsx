import { Platform, StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from './theme-provider';
import { type TypographyVariant } from './theme';

export type TextTone =
  | 'ink'
  | 'inkSoft'
  | 'muted'
  | 'accent'
  | 'onAccent'
  | 'onDanger'
  | 'success'
  | 'warning'
  | 'danger';

export type TextProps = Omit<RNTextProps, 'style'> & {
  readonly variant?: TypographyVariant;
  readonly tone?: TextTone;
  readonly style?: RNTextProps['style'];
};

const monoFontFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

/**
 * Uygulamanın tek metin bileşeni.
 *
 * Sistem fontunu kullanır ve dinamik yazı boyutunu daima izler. Satır yüksekliği
 * ölçekle birlikte büyür; sabit yükseklik verilmez, bu yüzden metin kırpılmaz.
 */
export function Text({ variant = 'body', tone = 'ink', style, ...rest }: TextProps) {
  const theme = useTheme();
  const scale = theme.typography[variant];

  return (
    <RNText
      allowFontScaling
      style={[
        styles.base,
        {
          color: theme.colors[tone],
          fontSize: scale.fontSize,
          lineHeight: scale.lineHeight,
          fontWeight: scale.fontWeight,
        },
        variant === 'mono' ? { fontFamily: monoFontFamily } : null,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  // Yükseklik bilinçli olarak tanımsız bırakılır: metin büyüdükçe kutu da büyür.
  base: { includeFontPadding: false },
});
