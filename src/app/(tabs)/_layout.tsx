import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';

import { useOnlineStatus } from '@/features/app-shell';
import { CircleSwitcher } from '@/features/circles';
import { Divider, MIN_TOUCH_TARGET, OfflineBanner, useTheme } from '@/ui';

/**
 * Ana sekme düzeni.
 *
 * Üst bar aktif çemberi gösterir; çevrimdışı şerit onun hemen altındadır,
 * böylece kullanıcı "kim için" ve "bağlantı var mı" sorularını aynı bakışta
 * yanıtlar.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const isOnline = useOnlineStatus();

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.surface, flex: 1 }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm }}>
        <CircleSwitcher />
      </View>
      <Divider />
      <OfflineBanner isOffline={!isOnline} />

      <Tabs
        screenOptions={{
          headerShown: false,
          // Sekme içeriğinin zemini AÇIKÇA temadan gelir. Verilmezse
          // yönlendiricinin kendi beyaz zemini kalır: koyu temada başlık
          // neredeyse görünmez olur (ilk web çalıştırmasında böyle görüldü).
          sceneStyle: { backgroundColor: theme.colors.surface },
          tabBarActiveTintColor: theme.colors.accent,
          tabBarInactiveTintColor: theme.colors.muted,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.rule,
            minHeight: MIN_TOUCH_TARGET + theme.spacing.lg,
          },
        }}
      >
        <Tabs.Screen name="bugun" options={{ title: 'Bugün' }} />
        <Tabs.Screen name="takvim" options={{ title: 'Takvim' }} />
        <Tabs.Screen name="dosya" options={{ title: 'Dosya' }} />
        <Tabs.Screen name="daha-fazlasi" options={{ title: 'Daha fazlası' }} />
      </Tabs>
    </SafeAreaView>
  );
}
