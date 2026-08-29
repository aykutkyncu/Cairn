import { buildOccurrenceId } from './occurrence';
import { occurrencesInRange } from './recurrence';
import type { Completion, Task } from './task-schema';
import { toLocalTimeString } from './timezone';

/**
 * Günün planı.
 *
 * Görev satırları + tekrar kuralları + tamamlama kayıtları birleştirilerek
 * Bugün ekranının göstereceği model üretilir. Saf bir fonksiyondur: ağ, saat
 * veya cihaz durumu okumaz — tümü parametredir, böylece DST ve zaman dilimi
 * davranışı test edilebilir.
 */

/** Günün bölümleri. Kullanıcı saat aralığı değil, günün bir parçasını görür. */
export type DayBlock = 'morning' | 'noon' | 'evening' | 'night';

/** Blok sınırları (yerel saat, dahil-hariç). */
const BLOCK_BOUNDS: readonly { readonly block: DayBlock; readonly startHour: number }[] = [
  { block: 'night', startHour: 0 },
  { block: 'morning', startHour: 5 },
  { block: 'noon', startHour: 11 },
  { block: 'evening', startHour: 17 },
  { block: 'night', startHour: 22 },
];

export const blockLabel = (block: DayBlock): string => {
  switch (block) {
    case 'morning':
      return 'Sabah';
    case 'noon':
      return 'Öğle';
    case 'evening':
      return 'Akşam';
    case 'night':
      return 'Gece';
  }
};

/** Yerel saate göre günün bölümünü belirler. */
export const blockOfHour = (hour: number): DayBlock => {
  let current: DayBlock = 'night';
  for (const bound of BLOCK_BOUNDS) {
    if (hour >= bound.startHour) current = bound.block;
  }
  return current;
};

/** Bugün ekranındaki tek bir satır. */
export type PlannedOccurrence = {
  readonly taskId: string;
  readonly occurrenceId: string;
  readonly title: string;
  readonly kind: Task['kind'];
  readonly assignedTo: string | null;
  /** `HH:MM`, çemberin saat diliminde. */
  readonly localTime: string;
  readonly block: DayBlock;
  /** Geçerli (void edilmemiş) tamamlama varsa onun kimliği. */
  readonly completionId: string | null;
  readonly isCompleted: boolean;
  /**
   * Kuyrukta bekleyen bir tamamlama var mı?
   *
   * Arayüz bunu "kaydedildi" değil, "gönderilecek" olarak gösterir.
   */
  readonly isPending: boolean;
};

/** Bugün ekranının tam modeli. */
export type DayPlan = {
  readonly localDate: string;
  readonly blocks: readonly {
    readonly block: DayBlock;
    readonly items: readonly PlannedOccurrence[];
  }[];
  /** Zamanı geçmiş ve tamamlanmamış örnekler. */
  readonly overdue: readonly PlannedOccurrence[];
  readonly total: number;
  readonly completed: number;
};

/**
 * Geçerli tamamlamaları çıkarır.
 *
 * `void` kayıtları mevcut tamamlamayı SİLMEZ, geçersizler. Bu yüzden geçerli
 * tamamlama kümesi, void edilenler düşülerek hesaplanır.
 */
export const activeCompletions = (
  completions: readonly Completion[],
): ReadonlyMap<string, Completion> => {
  const voided = new Set(
    completions
      .filter((completion) => completion.kind === 'void' && completion.voidsCompletionId !== null)
      .map((completion) => completion.voidsCompletionId as string),
  );

  const active = new Map<string, Completion>();
  for (const completion of completions) {
    if (completion.kind === 'void') continue;
    if (voided.has(completion.id)) continue;
    active.set(`${completion.taskId}|${completion.occurrenceId}`, completion);
  }
  return active;
};

const BLOCK_ORDER: readonly DayBlock[] = ['morning', 'noon', 'evening', 'night'];

export type BuildDayPlanInput = {
  readonly tasks: readonly Task[];
  readonly completions: readonly Completion[];
  /** Kuyrukta bekleyen tamamlamaların `taskId|occurrenceId` anahtarları. */
  readonly pendingKeys: ReadonlySet<string>;
  /** Gösterilecek gün, `YYYY-MM-DD`, çember saat diliminde. */
  readonly localDate: string;
  readonly timeZone: string;
  /** "Şimdi" — gecikme hesabı için. Testlerde sabitlenir. */
  readonly now: Date;
};

/** Bugün ekranının modelini üretir. */
export const buildDayPlan = (input: BuildDayPlanInput): DayPlan => {
  const active = activeCompletions(input.completions);
  const items: PlannedOccurrence[] = [];

  for (const task of input.tasks) {
    const occurrences = occurrencesInRange(
      {
        dtstartLocalDate: task.dtstartLocalDate,
        dtstartLocalTime: task.dtstartLocalTime,
        rrule: task.rrule,
        untilLocalDate: task.untilLocalDate,
      },
      input.localDate,
      input.localDate,
    );

    for (const clock of occurrences) {
      const occurrenceId = buildOccurrenceId(clock, input.timeZone);
      const key = `${task.id}|${occurrenceId}`;
      const completion = active.get(key);

      items.push({
        taskId: task.id,
        occurrenceId,
        title: task.title,
        kind: task.kind,
        assignedTo: task.assignedTo,
        localTime: toLocalTimeString(clock),
        block: blockOfHour(clock.hour),
        completionId: completion?.id ?? null,
        isCompleted: completion !== undefined,
        isPending: input.pendingKeys.has(key),
      });
    }
  }

  const byTime = (a: PlannedOccurrence, b: PlannedOccurrence): number =>
    a.localTime.localeCompare(b.localTime) || a.title.localeCompare(b.title, 'tr');

  const blocks = BLOCK_ORDER.map((block) => ({
    block,
    items: items.filter((item) => item.block === block).sort(byTime),
  })).filter((group) => group.items.length > 0);

  // Gecikenler: zamanı geçmiş, tamamlanmamış ve kuyrukta da beklemeyen
  // örnekler. Kuyruktakini "geciken" saymak, kullanıcıya yaptığı işi
  // yapılmamış göstermek olurdu.
  const overdue = items
    .filter((item) => !item.isCompleted && !item.isPending)
    .filter((item) => {
      const instant = new Date(item.occurrenceId);
      return instant.getTime() < input.now.getTime();
    })
    .sort(byTime);

  return {
    localDate: input.localDate,
    blocks,
    overdue,
    total: items.length,
    completed: items.filter((item) => item.isCompleted || item.isPending).length,
  };
};

/**
 * Tek cümlelik ilerleme özeti.
 *
 * Sayı değil cümle: bakım veren "4/7" değil, ne durumda olduğunu okumak
 * ister. Ton sakin tutulur; eksik görev bir suçlama değildir.
 */
export const progressSentence = (plan: DayPlan): string => {
  if (plan.total === 0) return 'Bugün için planlanmış bir şey yok.';
  if (plan.completed === 0) return `Bugün ${plan.total} iş var. Henüz başlanmadı.`;
  if (plan.completed === plan.total) return 'Bugünün her işi tamam.';
  return `Bugün ${plan.total} işten ${plan.completed} tanesi tamam.`;
};
