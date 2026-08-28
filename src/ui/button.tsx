import {
  ActivityIndicator,
  Pressable,
  View,
  type AccessibilityProps,
  type PressableProps,
} from 'react-native';

import { Text, type TextTone } from './text';
import { useTheme } from './theme-provider';
import { MIN_TOUCH_TARGET, type ColorTokens } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = Pick<AccessibilityProps, 'accessibilityHint'> & {
  readonly label: string;
  readonly onPress: PressableProps['onPress'];
  readonly variant?: ButtonVariant;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  /** Yükleme sırasında ekran okuyucuya iletilen açıklama. */
  readonly loadingLabel?: string;
  readonly testID?: string;
};

type VariantStyle = {
  readonly background: string;
  readonly border: string;
  readonly foreground: TextTone;
};

const variantStyle = (variant: ButtonVariant, colors: ColorTokens): VariantStyle => {
  switch (variant) {
    case 'primary':
      return { background: colors.accent, border: colors.accent, foreground: 'onAccent' };
    case 'danger':
      return { background: colors.danger, border: colors.danger, foreground: 'onDanger' };
    case 'secondary':
      return { background: colors.surface, border: colors.rule, foreground: 'ink' };
    case 'ghost':
      return { background: 'transparent', border: 'transparent', foreground: 'accent' };
  }
};

/**
 * Erişilebilir birincil eylem bileşeni.
 *
 * Devre dışı ve yükleme durumu renkle değil, erişilebilirlik durumu ve metinle de
 * anlatılır. Dokunma hedefi hiçbir durumda 44 pt altına inmez.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  loadingLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const style = variantStyle(variant, theme.colors);
  const isInteractionBlocked = disabled || loading;
  const tone = isInteractionBlocked ? 'muted' : style.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading && loadingLabel !== undefined ? loadingLabel : label}
      accessibilityState={{ disabled: isInteractionBlocked, busy: loading }}
      {...(accessibilityHint === undefined ? {} : { accessibilityHint })}
      disabled={isInteractionBlocked}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: isInteractionBlocked ? theme.colors.surfaceSunk : style.background,
        borderColor: isInteractionBlocked ? theme.colors.rule : style.border,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        flexDirection: 'row',
        gap: theme.spacing.sm,
        justifyContent: 'center',
        minHeight: MIN_TOUCH_TARGET,
        opacity: pressed ? 0.85 : 1,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
      })}
    >
      {loading ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ActivityIndicator color={theme.colors[tone]} size="small" />
        </View>
      ) : null}
      <Text tone={tone} variant="body" style={{ fontWeight: '600' }}>
        {loading && loadingLabel !== undefined ? loadingLabel : label}
      </Text>
    </Pressable>
  );
}
