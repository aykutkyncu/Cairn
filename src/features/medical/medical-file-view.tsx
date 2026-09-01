import { View } from 'react-native';

import { Badge, Button, Card, Divider, Text, useTheme } from '@/ui';

import { healthRecordTypeLabel, isActiveMedication } from './medical-schema';
import type { HealthRecord, HealthRecordType, Medication } from './medical-schema';

/**
 * Tıbbi dosyanın görünüm katmanı.
 *
 * Veri okumaz; tümü prop olarak gelir. Böylece ekran davranışı ağ ve saat
 * olmadan test edilebilir.
 *
 * Rol davranışı burada uygulanır: `canWrite` yanlışsa ekleme çağrıları hiç
 * çizilmez. Bu bir güvenlik sınırı DEĞİLDİR — yazma yetkisi RLS'tedir;
 * buradaki amaç izleyiciye çalışmayacak bir düğme göstermemektir.
 */

export type MedicalFileViewProps = {
  readonly medications: readonly Medication[];
  readonly records: readonly HealthRecord[];
  /** Çemberin saat dilimindeki bugün (`YYYY-MM-DD`). Cihazın günü değil. */
  readonly today: string;
  readonly canWrite: boolean;
  readonly onAddMedication: () => void;
  readonly onAddRecord: (type: HealthRecordType) => void;
};

/** Dosyada gösterilen kayıt türleri ve sırası. */
const RECORD_SECTIONS: readonly HealthRecordType[] = ['allergy', 'diagnosis', 'doctor'];

export function MedicalFileView({
  medications,
  records,
  today,
  canWrite,
  onAddMedication,
  onAddRecord,
}: MedicalFileViewProps) {
  const theme = useTheme();

  const active = medications.filter((medication) => isActiveMedication(medication, today));
  const past = medications.filter((medication) => !isActiveMedication(medication, today));

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Text accessibilityRole="header" variant="display">
        Dosya
      </Text>

      <Text tone="inkSoft">
        Buradaki bilgiler çemberdeki herkeste görünür. Cairn ilaç doğruluğunu denetlemez; kayıtlar
        hekimin söylediğinin yerine geçmez.
      </Text>

      <MedicationSection
        title="Kullandığı ilaçlar"
        medications={active}
        emptyText="Henüz ilaç eklenmedi."
        canWrite={canWrite}
        onAdd={onAddMedication}
      />

      {past.length > 0 ? (
        <MedicationSection
          title="Geçmiş ilaçlar"
          medications={past}
          emptyText=""
          canWrite={false}
          onAdd={onAddMedication}
        />
      ) : null}

      {RECORD_SECTIONS.map((type) => (
        <RecordSection
          key={type}
          type={type}
          records={records.filter((record) => record.type === type)}
          canWrite={canWrite}
          onAdd={onAddRecord}
        />
      ))}
    </View>
  );
}

function MedicationSection({
  title,
  medications,
  emptyText,
  canWrite,
  onAdd,
}: {
  readonly title: string;
  readonly medications: readonly Medication[];
  readonly emptyText: string;
  readonly canWrite: boolean;
  readonly onAdd: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text accessibilityRole="header" variant="title">
        {title}
      </Text>

      {medications.length === 0 ? (
        <Text tone="inkSoft">{emptyText}</Text>
      ) : (
        <Card>
          <View style={{ gap: theme.spacing.sm }}>
            {medications.map((medication, index) => (
              <View key={medication.id} style={{ gap: theme.spacing.sm }}>
                {index > 0 ? <Divider /> : null}
                <MedicationRow medication={medication} />
              </View>
            ))}
          </View>
        </Card>
      )}

      {canWrite ? <Button variant="secondary" label="İlaç ekle" onPress={onAdd} /> : null}
    </View>
  );
}

function MedicationRow({ medication }: { readonly medication: Medication }) {
  const theme = useTheme();

  // Eksik alan "eklenmedi" diye görünür olmalıdır: boş bırakmak, bilginin
  // var olduğu ama gösterilmediği izlenimi verirdi.
  const details = [
    medication.dosage ?? 'Doz eklenmedi',
    medication.frequencyText ?? 'Sıklık eklenmedi',
  ].join(' · ');

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="body">{medication.name}</Text>
      <Text tone="inkSoft" variant="caption">
        {details}
      </Text>
      {medication.prescribedBy !== null ? (
        <Text tone="inkSoft" variant="caption">
          {medication.prescribedBy}
        </Text>
      ) : null}
    </View>
  );
}

function RecordSection({
  type,
  records,
  canWrite,
  onAdd,
}: {
  readonly type: HealthRecordType;
  readonly records: readonly HealthRecord[];
  readonly canWrite: boolean;
  readonly onAdd: (type: HealthRecordType) => void;
}) {
  const theme = useTheme();
  const label = healthRecordTypeLabel(type);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm }}>
        <Text accessibilityRole="header" variant="title">
          {label}
        </Text>
        {records.length > 0 ? <Badge label={String(records.length)} tone="neutral" /> : null}
      </View>

      {records.length === 0 ? (
        <Text tone="inkSoft">{`${label} kaydı eklenmedi.`}</Text>
      ) : (
        <Card>
          <View style={{ gap: theme.spacing.sm }}>
            {records.map((record, index) => (
              <View key={record.id} style={{ gap: theme.spacing.sm }}>
                {index > 0 ? <Divider /> : null}
                <View style={{ gap: theme.spacing.xs }}>
                  <Text variant="body">{record.title}</Text>
                  {record.body !== null ? (
                    <Text tone="inkSoft" variant="caption">
                      {record.body}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      {canWrite ? (
        <Button variant="secondary" label={`${label} ekle`} onPress={() => onAdd(type)} />
      ) : null}
    </View>
  );
}
