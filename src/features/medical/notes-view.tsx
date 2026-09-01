import { View } from 'react-native';

import { Badge, Button, Card, Text, useTheme } from '@/ui';

import type { HealthRecord } from './medical-schema';

/**
 * Notlar ve randevu soruları görünümü.
 *
 * Veri okumaz; tümü prop olarak gelir.
 *
 * Notlar ve sorular ayrı bölümlerdedir: randevu öncesi "sormayı unutma"
 * listesi, günlük notların arasında kaybolduğunda işe yaramaz.
 */

export type NotesViewProps = {
  readonly notes: readonly HealthRecord[];
  readonly questions: readonly HealthRecord[];
  readonly canWrite: boolean;
  readonly onAddNote: () => void;
  readonly onAddQuestion: () => void;
  readonly onEdit: (record: HealthRecord) => void;
  /** Yazarın adını çözer. Bilinmiyorsa null döner. */
  readonly authorName: (userId: string | null) => string | null;
};

export function NotesView({
  notes,
  questions,
  canWrite,
  onAddNote,
  onAddQuestion,
  onEdit,
  authorName,
}: NotesViewProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Text accessibilityRole="header" variant="display">
        Notlar
      </Text>

      <Section
        title="Randevu öncesi sorular"
        emptyText="Sormak istediğin bir şey yok."
        records={questions}
        canWrite={canWrite}
        addLabel="Soru ekle"
        onAdd={onAddQuestion}
        onEdit={onEdit}
        authorName={authorName}
      />

      <Section
        title="Notlar"
        emptyText="Henüz not yok."
        records={notes}
        canWrite={canWrite}
        addLabel="Not ekle"
        onAdd={onAddNote}
        onEdit={onEdit}
        authorName={authorName}
      />
    </View>
  );
}

function Section({
  title,
  emptyText,
  records,
  canWrite,
  addLabel,
  onAdd,
  onEdit,
  authorName,
}: {
  readonly title: string;
  readonly emptyText: string;
  readonly records: readonly HealthRecord[];
  readonly canWrite: boolean;
  readonly addLabel: string;
  readonly onAdd: () => void;
  readonly onEdit: (record: HealthRecord) => void;
  readonly authorName: (userId: string | null) => string | null;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text accessibilityRole="header" variant="title">
        {title}
      </Text>

      {records.length === 0 ? (
        <Text tone="inkSoft">{emptyText}</Text>
      ) : (
        records.map((record) => (
          <NoteCard
            key={record.id}
            record={record}
            canWrite={canWrite}
            onEdit={onEdit}
            authorName={authorName}
          />
        ))
      )}

      {canWrite ? <Button variant="secondary" label={addLabel} onPress={onAdd} /> : null}
    </View>
  );
}

/** `2026-09-01T18:30:00+00:00` → `01.09.2026`. Saat gösterilmez. */
export const formatRecordDate = (isoDate: string): string => {
  const [datePart] = isoDate.split('T');
  const parts = datePart?.split('-') ?? [];
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

function NoteCard({
  record,
  canWrite,
  onEdit,
  authorName,
}: {
  readonly record: HealthRecord;
  readonly canWrite: boolean;
  readonly onEdit: (record: HealthRecord) => void;
  readonly authorName: (userId: string | null) => string | null;
}) {
  const theme = useTheme();
  const author = authorName(record.createdBy);
  const date = formatRecordDate(record.recordedOn ?? record.createdAt);

  return (
    <Card>
      <View style={{ gap: theme.spacing.xs }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm }}>
          <Text variant="body" style={{ flex: 1, fontWeight: '600' }}>
            {record.title}
          </Text>
          {/* Sürüm 1'den büyükse not düzenlenmiş demektir. Kullanıcı, okuduğu
              metnin ilk hali olmadığını bilmelidir. */}
          {record.revision > 1 ? <Badge label="düzenlendi" tone="neutral" /> : null}
        </View>

        {record.body !== null ? <Text>{record.body}</Text> : null}

        <Text tone="inkSoft" variant="caption">
          {author === null ? date : `${date} · ${author}`}
        </Text>

        {canWrite ? (
          <Button variant="ghost" label="Düzenle" onPress={() => onEdit(record)} />
        ) : null}
      </View>
    </Card>
  );
}
