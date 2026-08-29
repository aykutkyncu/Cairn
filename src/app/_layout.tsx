import { Stack, router } from 'expo-router';

import { AppProviders } from '@/features/app-shell';

export default function RootLayout() {
  return (
    <AppProviders onGoHome={() => router.replace('/')}>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}
