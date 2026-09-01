import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { completeMagicLink, type AuthErrorCode } from '@/features/auth';
import { Button, Text, useTheme } from '@/ui';

/**
 * Magic-link dönüş ekranı (`cairn://auth/callback`).
 *
 * NATIVE'DE ZORUNLUDUR: Supabase istemcisi native'de `detectSessionInUrl`
 * kapalı çalışır, çünkü derin bağlantılar uygulamanın kendi yönlendirme
 * katmanında doğrulanarak işlenir. Bu ekran o katmanın son adımıdır — o
 * olmadan e-postadaki bağlantı uygulamayı açar ama oturum hiç açılmaz.
 *
 * Web'de bu rotaya normalde gelinmez: orada dönüş adresi sayfanın kökü olur
 * ve kodu istemci kendisi takas eder. Yine de elle gelinirse ekran hata
 * göstermez, yalnız kod yoksa giriş ekranına döner.
 *
 * Koda log'da, hata raporunda veya arayüzde yer verilmez; tek kullanımlıktır
 * ve oturum açmaya yeter.
 */

const ERROR_MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
  not_configured: 'Uygulama henüz sunucuya bağlı değil. Bu bir kurulum adımı.',
  rate_limited: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.',
  network: 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.',
  invitation_invalid: 'Bu davet geçersiz.',
  invitation_expired: 'Bu davetin süresi dolmuş.',
  invitation_already_used: 'Bu davet daha önce kullanılmış.',
  forbidden: 'Bu işlem için yetkin yok.',
  unauthenticated: 'Bu giriş bağlantısı artık geçerli değil. Yeni bir bağlantı iste.',
  unknown: 'Beklenmeyen bir sorun oldu. Tekrar deneyebilirsin.',
};

type ScreenState =
  | { readonly kind: 'exchanging' }
  | { readonly kind: 'leave' }
  | { readonly kind: 'error'; readonly code: AuthErrorCode };

/** Expo Router parametreleri dizi de olabilir; ilk değer alınır. */
const firstParam = (value: string | string[] | undefined): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? '';
  return '';
};

export default function AuthCallbackScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    code?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
  }>();

  const code = firstParam(params.code);
  const serverError = firstParam(params.error);

  const [state, setState] = useState<ScreenState>(() =>
    // Sunucu hata döndürdüyse takas denemek anlamsızdır: süresi dolmuş veya
    // daha önce kullanılmış bir bağlantıdır.
    serverError.length > 0
      ? { kind: 'error', code: 'unauthenticated' }
      : code.length > 0
        ? { kind: 'exchanging' }
        : { kind: 'error', code: 'unauthenticated' },
  );

  useEffect(() => {
    if (code.length === 0 || serverError.length > 0) return;

    let active = true;
    void completeMagicLink(code).then((result) => {
      if (!active) return;
      setState(result.ok ? { kind: 'leave' } : { kind: 'error', code: result.code });
    });

    return () => {
      active = false;
    };
  }, [code, serverError]);

  // Ekrandan çıkış tek kapıdan olur: hem başarı hem de kullanıcının
  // vazgeçmesi köke döner ve nereye gidileceğine oturum durumu karar verir.
  // Buradan doğrudan sekmelere gitmek, oturum store'a yazılmadan önce çember
  // kapısına çarpabilirdi.
  if (state.kind === 'leave') return <Redirect href="/" />;

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        flex: 1,
        gap: theme.spacing.md,
        justifyContent: 'center',
        padding: theme.spacing.xl,
      }}
    >
      <Text accessibilityRole="header" variant="display">
        Cairn
      </Text>

      {state.kind === 'exchanging' ? (
        <Text tone="inkSoft" style={{ textAlign: 'center' }}>
          Giriş tamamlanıyor…
        </Text>
      ) : (
        <>
          <Text tone="inkSoft" style={{ textAlign: 'center' }}>
            {ERROR_MESSAGES[state.code]}
          </Text>
          <Button label="Giriş ekranına dön" onPress={() => setState({ kind: 'leave' })} />
        </>
      )}
    </View>
  );
}
