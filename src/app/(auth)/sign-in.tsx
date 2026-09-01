import { useState } from 'react';
import { View } from 'react-native';

import { authRedirectUrl, sendMagicLink, type AuthErrorCode } from '@/features/auth';
import { Button, Card, Input, Text, useTheme } from '@/ui';

/**
 * Giriş ekranı.
 *
 * E-posta magic-link ile giriş. Şifre YOKTUR: bakım veren, hatırlaması gereken
 * bir parola daha istemez.
 *
 * Google ve Apple ile giriş bilinçli olarak eklenmemiştir. Bunlar OAuth
 * yapılandırması, izin ekranları, redirect allowlist'i ve fiziksel cihazda
 * gerçek test gerektirir; bunlar sağlanmadan düğme göstermek çalışmayan bir
 * akış vaat etmek olur.
 */

const ERROR_MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
  not_configured: 'Uygulama henüz sunucuya bağlı değil. Bu bir kurulum adımı.',
  rate_limited: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.',
  network: 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.',
  invitation_invalid: 'Bu davet geçersiz.',
  invitation_expired: 'Bu davetin süresi dolmuş.',
  invitation_already_used: 'Bu davet daha önce kullanılmış.',
  forbidden: 'Bu işlem için yetkin yok.',
  unauthenticated: 'Önce giriş yapmalısın.',
  unknown: 'Beklenmeyen bir sorun oldu. Tekrar deneyebilirsin.',
};

type ScreenState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'sent' }
  | { readonly kind: 'error'; readonly code: AuthErrorCode };

const isPlausibleEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function SignInScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<ScreenState>({ kind: 'idle' });

  const canSubmit = isPlausibleEmail(email) && state.kind !== 'sending';

  const handleSubmit = async (): Promise<void> => {
    setState({ kind: 'sending' });
    // Dönüş adresi platforma göre değişir: native'de uygulama şeması,
    // web'de sayfanın kendi kökü. Bkz. features/auth/auth-redirect.ts
    const result = await sendMagicLink(email.trim(), authRedirectUrl());
    // Başarı mesajı, e-postanın kayıtlı olup olmadığından bağımsız gösterilir;
    // aksi halde hangi adreslerin sistemde olduğu sızardı.
    setState(result.ok ? { kind: 'sent' } : { kind: 'error', code: result.code });
  };

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        flex: 1,
        gap: theme.spacing.lg,
        justifyContent: 'center',
        padding: theme.spacing.xl,
      }}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text accessibilityRole="header" variant="display">
          Cairn
        </Text>
        <Text tone="inkSoft">
          Bakımı paylaşan aileler için ortak operasyon uygulaması. Giriş için e-posta adresine bir
          bağlantı gönderiyoruz; şifre gerekmiyor.
        </Text>
      </View>

      <Card>
        <Input
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label="E-posta"
          onChangeText={(value) => {
            setEmail(value);
            if (state.kind === 'error' || state.kind === 'sent') setState({ kind: 'idle' });
          }}
          placeholder="ornek@eposta.com"
          required
          value={email}
        />

        <Button
          disabled={!canSubmit}
          label="Giriş bağlantısı gönder"
          loading={state.kind === 'sending'}
          loadingLabel="Gönderiliyor"
          onPress={() => {
            void handleSubmit();
          }}
        />
      </Card>

      {state.kind === 'sent' ? (
        <Card variant="sunk">
          <Text tone="success" variant="caption" style={{ fontWeight: '700' }}>
            GÖNDERİLDİ
          </Text>
          <Text>
            Bağlantı gönderildi. E-postandaki bağlantıya bu cihazdan dokunarak giriş yapabilirsin.
            Bağlantı kısa süre geçerlidir.
          </Text>
        </Card>
      ) : null}

      {state.kind === 'error' ? (
        <Card variant="sunk">
          <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
            HATA
          </Text>
          <Text>{ERROR_MESSAGES[state.code]}</Text>
        </Card>
      ) : null}
    </View>
  );
}
