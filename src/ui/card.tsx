import { View, type ViewProps } from 'react-native';

import { useTheme } from './theme-provider';

export type CardProps = ViewProps & {
  /** 'sunk' varyantı gömülü yüzey kullanır; gölge yerine zıtlıkla ayrışır. */
  readonly variant?: 'raised' | 'sunk';
};

export function Card({ variant = 'raised', style, children, ...rest }: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: variant === 'raised' ? theme.colors.surface : theme.colors.surfaceSunk,
          borderColor: theme.colors.rule,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          gap: theme.spacing.sm,
          padding: theme.spacing.lg,
        },
        variant === 'raised' ? theme.elevation.card : theme.elevation.none,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
