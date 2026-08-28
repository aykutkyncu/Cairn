import { useId } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { Text } from './text';
import { useTheme } from './theme-provider';
import { MIN_TOUCH_TARGET } from './theme';

export type InputProps = Omit<TextInputProps, 'style' | 'accessibilityLabel'> & {
  /** Görünür etiket. Aynı zamanda erişilebilir ad olarak kullanılır. */
  readonly label: string;
  /** Alanın altında görünen yardımcı açıklama. */
  readonly hint?: string;
  /** Hata metni. Boş değilse alan hatalı kabul edilir. */
  readonly errorMessage?: string;
  readonly required?: boolean;
};

/**
 * Etiketli metin girdisi.
 *
 * Hata durumu yalnız kenarlık rengiyle değil, görünür hata metniyle ve
 * erişilebilirlik durumuyla da anlatılır.
 */
export function Input({ label, hint, errorMessage, required = false, ...rest }: InputProps) {
  const theme = useTheme();
  const hintId = useId();
  const hasError = errorMessage !== undefined && errorMessage.length > 0;
  const description = hasError ? errorMessage : hint;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text nativeID={hintId} variant="caption" tone="inkSoft">
        {required ? `${label} (zorunlu)` : label}
      </Text>

      <TextInput
        accessibilityLabel={required ? `${label}, zorunlu` : label}
        {...(description === undefined ? {} : { accessibilityHint: description })}
        accessibilityState={{ disabled: rest.editable === false }}
        allowFontScaling
        placeholderTextColor={theme.colors.muted}
        style={{
          backgroundColor: theme.colors.surfaceSunk,
          borderColor: hasError ? theme.colors.danger : theme.colors.rule,
          borderRadius: theme.radius.sm,
          borderWidth: hasError ? 2 : 1,
          color: theme.colors.ink,
          fontSize: theme.typography.body.fontSize,
          lineHeight: theme.typography.body.lineHeight,
          minHeight: MIN_TOUCH_TARGET,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.md,
        }}
        {...rest}
      />

      {description === undefined ? null : (
        <Text variant="caption" tone={hasError ? 'danger' : 'muted'}>
          {hasError ? `Hata: ${description}` : description}
        </Text>
      )}
    </View>
  );
}
