import { parseAtBoundary } from '@/lib/boundary';
import { logger } from '@/lib/logger';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

import { PRESET_RRULES, type RecurrencePreset } from './recurrence';
import { taskRowSchema, toTask, type Task, type TaskKind } from './task-schema';
import { TaskError } from './task-repository';

/**
 * Görev oluşturma.
 *
 * Kullanıcı RRULE görmez: dört hazır seçenekten birini seçer, kural burada
 * üretilir. Veritabanına **tek kural satırı** yazılır; occurrence üretilmez.
 */

export type CreateTaskInput = {
  readonly circleId: string;
  readonly kind: TaskKind;
  readonly title: string;
  /** `YYYY-MM-DD`, çemberin saat diliminde. */
  readonly localDate: string;
  /** `HH:MM`, çemberin saat diliminde. */
  readonly localTime: string;
  readonly recurrence: RecurrencePreset;
  /** Özel tekrarda doğrudan verilen kural. */
  readonly customRRule?: string | null;
  readonly assignedTo: string | null;
};

/** Girdi doğrulamasının sonucu. Alan adları arayüzün bildiği adlardır. */
export type ValidationIssue = 'title_empty' | 'title_too_long' | 'date_invalid' | 'time_invalid';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Girdiyi sunucuya göndermeden önce doğrular.
 *
 * Bu bir güvenlik sınırı DEĞİLDİR: gerçek doğrulama veritabanı kısıtlarında
 * ve RLS'tedir. Buradaki kontrol, kullanıcıya ağ gecikmesi beklemeden anlaşılır
 * bir uyarı göstermek içindir.
 */
export const validateTaskInput = (input: CreateTaskInput): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const title = input.title.trim();

  if (title.length === 0) issues.push('title_empty');
  if (title.length > 300) issues.push('title_too_long');
  if (!DATE_PATTERN.test(input.localDate)) issues.push('date_invalid');
  if (!TIME_PATTERN.test(input.localTime)) issues.push('time_invalid');

  return issues;
};

/** Doğrulama sorununun kullanıcıya gösterilecek Türkçe karşılığı. */
export const validationMessage = (issue: ValidationIssue): string => {
  switch (issue) {
    case 'title_empty':
      return 'Görevin bir adı olmalı.';
    case 'title_too_long':
      return 'Görev adı çok uzun.';
    case 'date_invalid':
      return 'Tarihi GG.AA.YYYY yerine YYYY-AA-GG biçiminde gir.';
    case 'time_invalid':
      return 'Saati 24 saatlik biçimde gir, örneğin 08:00.';
  }
};

/** Hazır seçenekten RRULE üretir. Kullanıcı bu metni görmez. */
export const rruleForPreset = (
  preset: RecurrencePreset,
  customRRule: string | null = null,
): string | null => {
  // Switch, dinamik nesne indeksinden kaçınır ve yeni bir seçenek
  // eklendiğinde derleyicinin eksik dalı bildirmesini sağlar.
  switch (preset) {
    case 'custom':
      return customRRule;
    case 'once':
      return PRESET_RRULES.once;
    case 'daily':
      return PRESET_RRULES.daily;
    case 'weekdays':
      return PRESET_RRULES.weekdays;
    case 'weekly':
      return PRESET_RRULES.weekly;
  }
};

/**
 * Görevi oluşturur.
 *
 * Tek kural satırı yazılır. `recurrence_until_local_date` bu ekranda
 * sorulmaz: süresiz tekrar varsayılır ve kullanıcı görevi silerek durdurur.
 * Bitiş tarihi sormak, ilk kurulumda bakım vereni gereksiz bir karara
 * zorlardı.
 */
export const createTask = async (input: CreateTaskInput): Promise<Task> => {
  if (!isSupabaseConfigured) throw new TaskError('not_configured');

  const issues = validateTaskInput(input);
  if (issues.length > 0) throw new TaskError('invalid_response');

  let response: { data: unknown; error: { code?: string } | null };

  try {
    response = await getSupabaseClient()
      .from('tasks')
      .insert({
        circle_id: input.circleId,
        kind: input.kind,
        title: input.title.trim(),
        dtstart_local_date: input.localDate,
        dtstart_local_time: input.localTime,
        rrule: rruleForPreset(input.recurrence, input.customRRule ?? null),
        assigned_to: input.assignedTo,
      })
      .select(
        'id, circle_id, kind, title, dtstart_local_date, dtstart_local_time, rrule, recurrence_until_local_date, assigned_to',
      )
      .single();
  } catch {
    throw new TaskError('network');
  }

  if (response.error !== null) {
    // Görev BAŞLIĞI sağlık verisine işaret eder ve loga yazılmaz.
    logger.warn('create_task_failed', { code: response.error.code ?? '' });
    throw new TaskError(response.error.code === '42501' ? 'unauthenticated' : 'network');
  }

  const parsed = parseAtBoundary(taskRowSchema, 'task', 'create_task', response.data);
  if (!parsed.ok) throw new TaskError('invalid_response');

  logger.info('task_created', { kind: input.kind });
  return toTask(parsed.data);
};
