import { ScrollView, View } from 'react-native';

import { CircleGate } from '@/features/circles';
import { EmptyState, Text, useTheme } from '@/ui';

/**
 * Daha fazlası sekmesi.
 *
 * Ayarlar, üyeler, gizlilik tercihleri ve oturum kapatma buraya gelir.
 */
export default function DahaFazlasiScreen() {
  const theme = useTheme();

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.spacing.lg }}
      style={{ backgroundColor: theme.colors.surface }}
    >
      <CircleGate>
        {() => (
          <View style={{ gap: theme.spacing.md }}>
            <Text accessibilityRole="header" variant="display">
              Daha fazlası
            </Text>
            <EmptyState
              title="Ayarlar hazırlanıyor"
              description="Üyeler, bildirim tercihleri ve gizlilik ayarları sonraki adımlarda eklenecek."
            />
          </View>
        )}
      </CircleGate>
    </ScrollView>
  );
}
