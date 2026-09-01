import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Redirect } from 'expo-router';

import {
  authRedirectUrl,
  sendMagicLink,
  startAnonymously,
  useAuthStore,
  type AuthErrorCode,
} from '@/features/auth';
import { Button, Card, Input, Text, useTheme } from '@/ui';

/**
 * Giriş ekranı.
 *
 * **Kapıda e-posta istenmez.** Uygulamayı açar açmaz adres sormak, değeri
 * hiç görmemiş kullanıcıyı kaybettirir. Birincil yol "Hemen başla":
 * anonim ama gerçek bir hesap açılır, kullanıcı çemberini kurar ve
 * uygulamayı kullanır. E-posta ancak gerçekten gerektiğinde istenir —
 * başka birini davet ederken veya ikinci cihazdan girerken.
 *
 * Sınır sakin ama açık yazılır: e-posta bağlanmadan hesap yalnız bu
 * cihazdadır.
 *
 * E-postayla giriş ikincil yoldur ve şifre YOKTUR: bakım veren,
 * hatırlaması gereken bir parola daha istemez. Giriş e-postadaki
 * bağlantıyla tamamlanır.
 *
 * **Neden kod alanı yok:** Supabase'in yerleşik e-posta servisi şablon
 * özelleştirmesine izin vermiyor; şablona `{{ .Token }}` eklenemediği için
 * kullanıcıya 6 haneli kod ULAŞMIYOR. Gelmeyecek bir kodu bekleten bir alan
 * göstermek, çalışmayan bir özelliği varmış gibi göstermek olurdu.
 * `verifyEmailCode` veri katmanında duruyor; kendi SMTP'si bağlandığında
 * alan geri eklenebilir.
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
  unauthenticated: 'Bu giriş bağlantısı artık geçerli değil. Yeni bir bağlantı iste.',
  unknown: 'Beklenmeyen bir sorun oldu. Tekrar deneyebilirsin.',
};

/**
 * Ekranın adımı ve meşguliyeti AYRI tutulur.
 *
 * Tek bir durum değişkeni kullanılsaydı, yanlış koddan sonra durum "error"
 * olur ve kod alanı ekrandan kaybolurdu: kullanıcı yeniden yazacağı yeri
 * bulamazdı.
 */
type Phase =
  /** Açılış: hesapsız başla ya da e-postayla gir. */
  | 'start'
  | 'email'
  /** Bağlantı gönderildi; kullanıcı e-postasına gidecek. */
  | 'sent';
type Busy = 'idle' | 'starting' | 'sending';

const isPlausibleEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function SignInScreen() {
  const theme = useTheme();
  const status = useAuthStore((state) => state.status);
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('start');
  const [busy, setBusy] = useState<Busy>('idle');
  const [error, setError] = useState<AuthErrorCode | null>(null);

  const canSend = isPlausibleEmail(email) && busy !== 'sending';

  // Oturum bu ekranda açılabilir (hesapsız başlangıç) ya da başka bir yoldan
  // gelebilir. Açıldığında ekranda kalmak, kullanıcıyı işe yaramış bir
  // düğmeye tekrar tekrar bastırırdı; nereye gidileceğine kök ekran karar
  // verir.
  if (status === 'signed-in') return <Redirect href="/" />;

  const handleStart = async (): Promise<void> => {
    setBusy('starting');
    setError(null);
    const result = await startAnonymously();
    setBusy('idle');
    // Başarıda yönlendirme yapılmaz: oturum değişince kök ekran karar verir.
    if (!result.ok) setError(result.code);
  };

  const handleSend = async (): Promise<void> => {
    setBusy('sending');
    setError(null);
    const result = await sendMagicLink(email.trim(), authRedirectUrl());
    setBusy('idle');
    // "Gönderildi" mesajı, e-postanın kayıtlı olup olmadığından BAĞIMSIZ
    // gösterilir; aksi halde hangi adreslerin sistemde olduğu sızardı.
    if (result.ok) setPhase('sent');
    else setError(result.code);
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
          İlaçlarını, randevularını ve notlarını tek yerde takip et. İstersen bakımı paylaştığın
          kişileri de ekleyebilirsin.
        </Text>
      </View>

      <Card variant="sunk">
        <Text variant="caption" style={{ fontWeight: '700' }}>
          BAŞLAMADAN ÖNCE
        </Text>
        <Text tone="inkSoft" variant="caption">
          Kayıtların yalnız sana açıktır; paylaşmayı sen seçmedikçe kimse göremez. Cairn tıbbi
          tavsiye vermez, teşhis koymaz ve ilaç doğruluğunu denetlemez.
        </Text>
      </Card>

      {phase === 'start' ? (
        <Card>
          <Text variant="title">Hesap açmadan başla</Text>
          <Text tone="inkSoft" variant="caption">
            E-posta istemiyoruz. Çemberini kur, görevlerini ekle, uygulamayı gör. E-postanı sonra,
            birini davet ederken veya ikinci cihazdan girerken bağlayabilirsin.
          </Text>

          <Button
            label="Hemen başla"
            loading={busy === 'starting'}
            loadingLabel="Hazırlanıyor"
            onPress={() => {
              void handleStart();
            }}
          />

          <Text tone="inkSoft" variant="caption">
            Bu hesap yalnız bu cihazdadır. E-posta bağlamadan telefonu kaybedersen kayıtların geri
            getirilemez.
          </Text>

          <Button
            variant="ghost"
            label="E-postamla gir"
            onPress={() => {
              setError(null);
              setPhase('email');
            }}
          />
        </Card>
      ) : null}

      {phase === 'start' ? null : (
        <Card>
          <Input
            autoCapitalize="none"
            autoComplete="email"
            editable={phase !== 'sent'}
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

          {phase === 'sent' ? null : (
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

          {phase === 'email' ? (
            <Button
              variant="ghost"
              label="Vazgeç, hesapsız başla"
              onPress={() => {
                setError(null);
                setPhase('start');
              }}
            />
          ) : null}
        </Card>
      )}

      {phase === 'sent' ? (
        <Card variant="sunk">
          <Text tone="success" variant="caption" style={{ fontWeight: '700' }}>
            GÖNDERİLDİ
          </Text>
          <Text>
            E-postandaki bağlantıya bu cihazdan dokunarak giriş yapabilirsin. Bağlantı kısa süre
            geçerlidir.
          </Text>
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
