import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { CircleGate } from '@/features/circles';
import {
  medicationIssueMessage,
  medicationTaskPrefill,
  useCreateMedication,
  validateMedicationInput,
} from '@/features/medical';
import { Button, Card, Input, Text, useTheme } from '@/ui';

/**
 * İlaç ekleme ekranı.
 *
 * Kayıt **hatırlatma üretmez**. Kaydettikten sonra kullanıcıya "bunun için
 * hatırlatma kurayım mı?" diye açıkça sorulur; onaylarsa görev formu önceden
 * doldurulmuş olarak açılır. Saat, tekrar ve kaydetme kararı yine
 * kullanıcınındır.
 *
 * Doz ve sıklık serbest metindir: "yarım tablet", "gerektiğinde" gibi
 * ifadeleri kalıba zorlamak kaydı gerçeğe uzak hale getirirdi.
 */
export default function IlacEkleScreen() {
  return <CircleGate>{(circleId) => <CreateMedicationForm circleId={circleId} />}</CircleGate>;
}

function CreateMedicationForm({ circleId }: { readonly circleId: string }) {
  const theme = useTheme();

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [prescribedBy, setPrescribedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [savedName, setSavedName] = useState<string | null>(null);

  const create = useCreateMedication();

  const orNull = (value: string): string | null => {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  };

  const input = {
    circleId,
    name,
    dosage: orNull(dosage),
    frequencyText: orNull(frequency),
    startedOn: null,
    endedOn: null,
    prescribedBy: orNull(prescribedBy),
    notes: orNull(notes),
  };

  const issues = validateMedicationInput(input);
  const canSubmit = issues.length === 0 && !create.isPending;

  if (savedName !== null) {
    return (
      <ReminderPrompt
        medicationName={savedName}
        dosage={orNull(dosage)}
        onDecline={() => router.back()}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ gap: theme.spacing.lg, padding: theme.spacing.lg }}
      style={{ backgroundColor: theme.colors.surface }}
    >
      <Text accessibilityRole="header" variant="display">
        İlaç ekle
      </Text>

      <Text tone="inkSoft">Cairn ilaç doğruluğunu denetlemez.</Text>

      <Card>
        <Input
          label="İlacın adı"
          onChangeText={setName}
          placeholder="Örneğin: Metformin"
          required
          value={name}
        />
        <Input
          label="Doz"
          onChangeText={setDosage}
          placeholder="Örneğin: 500 mg veya yarım tablet"
          value={dosage}
        />
        <Input
          label="Sıklık"
          onChangeText={setFrequency}
          placeholder="Örneğin: günde iki kez"
          value={frequency}
        />
      </Card>

      <Card>
        <Input
          label="Reçete eden doktor"
          onChangeText={setPrescribedBy}
          placeholder="Örneğin: Dr. Yılmaz"
          value={prescribedBy}
        />
        <Input label="Not" multiline onChangeText={setNotes} value={notes} />
      </Card>

      {issues.length > 0 && name.length > 0 ? (
        <Card variant="sunk">
          <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
            EKSİK
          </Text>
          {issues.map((issue) => (
            <Text key={issue}>{medicationIssueMessage(issue)}</Text>
          ))}
        </Card>
      ) : null}

      {create.isError ? (
        <Card variant="sunk">
          <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
            HATA
          </Text>
          <Text>İlaç kaydedilemedi. Bağlantını kontrol edip tekrar deneyebilirsin.</Text>
        </Card>
      ) : null}

      <Button
        disabled={!canSubmit}
        label="İlacı kaydet"
        loading={create.isPending}
        loadingLabel="Kaydediliyor"
        onPress={() => {
          create.mutate(input, { onSuccess: (saved) => setSavedName(saved.name) });
        }}
      />
    </ScrollView>
  );
}

/**
 * Kayıttan sonraki açık onay adımı.
 *
 * Sözleşme otomatik ilaç hatırlatmasını yasaklar. Bu ekran hiçbir görev
 * oluşturmaz; yalnız kullanıcı isterse görev formunu önceden doldurulmuş
 * biçimde açar.
 */
function ReminderPrompt({
  medicationName,
  dosage,
  onDecline,
}: {
  readonly medicationName: string;
  readonly dosage: string | null;
  readonly onDecline: () => void;
}) {
  const theme = useTheme();
  const prefill = medicationTaskPrefill({ name: medicationName, dosage });

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        flex: 1,
        gap: theme.spacing.lg,
        justifyContent: 'center',
        padding: theme.spacing.lg,
      }}
    >
      <Text accessibilityRole="header" variant="title">
        İlaç kaydedildi
      </Text>

      <Text tone="inkSoft">
        Hatırlatma kurulmadı. İstersen bu ilaç için bir görev oluşturabilirsin; saatini ve tekrarını
        sen seçersin.
      </Text>

      <Button
        label="Hatırlatma kur"
        onPress={() =>
          router.replace({
            pathname: '/gorev-ekle',
            params: { title: prefill.title, kind: prefill.kind },
          })
        }
      />
      <Button label="Şimdi değil" variant="secondary" onPress={onDecline} />
    </View>
  );
}
