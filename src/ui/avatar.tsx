import { View } from 'react-native';

import { Text } from './text';
import { useTheme } from './theme-provider';

export type AvatarProps = {
  /** Kişinin görünen adı. Baş harfler bundan türetilir. */
  readonly name: string;
  readonly size?: 'sm' | 'md' | 'lg';
};

const SIZES = { sm: 28, md: 36, lg: 48 } as const;

/** Ad metninden en çok iki baş harf üretir. */
export const initialsFromName = (name: string): string => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return '?';
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return (first + last).toLocaleUpperCase('tr-TR');
};

/**
 * Kişi göstergesi.
 *
 * Baş harfler yalnız görseldir; ekran okuyucu kişinin tam adını okur.
 */
export function Avatar({ name, size = 'md' }: AvatarProps) {
  const theme = useTheme();
  const dimension = SIZES[size];

  return (
    <View
      accessible
      accessibilityLabel={name}
      accessibilityRole="image"
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceSunk,
        borderColor: theme.colors.rule,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        height: dimension,
        justifyContent: 'center',
        width: dimension,
      }}
    >
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        tone="inkSoft"
        variant="caption"
        style={{ fontWeight: '600' }}
      >
        {initialsFromName(name)}
      </Text>
    </View>
  );
}
