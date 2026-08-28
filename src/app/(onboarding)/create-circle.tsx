import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as Localization from 'expo-localization';

import { createCircle, useAuthStore, type AuthErrorCode } from '@/features/auth';
import { Button, Card, Input, Text, useTheme } from '@/ui';

/**
 * Çember kurma ekranı.
 *
 * Davetsiz gelen kullanıcı için ilk adım: bakılan kişinin adı ve çemberin
 * zaman dilimi. Zaman dilimi ÇEMBERE aittir, cihaza değil — İstanbul'daki ve
 * Berlin'deki iki bakım veren aynı günü aynı gün olarak görmelidir.
 */

const ERROR_MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
  not_configured: 'Uygulama henüz sunucuya bağlı değil.',
  rate_limited: 'Çok fazla deneme yapıldı. Biraz bekle.',
  network: 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.',
  invitation_invalid: 'Bu davet geçersiz.',
  invitation_expired: 'Bu davetin süresi dolmuş.',
  invitation_already_used: 'Bu davet daha önce kullanılmış.',
  forbidden: 'Bu işlem için yetkin yok.',
  unauthenticated: 'Önce giriş yapmalısın.',
  unknown: 'Çember oluşturulamadı. Tekrar deneyebilirsin.',
};

/** Cihaz saat dilimi yalnız BAŞLANGIÇ ÖNERİSİDİR; kullanıcı değiştirebilir. */
const suggestedTimezone = (): string => {
  const calendar = Localization.getCalendars()[0];
  return calendar?.timeZone ?? 'Europe/Istanbul';
};

type ScreenState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'error'; readonly code: AuthErrorCode };

export default function CreateCircleScreen() {
  const theme = useTheme();
  const setActiveCircleId = useAuthStore((store) => store.setActiveCircleId);

  const [careRecipientName, setCareRecipientName] = useState('');
  const [timezone, setTimezone] = useState(suggestedTimezone);
  const [state, setState] = useState<ScreenState>({ kind: 'idle' });

  const canSubmit = careRecipientName.trim().length > 0 && state.kind !== 'saving';

  const handleSubmit = async (): Promise<void> => {
    setState({ kind: 'saving' });
    const result = await createCircle(careRecipientName.trim(), timezone.trim());

    if (!result.ok) {
      setState({ kind: 'error', code: result.code });
      return;
    }

    setActiveCircleId(result.data);
    setState({ kind: 'idle' });
  };

  return (
    <ScrollView
      contentContainerStyle={{ gap: theme.spacing.lg, padding: theme.spacing.xl }}
      style={{ backgroundColor: theme.colors.surface }}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text accessibilityRole="header" variant="title">
          Kimin bakımını paylaşıyorsun?
        </Text>
        <Text tone="inkSoft">
          Bu bilgi yalnız çemberine kattığın kişilerle paylaşılır. Bildirim metinlerinde ve
          paylaşılan özetlerde görünmez.
        </Text>
      </View>

      <Card>
        <Input
          autoCapitalize="words"
          label="Bakılan kişinin adı"
          onChangeText={setCareRecipientName}
          placeholder="Örnek: Ayşe Yılmaz"
          required
          value={careRecipientName}
        />

        <Input
          autoCapitalize="none"
          hint="Görevler ve günlük özet bu saat dilimine göre hesaplanır. Farklı şehirlerdeki üyeler aynı günü görür."
          label="Çemberin zaman dilimi"
          onChangeText={setTimezone}
          value={timezone}
        />

        <Button
          disabled={!canSubmit}
          label="Çemberi oluştur"
          loading={state.kind === 'saving'}
          loadingLabel="Oluşturuluyor"
          onPress={() => {
            void handleSubmit();
          }}
        />
      </Card>

      {state.kind === 'error' ? (
        <Card variant="sunk">
          <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
            HATA
          </Text>
          <Text>{ERROR_MESSAGES[state.code]}</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}
