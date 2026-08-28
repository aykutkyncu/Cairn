import { View } from 'react-native';

import { Text, type TextTone } from './text';
import { useTheme } from './theme-provider';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export type BadgeProps = {
  readonly label: string;
  readonly tone?: BadgeTone;
};

const TEXT_TONE: Readonly<Record<BadgeTone, TextTone>> = {
  neutral: 'inkSoft',
  accent: 'accent',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

/**
 * Durum etiketi.
 *
 * Anlam metnin kendisindedir; renk yalnız destekleyicidir. Bu yüzden renk körlüğünde
 * veya tek renkli çıktıda bilgi kaybolmaz.
 */
export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const theme = useTheme();
  const textTone = TEXT_TONE[tone];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: theme.colors.surfaceSunk,
        borderColor: tone === 'neutral' ? theme.colors.rule : theme.colors[textTone],
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
      }}
    >
      <Text tone={textTone} variant="caption" style={{ fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}
