import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Badge, Card, Divider, MIN_TOUCH_TARGET, Text, useTheme } from '@/ui';

import { blockLabel, progressSentence, type DayPlan, type PlannedOccurrence } from './day-plan';
import { taskKindLabel } from './task-schema';

/**
 * Bugün ekranının görünüm katmanı.
 *
 * Veri okumaz; tümü prop olarak gelir. Böylece ekran davranışı ağ ve saat
 * olmadan test edilebilir.
 */

/** Geri alma penceresi. Kısa: sonrasında kayıt kalıcı sayılır. */
export const UNDO_WINDOW_MS = 10_000;

export type DayPlanViewProps = {
  readonly plan: DayPlan;
  readonly onComplete: (item: PlannedOccurrence) => void;
  readonly onUndo: (item: PlannedOccurrence) => void;
  /** Boş gündeki çağrı. */
  readonly onAddTask?: () => void;
};

export function DayPlanView({ plan, onComplete, onUndo, onAddTask }: DayPlanViewProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Text accessibilityRole="header" variant="display">
        Bugün
      </Text>

      <Text tone="inkSoft" accessibilityLiveRegion="polite">
        {progressSentence(plan)}
      </Text>

      {plan.total === 0 ? (
        <EmptyDay onAddTask={onAddTask} />
      ) : (
        <>
          {plan.overdue.length > 0 ? (
            <OverdueSection items={plan.overdue} onComplete={onComplete} onUndo={onUndo} />
          ) : null}

          {plan.blocks.map((group) => (
            <View key={group.block} style={{ gap: theme.spacing.sm }}>
              <Text accessibilityRole="header" variant="title">
                {blockLabel(group.block)}
              </Text>
              {group.items.map((item) => (
                <OccurrenceRow
                  key={`${item.taskId}|${item.occurrenceId}`}
                  item={item}
                  onComplete={onComplete}
                  onUndo={onUndo}
                />
              ))}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function EmptyDay({ onAddTask }: { readonly onAddTask?: (() => void) | undefined }) {
  const theme = useTheme();

  return (
    <Card>
      <Text variant="title">Bugün için bir şey planlanmamış</Text>
      <Text tone="inkSoft">İlaç, randevu veya ziyaret ekleyerek başlayabilirsin.</Text>
      {onAddTask === undefined ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Görev ekle"
          onPress={onAddTask}
          style={{
            alignItems: 'center',
            borderColor: theme.colors.accent,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            justifyContent: 'center',
            marginTop: theme.spacing.sm,
            minHeight: MIN_TOUCH_TARGET,
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <Text tone="accent" style={{ fontWeight: '600' }}>
            Görev ekle
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

/**
 * Gecikenler alanı.
 *
 * **Sakin** tutulur: kırmızı uyarı yığını değil, sade bir başlık. Bakım veren
 * zaten yükün altındadır; uygulama onu ayrıca suçlamaz.
 */
function OverdueSection({
  items,
  onComplete,
  onUndo,
}: {
  readonly items: readonly PlannedOccurrence[];
  readonly onComplete: (item: PlannedOccurrence) => void;
  readonly onUndo: (item: PlannedOccurrence) => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text accessibilityRole="header" variant="title">
        Zamanı geçenler
      </Text>
      <Text tone="inkSoft" variant="caption">
        Bunlar hâlâ yapılabilir. Sırası geçmiş olması bir sorun değil.
      </Text>
      {items.map((item) => (
        <OccurrenceRow
          key={`overdue|${item.taskId}|${item.occurrenceId}`}
          item={item}
          onComplete={onComplete}
          onUndo={onUndo}
        />
      ))}
    </View>
  );
}

type RowProps = {
  readonly item: PlannedOccurrence;
  readonly onComplete: (item: PlannedOccurrence) => void;
  readonly onUndo: (item: PlannedOccurrence) => void;
};

/**
 * Tek görev satırı.
 *
 * Tek dokunuşla tamamlanır. Tamamlandıktan sonra 10 saniye boyunca bir geri
 * alma düğmesi görünür; süre dolunca kaybolur. Geri alma kaydı SİLMEZ, void
 * kaydı üretir — bu karar `use-day-plan` ve sunucu şemasındadır.
 */
export function OccurrenceRow({ item, onComplete, onUndo }: RowProps) {
  const theme = useTheme();
  const [showUndo, setShowUndo] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const isMarked = item.isCompleted || item.isPending;

  const handlePress = (): void => {
    if (isMarked) return;

    onComplete(item);
    setShowUndo(true);

    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShowUndo(false), UNDO_WINDOW_MS);
  };

  const handleUndo = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    setShowUndo(false);
    onUndo(item);
  };

  const stateSuffix = item.isPending
    ? '. Kaydedildi, bağlantı gelince gönderilecek'
    : item.isCompleted
      ? '. Tamamlandı'
      : '';

  return (
    <Card>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isMarked, disabled: isMarked }}
        accessibilityLabel={`${item.localTime} ${item.title}${stateSuffix}`}
        accessibilityHint={isMarked ? undefined : 'Tamamlamak için dokun'}
        disabled={isMarked}
        onPress={handlePress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          minHeight: MIN_TOUCH_TARGET,
        }}
      >
        <Text tone="muted" variant="caption">
          {item.localTime}
        </Text>
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <Text
            style={isMarked ? { textDecorationLine: 'line-through' } : undefined}
            tone={isMarked ? 'muted' : 'ink'}
          >
            {item.title}
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
            <Badge label={taskKindLabel(item.kind)} tone="neutral" />
            {item.isPending ? <Badge label="Gönderilecek" tone="warning" /> : null}
            {item.isCompleted ? <Badge label="Tamam" tone="success" /> : null}
          </View>
        </View>
      </Pressable>

      {showUndo && isMarked ? (
        <>
          <Divider />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.title} işaretini geri al`}
            onPress={handleUndo}
            style={{ justifyContent: 'center', minHeight: MIN_TOUCH_TARGET }}
          >
            <Text tone="accent" style={{ fontWeight: '600' }}>
              Geri al
            </Text>
          </Pressable>
        </>
      ) : null}
    </Card>
  );
}
