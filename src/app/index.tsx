import { View } from 'react-native';

import { Text, useTheme } from '@/ui';

export default function IndexScreen() {
  const theme = useTheme();

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
