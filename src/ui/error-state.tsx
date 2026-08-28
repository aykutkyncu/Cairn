import { View } from 'react-native';

import { Button } from './button';
import { Text } from './text';
import { useTheme } from './theme-provider';

export type ErrorStateProps = {
  readonly title: string;
  /**
   * Kullanıcıya gösterilecek açıklama.
   *
   * Sözleşme gereği burada teknik hata metni, yığın izi veya sağlık verisi yer almaz;
   * yalnız kullanıcının ne yapabileceğini anlatan sade bir cümle bulunur.
   */
  readonly description: string;
  readonly retryLabel?: string;
  readonly onRetry?: () => void;
};

/** Hata durumu. Anlam renkle değil, "Hata" etiketi ve metinle taşınır. */
export function ErrorState({
  title,
  description,
  retryLabel = 'Tekrar dene',
  onRetry,
}: ErrorStateProps) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`Hata. ${title}. ${description}`}
      style={{ alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.xl }}
    >
      <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
        HATA
      </Text>
      <Text variant="title" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text tone="inkSoft" style={{ textAlign: 'center' }}>
        {description}
      </Text>
      {onRetry === undefined ? null : (
        <View style={{ marginTop: theme.spacing.sm }}>
          <Button label={retryLabel} onPress={onRetry} variant="secondary" />
        </View>
      )}
    </View>
  );
}
