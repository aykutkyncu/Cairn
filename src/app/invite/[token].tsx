import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import {
  acceptInvitation,
  isWellFormedInvitationToken,
  useAuthStore,
  type AuthErrorCode,
} from '@/features/auth';
import { Button, Card, Text, useTheme } from '@/ui';

/**
 * Davet bağlantısının açtığı ekran.
 *
 * Derin bağlantı parametreleri DOĞRULANMADAN kullanılmaz: gelen değer önce Zod
 * ile şekil olarak, sonra token alfabesine göre biçimsel olarak denetlenir.
 * Gerçek yetki kararı sunucudaki atomik kabul işlemine aittir; buradaki
 * kontroller yalnız açıkça bozuk girdiyi eler.
 *
 * Oturum yoksa kullanıcı giriş yapmaya yönlendirilir ve giriş sonrası bu
 * ekrana geri döner; token bu süre boyunca yalnız bellekte tutulur.
 *
 * Ekran durumu render sırasında TÜRETİLİR, effect içinde kurulmaz. Effect
 * yalnız asenkron kabul çağrısını yürütür ve sonucu yazar; böylece durum
 * değişikliği zinciri (cascading render) oluşmaz.
 */

const paramsSchema = z.object({ token: z.string().min(1).max(64) });

const ERROR_MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
  not_configured: 'Uygulama henüz sunucuya bağlı değil.',
  rate_limited: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.',
  network: 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.',
  invitation_invalid: 'Bu davet bağlantısı geçerli değil.',
  invitation_expired: 'Bu davetin süresi dolmuş. Seni davet eden kişiden yeni bir bağlantı iste.',
  invitation_already_used: 'Bu davet daha önce kullanılmış. Yeni bir bağlantı iste.',
  forbidden: 'Bu işlem için yetkin yok.',
  unauthenticated: 'Daveti kabul etmek için önce giriş yapmalısın.',
  unknown: 'Davet kabul edilemedi. Tekrar deneyebilirsin.',
};

/** Asenkron kabul çağrısının sonucu. Ekranın diğer durumları türetilir. */
type AcceptOutcome =
  | { readonly kind: 'pending' }
  | { readonly kind: 'accepted' }
  | { readonly kind: 'error'; readonly code: AuthErrorCode };

type ScreenState =
  | { readonly kind: 'checking' }
  | { readonly kind: 'needs-sign-in' }
  | { readonly kind: 'accepted' }
  | { readonly kind: 'error'; readonly code: AuthErrorCode };

const deriveScreenState = (
  isTokenWellFormed: boolean,
  status: 'loading' | 'signed-out' | 'signed-in',
  outcome: AcceptOutcome,
): ScreenState => {
  if (!isTokenWellFormed) return { kind: 'error', code: 'invitation_invalid' };
  if (status === 'loading') return { kind: 'checking' };
  if (status === 'signed-out') return { kind: 'needs-sign-in' };
  if (outcome.kind === 'pending') return { kind: 'checking' };
  return outcome;
};

export default function AcceptInviteScreen() {
  const theme = useTheme();
  const rawParams = useLocalSearchParams();
  const status = useAuthStore((store) => store.status);
  const setActiveCircleId = useAuthStore((store) => store.setActiveCircleId);

  const [outcome, setOutcome] = useState<AcceptOutcome>({ kind: 'pending' });

  const parsed = paramsSchema.safeParse(rawParams);
  const token = parsed.success ? parsed.data.token : null;
  const isTokenWellFormed = token !== null && isWellFormedInvitationToken(token);

  const shouldAccept = isTokenWellFormed && status === 'signed-in';

  useEffect(() => {
    if (!shouldAccept || token === null) return;

    let active = true;

    const accept = async (): Promise<void> => {
      const result = await acceptInvitation(token);
      if (!active) return;

      if (!result.ok) {
        setOutcome({ kind: 'error', code: result.code });
        return;
      }

      setActiveCircleId(result.data);
      setOutcome({ kind: 'accepted' });
    };

    void accept();

    return () => {
      active = false;
    };
  }, [setActiveCircleId, shouldAccept, token]);

  const state = deriveScreenState(isTokenWellFormed, status, outcome);

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
      {state.kind === 'checking' ? (
        <Card>
          <Text accessibilityRole="header" variant="title">
            Davet kontrol ediliyor
          </Text>
          <Text tone="inkSoft">Bir saniye…</Text>
        </Card>
      ) : null}

      {state.kind === 'needs-sign-in' ? (
        <Card>
          <Text accessibilityRole="header" variant="title">
            Önce giriş yap
          </Text>
          <Text tone="inkSoft">
            Daveti kabul etmek için e-postanla giriş yapman gerekiyor. Giriş yaptıktan sonra bu
            davete otomatik döneceğiz.
          </Text>
        </Card>
      ) : null}

      {state.kind === 'accepted' ? (
        <Card>
          <Text tone="success" variant="caption" style={{ fontWeight: '700' }}>
            KATILDIN
          </Text>
          <Text accessibilityRole="header" variant="title">
            Çembere katıldın
          </Text>
          <Text tone="inkSoft">
            Artık bu çemberin görevlerini görebilir, görev ekleyebilir ve tamamlayabilirsin.
          </Text>
        </Card>
      ) : null}

      {state.kind === 'error' ? (
        <Card>
          <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
            HATA
          </Text>
          <Text accessibilityRole="header" variant="title">
            Davet kabul edilemedi
          </Text>
          <Text tone="inkSoft">{ERROR_MESSAGES[state.code]}</Text>
          <Button label="Ana ekrana dön" onPress={() => undefined} variant="secondary" />
        </Card>
      ) : null}
    </View>
  );
}
