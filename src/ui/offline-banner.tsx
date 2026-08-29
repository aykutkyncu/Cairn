import { View } from 'react-native';

import { Text } from './text';
import { useTheme } from './theme-provider';

/**
 * Çevrimdışı şeridi.
 *
 * Sözleşme gereği **sakin**dir: kırmızı değil, uyarı tonundadır ve hata gibi
 * görünmez. Çevrimdışı olmak bir arıza değildir; kullanıcı asansörde,
 * hastane bodrumunda veya uçakta olabilir.
 *
 * Anlam yalnız renkle taşınmaz: metin durumu açıkça söyler ve erişilebilirlik
 * duyurusu ekran okuyucuya iletilir.
 */

export type OfflineBannerProps = {
  readonly isOffline: boolean;
  /**
   * Bekleyen değişiklik sayısı.
   *
   * Yalnız kalıcı kuyruğa BAŞARIYLA yazılmış değişiklikler sayılır.
   * Kaydedilmemiş bir değişikliği "kaydedildi" gibi göstermek yasaktır.
   */
  readonly pendingCount?: number;
};

export function OfflineBanner({ isOffline, pendingCount = 0 }: OfflineBannerProps) {
  const theme = useTheme();

  if (!isOffline) return null;

  const message =
    pendingCount > 0
      ? `Çevrimdışısın. ${pendingCount} değişiklik cihazında bekliyor, bağlantı gelince gönderilecek.`
      : 'Çevrimdışısın. Kayıtlı bilgileri görmeye devam edebilirsin.';

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
      style={{
        backgroundColor: theme.colors.surfaceSunk,
        borderBottomColor: theme.colors.rule,
        borderBottomWidth: 1,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <Text tone="inkSoft" variant="caption">
        {message}
      </Text>
    </View>
  );
}
