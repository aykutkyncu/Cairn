import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { useActiveCircle } from '@/features/circles';
import {
  describeRecurrence,
  rruleForPreset,
  taskKindLabel,
  todayLocalDate,
  useCreateTask,
  validateTaskInput,
  validationMessage,
  type RecurrencePreset,
  type TaskKind,
} from '@/features/tasks';
import { Button, Card, Input, MIN_TOUCH_TARGET, Text, useTheme } from '@/ui';

import { CircleGate } from './(tabs)/_circle-gate';

/**
 * Görev oluşturma ekranı.
 *
 * Kullanıcı RRULE görmez: dört hazır seçenekten birini seçer. Saat ve tarih
 * ÇEMBERİN saat dilimindedir; ekran bunu açıkça yazar, çünkü başka bir
 * şehirdeki bakım veren için bu fark önemlidir.
 */
export default function GorevEkleScreen() {
  return <CircleGate>{(circleId) => <CreateTaskForm circleId={circleId} />}</CircleGate>;
}

const KIND_OPTIONS: readonly TaskKind[] = ['medication', 'appointment', 'visit', 'other'];

const RECURRENCE_OPTIONS: readonly Exclude<RecurrencePreset, 'custom'>[] = [
  'once',
  'daily',
  'weekdays',
  'weekly',
];

function CreateTaskForm({ circleId }: { readonly circleId: string }) {
  const theme = useTheme();
  const { activeCircle } = useActiveCircle();
  const timeZone = activeCircle?.timezone ?? 'Europe/Istanbul';

  const [kind, setKind] = useState<TaskKind>('medication');
  const [title, setTitle] = useState('');
  const [localDate, setLocalDate] = useState(() => todayLocalDate(timeZone));
  const [localTime, setLocalTime] = useState('08:00');
  const [recurrence, setRecurrence] = useState<Exclude<RecurrencePreset, 'custom'>>('daily');

  const create = useCreateTask();
  const issues = validateTaskInput({
    circleId,
    kind,
    title,
    localDate,
    localTime,
    recurrence,
    assignedTo: null,
  });

  const canSubmit = issues.length === 0 && !create.isPending;

  return (
    <ScrollView
      contentContainerStyle={{ gap: theme.spacing.lg, padding: theme.spacing.lg }}
      style={{ backgroundColor: theme.colors.surface }}
    >
      <Text accessibilityRole="header" variant="display">
        Görev ekle
      </Text>

      <Card>
        <Text variant="title">Ne yapılacak?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {KIND_OPTIONS.map((option) => (
            <ChoiceChip
              key={option}
              label={taskKindLabel(option)}
              selected={option === kind}
              onPress={() => setKind(option)}
            />
          ))}
        </View>

        <Input
          label="Görev adı"
          onChangeText={setTitle}
          placeholder="Örneğin: Sabah ilacı"
          required
          value={title}
        />
      </Card>

      <Card>
        <Text variant="title">Ne zaman?</Text>
        <Text tone="inkSoft" variant="caption">
          Saat, çemberin saat dilimine göredir ({timeZone}). Başka bir şehirdeki bakım veren de bu
          saati aynı gün altında görür.
        </Text>

        <Input label="Tarih (YYYY-AA-GG)" onChangeText={setLocalDate} value={localDate} />
        <Input label="Saat (SS:DD)" onChangeText={setLocalTime} value={localTime} />
      </Card>

      <Card>
        <Text variant="title">Tekrar</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {RECURRENCE_OPTIONS.map((option) => (
            <ChoiceChip
              key={option}
              label={describeRecurrence(rruleForPreset(option))}
              selected={option === recurrence}
              onPress={() => setRecurrence(option)}
            />
          ))}
        </View>
      </Card>

      {issues.length > 0 && title.length > 0 ? (
        <Card variant="sunk">
          <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
            EKSİK
          </Text>
          {issues.map((issue) => (
            <Text key={issue}>{validationMessage(issue)}</Text>
          ))}
        </Card>
      ) : null}

      {create.isError ? (
        <Card variant="sunk">
          <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
            HATA
          </Text>
          <Text>Görev kaydedilemedi. Bağlantını kontrol edip tekrar deneyebilirsin.</Text>
        </Card>
      ) : null}

      <Button
        disabled={!canSubmit}
        label="Görevi kaydet"
        loading={create.isPending}
        loadingLabel="Kaydediliyor"
        onPress={() => {
          create.mutate(
            {
              circleId,
              kind,
              title,
              localDate,
              localTime,
              recurrence,
              assignedTo: null,
            },
            { onSuccess: () => router.back() },
          );
        }}
      />
    </ScrollView>
  );
}

function ChoiceChip({
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
        borderRadius: theme.radius.pill,
        borderWidth: selected ? 2 : 1,
        justifyContent: 'center',
        minHeight: MIN_TOUCH_TARGET,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <Text tone={selected ? 'accent' : 'ink'} style={{ fontWeight: selected ? '700' : '400' }}>
        {label}
      </Text>
    </Pressable>
  );
}
