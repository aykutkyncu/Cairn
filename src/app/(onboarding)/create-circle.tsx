import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as Localization from 'expo-localization';

import { useAuthStore, type AuthErrorCode } from '@/features/auth';
import { useCreateCircle } from '@/features/circles';
import { Button, Card, Input, MIN_TOUCH_TARGET, Text, useTheme } from '@/ui';

/**
 * Kurulum ekranı: takip kimin için?
 *
 * **Tek başına kullanım birinci sınıf yoldur.** Varsayılan "Kendim için";
 * bu yolda ad sorulmaz ve paylaşımdan hiç söz edilmez. Kimseyle bağ kurmak
 * istemeyen kullanıcıya davet, paylaşım ve "çemberdeki herkes" metinleri
 * göstermek, karşılığı olmayan bir söz vermektir.
 *
 * Altta yatan yapı iki durumda da aynıdır: tek üyeli bir çember de
 * çemberdir. Kullanıcı bunu bilmek zorunda değildir; "çember" sözcüğü
 * kendisi için kuran kişinin ekranında hiç geçmez.
 *
 * Zaman dilimi kayda aittir, cihaza değil — İstanbul'daki ve Berlin'deki iki
 * bakım veren aynı günü aynı gün olarak görmelidir.
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
  unknown: 'Kayıt oluşturulamadı. Tekrar deneyebilirsin.',
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

/** Takip kimin için tutuluyor? */
type Subject = 'self' | 'other';

/**
 * Kendisi için kuran kullanıcının kaydına yazılan ad.
 *
 * Sunucudaki sütun boş bırakılamaz; kullanıcıya ad sormak yerine sabit bir
 * değer yazılır. Bu ad hiçbir ekranda gösterilmez.
 */
export const SELF_CARE_RECIPIENT_NAME = 'Kendim';

export default function CreateCircleScreen() {
  const theme = useTheme();
  const setActiveCircleId = useAuthStore((store) => store.setActiveCircleId);

  const [subject, setSubject] = useState<Subject>('self');
  const [careRecipientName, setCareRecipientName] = useState('');
  const [timezone, setTimezone] = useState(suggestedTimezone);
  const [state, setState] = useState<ScreenState>({ kind: 'idle' });
  const create = useCreateCircle();

  // Kendisi için kuran kullanıcıdan ad istenmez; o yüzden kaydetme koşulu da
  // ada bağlı değildir.
  const canSubmit =
    (subject === 'self' || careRecipientName.trim().length > 0) && state.kind !== 'saving';

  const handleSubmit = async (): Promise<void> => {
    setState({ kind: 'saving' });
    const name = subject === 'self' ? SELF_CARE_RECIPIENT_NAME : careRecipientName.trim();
    const result = await create.mutateAsync({ name, timezone: timezone.trim() });

    if (!result.ok) {
      setState({ kind: 'error', code: result.code });
      return;
    }

    setActiveCircleId(result.data);
    setState({ kind: 'idle' });
    // Kurulum bitti; ekranda kalmak kullanıcıyı işe yaramış bir düğmeye
    // tekrar bastırırdı. Nereye gidileceğine kök ekran karar verir.
    router.replace('/');
  };

  return (
    <ScrollView
      contentContainerStyle={{ gap: theme.spacing.lg, padding: theme.spacing.xl }}
      style={{ backgroundColor: theme.colors.surface }}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text accessibilityRole="header" variant="title">
          Takibi kimin için tutuyorsun?
        </Text>
        <Text tone="inkSoft">
          İstersen sonradan başkalarını da ekleyebilirsin. Şimdi seçmek zorunda değilsin — bunu daha
          sonra da değiştirebilirsin.
        </Text>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <SubjectChoice
            label="Kendim için"
            selected={subject === 'self'}
            onPress={() => setSubject('self')}
          />
          <SubjectChoice
            label="Başkası için"
            selected={subject === 'other'}
            onPress={() => setSubject('other')}
          />
        </View>

        {subject === 'other' ? (
          <Input
            autoCapitalize="words"
            hint="Bu ad yalnız eklediğin kişilerde görünür; bildirim metinlerinde ve özetlerde geçmez."
            label="Bakılan kişinin adı"
            onChangeText={setCareRecipientName}
            placeholder="Örnek: Ayşe Yılmaz"
            required
            value={careRecipientName}
          />
        ) : null}

        <Input
          autoCapitalize="none"
          hint="Görevler ve günlük özet bu saat dilimine göre hesaplanır."
          label="Zaman dilimi"
          onChangeText={setTimezone}
          value={timezone}
        />

        <Button
          disabled={!canSubmit}
          label="Başla"
          loading={state.kind === 'saving'}
          loadingLabel="Oluşturuluyor"
          onPress={() => {
            void handleSubmit();
          }}
        />
      </Card>

      {subject === 'other' ? (
        <Text tone="inkSoft" variant="caption">
          Yazdıkların, sonradan eklediğin kişilerde de görünür.
        </Text>
      ) : null}

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

/** Tek dokunuşluk seçim. Radyo davranışı erişilebilirlik için açıkça verilir. */
function SubjectChoice({
  label,
  selected,
  onPress,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: selected ? theme.colors.surfaceSunk : theme.colors.surface,
        borderColor: selected ? theme.colors.accent : theme.colors.rule,
        borderRadius: theme.radius.md,
        borderWidth: selected ? 2 : 1,
        flex: 1,
        justifyContent: 'center',
        minHeight: MIN_TOUCH_TARGET,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <Text tone={selected ? 'accent' : 'ink'} style={{ fontWeight: selected ? '700' : '400' }}>
        {label}
      </Text>
    </Pressable>
  );
}
