import { Pressable, View } from 'react-native';

import { Text } from './text';
import { useTheme } from './theme-provider';
import { MIN_TOUCH_TARGET } from './theme';

export type CheckboxProps = {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly accessibilityHint?: string;
  readonly testID?: string;
};

const BOX_SIZE = 24;

/**
 * Onay kutusu.
 *
 * Seçili durum renkle değil, işaret karakteriyle ve erişilebilirlik durumuyla da
 * anlatılır; böylece renk körlüğünde ve yüksek kontrast modunda anlam korunur.
 */
export function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
  accessibilityHint,
  testID,
}: CheckboxProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      {...(accessibilityHint === undefined ? {} : { accessibilityHint })}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      testID={testID}
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: theme.spacing.md,
        minHeight: MIN_TOUCH_TARGET,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: checked ? theme.colors.accent : theme.colors.surfaceSunk,
          borderColor: disabled
            ? theme.colors.rule
            : checked
              ? theme.colors.accent
              : theme.colors.inkSoft,
          borderRadius: theme.radius.sm,
          borderWidth: 2,
          height: BOX_SIZE,
          justifyContent: 'center',
          width: BOX_SIZE,
        }}
      >
        {checked ? (
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            tone="onAccent"
            variant="caption"
            style={{ fontWeight: '700' }}
          >
            ✓
          </Text>
        ) : null}
      </View>

      <Text tone={disabled ? 'muted' : 'ink'} style={{ flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}
