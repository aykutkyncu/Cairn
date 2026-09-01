import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { CircleGate } from '@/features/circles';
import {
  healthRecordIssueMessage,
  healthRecordTypeLabel,
  useHealthRecord,
  useUpdateHealthRecord,
  validateHealthRecordInput,
  type HealthRecord,
} from '@/features/medical';
import { Button, Card, ErrorState, Input, Skeleton, Text, useTheme } from '@/ui';

/**
 * Sağlık kaydı düzenleme ekranı.
 *
 * Rota YALNIZ kaydın kimliğini taşır; başlık ve gövde sunucudan okunur.
 * Bunları parametreyle taşımak, sağlık verisini URL'ye yazmak olurdu.
 *
 * Çakışma sessizce çözülmez: düzenlemeye başladığın sürüm ile sunucudaki
 * sürüm farklıysa yazma reddedilir ve durum kullanıcıya gösterilir.
 * Başkasının yazdığı bir sağlık notunu sessizce üzerine yazmak yasaktır.
 */
export default function KayitDuzenleScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const raw = typeof params.id === 'string' ? params.id : (params.id?.[0] ?? '');
  const id = raw.length > 0 ? raw : null;

  return <CircleGate>{() => <EditRecordLoader id={id} />}</CircleGate>;
}

function EditRecordLoader({ id }: { readonly id: string | null }) {
  const theme = useTheme();
  const query = useHealthRecord(id);

  if (id === null) {
    return (
      <ErrorState title="Kayıt bulunamadı" description="Bu bağlantı bir kayda işaret etmiyor." />
    );
  }

  if (query.isLoading) {
    return (
      <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
        <Skeleton height={theme.spacing.xxl} accessibilityLabel="Kayıt yükleniyor" />
        <Skeleton height={theme.spacing.xxl} />
      </View>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Kayıt alınamadı"
        description="Bağlantını kontrol edip tekrar deneyebilirsin."
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const record = query.data ?? null;
  if (record === null) {
    // Silinmiş olabilir ya da erişimin yoktur; ikisi aynı görünür.
    return (
      <ErrorState
        title="Kayıt bulunamadı"
        description="Kayıt silinmiş olabilir. Listeye dönüp yenileyebilirsin."
      />
    );
  }

  // Anahtar kaydın sürümünü içerir: sunucudan yeni bir sürüm geldiğinde
  // (ör. çakışma sonrası yeniden okuma) form sıfırdan kurulur ve kullanıcı
  // eski metnin üzerine yazmaya devam etmez. Aynı işi efekt içinde
  // setState ile yapmak, React'in önerdiği yol değildir.
  return <EditRecordForm key={`${record.id}:${record.revision}`} record={record} />;
}

function EditRecordForm({ record }: { readonly record: HealthRecord }) {
  const theme = useTheme();
  const [title, setTitle] = useState(record.title);
  const [body, setBody] = useState(record.body ?? '');

  const update = useUpdateHealthRecord();
  const issues = validateHealthRecordInput({ title, recordedOn: record.recordedOn });
  const canSubmit = issues.length === 0 && !update.isPending;

  const isConflict =
    update.isError && (update.error as { code?: string } | null)?.code === 'conflict';

  return (
    <ScrollView
      contentContainerStyle={{ gap: theme.spacing.lg, padding: theme.spacing.lg }}
      style={{ backgroundColor: theme.colors.surface }}
    >
      <Text accessibilityRole="header" variant="display">
        {`${healthRecordTypeLabel(record.type)} düzenle`}
      </Text>

      <Card>
        <Input label="Başlık" onChangeText={setTitle} required value={title} />
        <Input label="Açıklama" multiline onChangeText={setBody} value={body} />
      </Card>

      {issues.length > 0 ? (
        <Card variant="sunk">
          <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
            EKSİK
          </Text>
          {issues.map((issue) => (
            <Text key={issue}>{healthRecordIssueMessage(issue)}</Text>
          ))}
        </Card>
      ) : null}

      {isConflict ? (
        <Card variant="sunk">
          <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
            ÇAKIŞMA
          </Text>
          <Text>
            Bu kaydı sen düzenlerken başka biri değiştirdi. Yazdıkların gönderilmedi. Onların
            değişikliğini görmek için kaydı yeniden aç, sonra kendi eklemeni yap.
          </Text>
        </Card>
      ) : null}

      {update.isError && !isConflict ? (
        <Card variant="sunk">
          <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
            HATA
          </Text>
          <Text>Kayıt güncellenemedi. Bağlantını kontrol edip tekrar deneyebilirsin.</Text>
        </Card>
      ) : null}

      <Button
        disabled={!canSubmit}
        label="Değişikliği kaydet"
        loading={update.isPending}
        loadingLabel="Kaydediliyor"
        onPress={() => {
          update.mutate(
            {
              id: record.id,
              // Düzenlemeye başlarken okunan sürüm. Sunucudaki sürüm bundan
              // farklıysa yazma reddedilir.
              baseRevision: record.revision,
              title: title.trim(),
              body: body.trim().length === 0 ? null : body,
              recordedOn: record.recordedOn,
            },
            { onSuccess: () => router.back() },
          );
        }}
      />
    </ScrollView>
  );
}
