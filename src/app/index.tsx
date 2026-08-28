import { StyleSheet, Text, View } from 'react-native';

export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Cairn
      </Text>
      <Text style={styles.subtitle}>Bakımı paylaşan aileler için ortak operasyon uygulaması.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1, gap: 8, justifyContent: 'center', padding: 24 },
  subtitle: { fontSize: 16, textAlign: 'center' },
  title: { fontSize: 32, fontWeight: '600' },
});
