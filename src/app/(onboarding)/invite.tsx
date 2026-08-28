import { useState } from 'react';
import { Share, ScrollView, View } from 'react-native';

import {
  createInvitation,
  generateInvitationToken,
  useAuthStore,
  type AuthErrorCode,
} from '@/features/auth';
import { Button, Card, Text, useTheme } from '@/ui';

/**
 * Aile davet ekranı.
 *
 * Davet bağlantısı cihazın KENDİ paylaşım sayfasıyla iletilir. Belirli bir
 * uygulamaya (WhatsApp gibi) kesin gönderim vaat edilmez: hangi uygulamaların
 * kurulu olduğunu ve kullanıcının hangisini seçeceğini bilemeyiz.
 *
 * Ham token yalnız bu ekranda ve paylaşım metninde bulunur. Sunucuya yalnız
 * SHA-256 hash'i gider; düz token veritabanına, loglara veya hata raporlarına
 * hiçbir aşamada yazılmaz.
 */

/**
 * Davet bağlantısının web karşılığı.
 *
 * UYARI: Bu alan adı henüz YOKTUR. Uygulama kurulu değilken çalışan web
 * fallback'i ve mağaza yönlendirmesi için doğrulanmış bir alan adı, Universal
 * Links (iOS) ve App Links (Android) yapılandırması ve gerçek cihaz test planı
 * gerekir. Supabase bunu otomatik sağlamaz. O kurulum yapılana kadar bağlantı
 * yalnız uygulama şeması ile çalışır.
 */
const INVITE_BASE_URL = 'cairn://invite';

const ERROR_MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
  not_configured: 'Uygulama henüz sunucuya bağlı değil.',
  rate_limited: 'Kısa sürede çok fazla davet oluşturuldu. Biraz bekle.',
  network: 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.',
  invitation_invalid: 'Davet oluşturulamadı.',
  invitation_expired: 'Davet oluşturulamadı.',
  invitation_already_used: 'Davet oluşturulamadı.',
  forbidden: 'Bu çembere davet etme yetkin yok.',
  unauthenticated: 'Önce giriş yapmalısın.',
  unknown: 'Davet oluşturulamadı. Tekrar deneyebilirsin.',
};

type ScreenState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'creating' }
  | { readonly kind: 'ready'; readonly link: string }
  | { readonly kind: 'error'; readonly code: AuthErrorCode };

export default function InviteScreen() {
  const theme = useTheme();
  const activeCircleId = useAuthStore((store) => store.activeCircleId);
  const [state, setState] = useState<ScreenState>({ kind: 'idle' });

  const handleCreate = async (): Promise<void> => {
    if (activeCircleId === null) {
      setState({ kind: 'error', code: 'forbidden' });
      return;
    }

    setState({ kind: 'creating' });

    const token = await generateInvitationToken();
    const result = await createInvitation(activeCircleId, token);

    if (!result.ok) {
      setState({ kind: 'error', code: result.code });
      return;
    }

    setState({ kind: 'ready', link: `${INVITE_BASE_URL}/${token}` });
  };

  const handleShare = async (link: string): Promise<void> => {
    try {
      // Cihazın standart paylaşım sayfası. Hangi uygulamayla gönderileceğine
      // kullanıcı karar verir.
      await Share.share({
        message: `Cairn'de bakım çemberime katılman için seni davet ediyorum: ${link}`,
      });
    } catch {
      // Kullanıcı paylaşımı iptal etmiş olabilir; bu hata değildir.
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ gap: theme.spacing.lg, padding: theme.spacing.xl }}
      style={{ backgroundColor: theme.colors.surface }}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text accessibilityRole="header" variant="title">
          Aileni davet et
        </Text>
        <Text tone="inkSoft">
          Davet bağlantısı 7 gün geçerlidir ve yalnız bir kez kullanılabilir. Katılan kişi görev
          ekleyip tamamlayabilir; üye yönetimi sende kalır.
        </Text>
      </View>

      {state.kind === 'ready' ? (
        <Card>
          <Text variant="caption" tone="muted">
            Davet bağlantısı
          </Text>
          <Text variant="mono" selectable>
            {state.link}
          </Text>
          <Button
            label="Paylaş"
            onPress={() => {
              void handleShare(state.link);
            }}
          />
          <Text tone="muted" variant="caption">
            Bağlantıyı yalnız davet etmek istediğin kişiye gönder. Bağlantıya sahip olan herkes
            çembere katılabilir.
          </Text>
        </Card>
      ) : (
        <Card>
          <Button
            disabled={state.kind === 'creating'}
            label="Davet bağlantısı oluştur"
            loading={state.kind === 'creating'}
            loadingLabel="Oluşturuluyor"
            onPress={() => {
              void handleCreate();
            }}
          />
        </Card>
      )}

      {state.kind === 'error' ? (
        <Card variant="sunk">
          <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
            HATA
          </Text>
          <Text>{ERROR_MESSAGES[state.code]}</Text>
        </Card>
      ) : null}

      <Card variant="sunk">
        <Text variant="caption" tone="muted">
          Bu adımı atlayabilirsin. Aileni daha sonra da davet edebilirsin.
        </Text>
      </Card>
    </ScrollView>
  );
}
