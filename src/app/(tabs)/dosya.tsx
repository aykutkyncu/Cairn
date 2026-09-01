import { ScrollView, View } from 'react-native';

import { CircleGate } from '@/features/circles';
import { EmptyState, Text, useTheme } from '@/ui';

/**
 * Dosya sekmesi.
 *
 * İlaç listesi, ölçümler, belgeler ve acil durum kartı Faz 06 ve sonrasında gelir.
 * Sağlık verisi burada toplanacağı için katman sınırları şimdiden kurulur.
 */
export default function DosyaScreen() {
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
              Dosya
            </Text>
            <EmptyState
              title="Dosya henüz boş"
              description="İlaçlar, ölçümler ve belgeler sonraki adımlarda burada toplanacak."
            />
          </View>
        )}
      </CircleGate>
    </ScrollView>
  );
}
