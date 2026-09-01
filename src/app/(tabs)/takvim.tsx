import { ScrollView, View } from 'react-native';

import { CircleGate } from '@/features/circles';
import { EmptyState, Text, useTheme } from '@/ui';

/**
 * Takvim sekmesi.
 *
 * Aylık görünüm, tekrar kuralları ve randevular Faz 05 ile gelir. Bu fazda ekran
 * yalnız iskeletini taşır.
 */
export default function TakvimScreen() {
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
              Takvim
            </Text>
            <EmptyState
              title="Takvim henüz hazır değil"
              description="Randevular ve tekrar eden görevler sonraki adımda burada görünecek."
            />
          </View>
        )}
      </CircleGate>
    </ScrollView>
  );
}
