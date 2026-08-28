import { View } from 'react-native';

import { Button } from './button';
import { Text } from './text';
import { useTheme } from './theme-provider';

export type EmptyStateProps = {
  readonly title: string;
  readonly description: string;
  /** Kullanıcıyı ileri taşıyan tek eylem. */
  readonly actionLabel?: string;
  readonly onAction?: () => void;
};

/** Veri yokken gösterilen sakin durum. Hata değildir; bunu tonuyla belli eder. */
export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${description}`}
      style={{ alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.xl }}
    >
      <Text variant="title" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text tone="inkSoft" style={{ textAlign: 'center' }}>
        {description}
      </Text>
      {actionLabel !== undefined && onAction !== undefined ? (
        <View style={{ marginTop: theme.spacing.sm }}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}
