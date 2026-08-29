import { z } from 'zod';

/**
 * Görev ve tamamlama şemaları.
 *
 * Sunucudan gelen her satır kullanıldığı sınırda doğrulanır. Şema, tabloda
 * var olan her sütunu değil, arayüzün gerçekten kullandığı alanları
 * tanımlar: taşınmayan bir alan, bir gün loga veya hata raporuna düşemez.
 */

/** `public.task_kind` enum'u. */
export const taskKindSchema = z.enum(['medication', 'appointment', 'visit', 'other']);
export type TaskKind = z.infer<typeof taskKindSchema>;

/** `public.completion_kind` enum'u. */
export const completionKindSchema = z.enum(['done', 'skipped', 'void']);
export type CompletionKind = z.infer<typeof completionKindSchema>;

const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * `HH:MM` veya `HH:MM:SS`. Postgres `time` sütunu saniyeli biçim döndürür.
 *
 * Regex yerine uzunluk + parça denetimi kullanılır: sabit uzunluklu bu kalıp
 * için ikisi eşdeğerdir, fakat düz kod okunması ve denetlenmesi daha kolaydır.
 */
const localTimeSchema = z.string().refine((value) => {
  const parts = value.split(':');
  if (parts.length !== 2 && parts.length !== 3) return false;
  return parts.every((part) => part.length === 2 && /^[0-9]+$/.test(part));
}, 'Saat biçimi HH:MM veya HH:MM:SS olmalıdır');

export const taskRowSchema = z.object({
  id: z.string().uuid(),
  circle_id: z.string().uuid(),
  kind: taskKindSchema,
  title: z.string().min(1).max(300),
  dtstart_local_date: localDateSchema,
  dtstart_local_time: localTimeSchema,
  rrule: z.string().nullable(),
  recurrence_until_local_date: localDateSchema.nullable(),
  assigned_to: z.string().uuid().nullable(),
});

export type TaskRow = z.infer<typeof taskRowSchema>;
export const taskListSchema = z.array(taskRowSchema);

export const completionRowSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid(),
  occurrence_id: z.string().min(1).max(40),
  kind: completionKindSchema,
  completed_at: z.string(),
  completed_by: z.string().uuid().nullable(),
  voids_completion_id: z.string().uuid().nullable(),
});

export type CompletionRow = z.infer<typeof completionRowSchema>;
export const completionListSchema = z.array(completionRowSchema);

/** Arayüzün kullandığı görev biçimi. Sunucu sütun adları buraya sızmaz. */
export type Task = {
  readonly id: string;
  readonly circleId: string;
  readonly kind: TaskKind;
  /** Görev başlığı sağlık verisine işaret eder: log ve push'a yazılmaz. */
  readonly title: string;
  readonly dtstartLocalDate: string;
  readonly dtstartLocalTime: string;
  readonly rrule: string | null;
  readonly untilLocalDate: string | null;
  readonly assignedTo: string | null;
};

export const toTask = (row: TaskRow): Task => ({
  id: row.id,
  circleId: row.circle_id,
  kind: row.kind,
  title: row.title,
  dtstartLocalDate: row.dtstart_local_date,
  dtstartLocalTime: row.dtstart_local_time,
  rrule: row.rrule,
  untilLocalDate: row.recurrence_until_local_date,
  assignedTo: row.assigned_to,
});

/** Arayüzün kullandığı tamamlama biçimi. */
export type Completion = {
  readonly id: string;
  readonly taskId: string;
  readonly occurrenceId: string;
  readonly kind: CompletionKind;
  readonly completedAt: string;
  readonly completedBy: string | null;
  readonly voidsCompletionId: string | null;
};

export const toCompletion = (row: CompletionRow): Completion => ({
  id: row.id,
  taskId: row.task_id,
  occurrenceId: row.occurrence_id,
  kind: row.kind,
  completedAt: row.completed_at,
  completedBy: row.completed_by,
  voidsCompletionId: row.voids_completion_id,
});

/** Görev türünün kullanıcıya gösterilecek Türkçe adı. */
export const taskKindLabel = (kind: TaskKind): string => {
  switch (kind) {
    case 'medication':
      return 'İlaç';
    case 'appointment':
      return 'Randevu';
    case 'visit':
      return 'Ziyaret';
    case 'other':
      return 'Diğer';
  }
};
