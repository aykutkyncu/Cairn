import { View } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuthStore } from '@/features/auth';
import { Text, useTheme } from '@/ui';

/**
 * Uygulamanın giriş noktası.
 *
 * Oturum durumu okunana kadar yönlendirme YAPILMAZ: `loading` durumunda
 * giriş ekranına atmak, oturumu olan bir kullanıcıyı her açılışta bir an
 * için çıkış yapmış gibi gösterirdi.
 */
export default function IndexScreen() {
  const theme = useTheme();
  const status = useAuthStore((state) => state.status);

  if (status === 'signed-in') return <Redirect href="/(tabs)/bugun" />;
  if (status === 'signed-out') return <Redirect href="/(auth)/sign-in" />;

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        flex: 1,
        gap: theme.spacing.sm,
        justifyContent: 'center',
        padding: theme.spacing.xl,
      }}
    >
      <Text accessibilityRole="header" variant="display">
        Cairn
      </Text>
      <Text tone="inkSoft" style={{ textAlign: 'center' }}>
        Bakımı paylaşan aileler için ortak operasyon uygulaması.
      </Text>
    </View>
  );
}
