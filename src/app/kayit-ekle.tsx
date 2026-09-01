import { useState } from 'react';
import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { CircleGate } from '@/features/circles';
import {
  healthRecordIssueMessage,
  healthRecordTypeLabel,
  healthRecordTypeSchema,
  useCreateHealthRecord,
  validateHealthRecordInput,
  type HealthRecordType,
} from '@/features/medical';
import { Button, Card, Input, Text, useTheme } from '@/ui';

/**
 * Sağlık kaydı ekleme ekranı (alerji, teşhis, doktor, not, randevu sorusu).
 *
 * Tür derin bağlantı parametresinden gelir ve **doğrulanır**: doğrulanmamış
 * bir parametreyle sunucuya yazmak, bir bağlantının kaydı yanlış türe
 * sokması demek olurdu. Tanınmayan tür sessizce "not" olur.
 *
 * Gövde metnine genel amaçlı temizleme uygulanmaz: sözleşme, sağlık notunun
 * içeriğini bozacak temizlemeyi yasaklar.
 */
export default function KayitEkleScreen() {
  const params = useLocalSearchParams<{ type?: string | string[] }>();
  const raw = typeof params.type === 'string' ? params.type : (params.type?.[0] ?? '');
  const parsed = healthRecordTypeSchema.safeParse(raw);
  const type: HealthRecordType = parsed.success ? parsed.data : 'note';

  return (
    <CircleGate>{(circleId) => <CreateRecordForm circleId={circleId} type={type} />}</CircleGate>
  );
}

function CreateRecordForm({
  circleId,
  type,
}: {
  readonly circleId: string;
  readonly type: HealthRecordType;
}) {
  const theme = useTheme();
  const label = healthRecordTypeLabel(type);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const create = useCreateHealthRecord();
  const issues = validateHealthRecordInput({ title, recordedOn: null });
  const canSubmit = issues.length === 0 && !create.isPending;

  return (
    <ScrollView
      contentContainerStyle={{ gap: theme.spacing.lg, padding: theme.spacing.lg }}
      style={{ backgroundColor: theme.colors.surface }}
    >
      <Text accessibilityRole="header" variant="display">
        {`${label} ekle`}
      </Text>

      <Text tone="inkSoft">Yazdıkların çemberdeki herkeste görünür.</Text>

      <Card>
        <Input label={`${label} başlığı`} onChangeText={setTitle} required value={title} />
        <Input label="Açıklama" multiline onChangeText={setBody} value={body} />
      </Card>

      {issues.length > 0 && title.length > 0 ? (
        <Card variant="sunk">
          <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
            EKSİK
          </Text>
          {issues.map((issue) => (
            <Text key={issue}>{healthRecordIssueMessage(issue)}</Text>
          ))}
        </Card>
      ) : null}

      {create.isError ? (
        <Card variant="sunk">
          <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
            HATA
          </Text>
          <Text>Kayıt kaydedilemedi. Bağlantını kontrol edip tekrar deneyebilirsin.</Text>
        </Card>
      ) : null}

      <Button
        disabled={!canSubmit}
        label="Kaydet"
        loading={create.isPending}
        loadingLabel="Kaydediliyor"
        onPress={() => {
          create.mutate(
            {
              circleId,
              type,
              title: title.trim(),
              body: body.trim().length === 0 ? null : body,
              recordedOn: null,
            },
            { onSuccess: () => router.back() },
          );
        }}
      />
    </ScrollView>
  );
}
