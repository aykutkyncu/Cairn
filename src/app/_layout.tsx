import { Stack } from 'expo-router';

import { ThemeProvider } from '@/ui';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
