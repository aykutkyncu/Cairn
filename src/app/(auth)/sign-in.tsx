import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  authRedirectUrl,
  sendMagicLink,
  verifyEmailCode,
  type AuthErrorCode,
} from '@/features/auth';
import { Button, Card, Input, Text, useTheme } from '@/ui';

/**
 * Giriş ekranı.
 *
 * E-posta ile giriş. Şifre YOKTUR: bakım veren, hatırlaması gereken bir
 * parola daha istemez.
 *
 * **Kod birincil, bağlantı yedektir.** Magic-link mobilde en zayıf yerinde
 * çalışır: kullanıcı uygulamadan çıkar, posta uygulamasını açar, bağlantıya
 * dokunur, geri döner. Bakım verenin dikkati zaten bölünmüştür. Aynı
 * e-postadaki 6 haneli kod, uygulamadan hiç çıkmadan girmeyi sağlar.
 *
 * Ekran e-posta istemeden ÖNCE ne olduğunu söyler: sağlık verisi tutacak bir
 * uygulamaya adres vermek istenmeden önce, verinin nerede durduğu ve
 * uygulamanın ne yapmadığı görünür olmalıdır.
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
  unauthenticated: 'Kod yanlış veya süresi dolmuş. Yeni bir kod isteyebilirsin.',
  unknown: 'Beklenmeyen bir sorun oldu. Tekrar deneyebilirsin.',
};

/**
 * Ekranın adımı ve meşguliyeti AYRI tutulur.
 *
 * Tek bir durum değişkeni kullanılsaydı, yanlış koddan sonra durum "error"
 * olur ve kod alanı ekrandan kaybolurdu: kullanıcı yeniden yazacağı yeri
 * bulamazdı.
 */
type Phase = 'email' | 'code';
type Busy = 'idle' | 'sending' | 'verifying';

const isPlausibleEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** Supabase e-posta kodu 6 hanelidir. */
const CODE_LENGTH = 6;

export default function SignInScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('email');
  const [busy, setBusy] = useState<Busy>('idle');
  const [error, setError] = useState<AuthErrorCode | null>(null);

  const canSend = isPlausibleEmail(email) && busy !== 'sending';
  const canVerify = code.trim().length === CODE_LENGTH && busy !== 'verifying';

  const handleSend = async (): Promise<void> => {
    setBusy('sending');
    setError(null);
    const result = await sendMagicLink(email.trim(), authRedirectUrl());
    setBusy('idle');
    // Kod adımına geçiş, e-postanın kayıtlı olup olmadığından BAĞIMSIZDIR;
    // aksi halde hangi adreslerin sistemde olduğu sızardı.
    if (result.ok) setPhase('code');
    else setError(result.code);
  };

  const handleVerify = async (): Promise<void> => {
    setBusy('verifying');
    setError(null);
    const result = await verifyEmailCode(email.trim(), code);
    setBusy('idle');
    // Başarıda yönlendirme yapılmaz: oturum durumu değişince kök ekran
    // karar verir. Buradan sekmelere gitmek, oturum store'a yazılmadan
    // çember kapısına çarpabilirdi.
    if (!result.ok) setError(result.code);
  };

  return (
    <ScrollView
      contentContainerStyle={{
        gap: theme.spacing.lg,
        justifyContent: 'center',
        minHeight: '100%',
        padding: theme.spacing.xl,
      }}
      style={{ backgroundColor: theme.colors.surface }}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text accessibilityRole="header" variant="display">
          Cairn
        </Text>
        <Text tone="inkSoft">
          Bakımı paylaşan aileler için ortak operasyon uygulaması. Görevler, ilaçlar ve notlar
          çemberindeki herkeste aynı anda görünür.
        </Text>
      </View>

      <Card variant="sunk">
        <Text variant="caption" style={{ fontWeight: '700' }}>
          E-POSTANI İSTEMEDEN ÖNCE
        </Text>
        <Text tone="inkSoft" variant="caption">
          Yazdıkların yalnız kurduğun çemberin üyelerine açıktır; başka çemberler göremez. Cairn
          tıbbi tavsiye vermez, teşhis koymaz ve ilaç doğruluğunu denetlemez. Şifre istemiyoruz:
          girişte e-postana tek kullanımlık bir kod gönderiyoruz.
        </Text>
      </Card>

      <Card>
        <Input
          autoCapitalize="none"
          autoComplete="email"
          editable={phase === 'email'}
          keyboardType="email-address"
          label="E-posta"
          onChangeText={(value) => {
            setEmail(value);
            setError(null);
          }}
          placeholder="ornek@eposta.com"
          required
          value={email}
        />

        {phase === 'code' ? null : (
          <Button
            disabled={!canSend}
            label="Giriş kodu gönder"
            loading={busy === 'sending'}
            loadingLabel="Gönderiliyor"
            onPress={() => {
              void handleSend();
            }}
          />
        )}
      </Card>

      {phase === 'code' ? (
        <Card>
          <Text variant="title">Kodu gir</Text>
          <Text tone="inkSoft" variant="caption">
            E-postana 6 haneli bir kod gönderdik. Aynı e-postadaki bağlantıya dokunarak da
            girebilirsin; kod, uygulamadan çıkmadan girmen için.
          </Text>

          <Input
            autoComplete="one-time-code"
            keyboardType="number-pad"
            label="6 haneli kod"
            maxLength={CODE_LENGTH}
            onChangeText={(value) => {
              setCode(value);
              setError(null);
            }}
            placeholder="000000"
            required
            value={code}
          />

          <Button
            disabled={!canVerify}
            label="Giriş yap"
            loading={busy === 'verifying'}
            loadingLabel="Kontrol ediliyor"
            onPress={() => {
              void handleVerify();
            }}
          />

          <Button
            variant="ghost"
            label="Kodu tekrar gönder"
            onPress={() => {
              setCode('');
              void handleSend();
            }}
          />
        </Card>
      ) : null}

      {error !== null ? (
        <Card variant="sunk">
          <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
            HATA
          </Text>
          <Text>{ERROR_MESSAGES[error]}</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}
