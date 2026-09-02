import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';

import { AppProviders } from '@/features/app-shell';
import { useTheme } from '@/ui';

/**
 * Kök düzen.
 *
 * Başlıksız (`headerShown: false`) ekranlar durum çubuğunun ALTINA
 * çizilirdi: cihazda ilk çalıştırmada "Takibi kimin için tutuyorsun?"
 * başlığı saatin üstüne biniyordu. Güvenli alan burada, tek yerde
 * uygulanır; her ekranın ayrı ayrı hatırlaması gereken bir şey olmamalıdır.
 *
 * Sekme düzeni kendi güvenli alanını zaten yönetir; buradaki kenarlık üst
 * kenardır ve iç içe kullanım fazladan boşluk üretmez.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProviders onGoHome={() => router.replace('/')}>
        <SafeArea>
          <Stack screenOptions={{ headerShown: false }} />
        </SafeArea>
      </AppProviders>
    </SafeAreaProvider>
  );
}

function SafeArea({ children }: { readonly children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.surface, flex: 1 }}>
      {children}
    </SafeAreaView>
  );
}
