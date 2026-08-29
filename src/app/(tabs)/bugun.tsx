import { ScrollView, View } from 'react-native';

import { EmptyState, Text, useTheme } from '@/ui';

import { CircleGate } from './_circle-gate';

/**
 * Bugün sekmesi.
 *
 * Görev listesi, ilerleme özeti ve tamamlama akışı Faz 05'te gelir. Bu fazda
 * ekran yalnız iskeleti ve boş durumu taşır: olmayan bir özelliği varmış gibi
 * göstermek, kullanıcının güvenini bir kez harcar.
 */
export default function BugunScreen() {
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
              Bugün
            </Text>
            <EmptyState
              title="Bakım takvimi henüz hazır değil"
              description="Görevler, hatırlatmalar ve tek dokunuşla tamamlama sonraki adımda ekleniyor."
            />
          </View>
        )}
      </CircleGate>
    </ScrollView>
  );
}
