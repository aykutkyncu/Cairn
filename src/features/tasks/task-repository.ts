import { parseAtBoundary } from '@/lib/boundary';
import { logger } from '@/lib/logger';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

import {
  completionListSchema,
  taskListSchema,
  toCompletion,
  toTask,
  type Completion,
  type Task,
} from './task-schema';

/**
 * Görev veri erişimi.
 *
 * Katman sırası: ekran → hook → repository → Supabase. Ekranlar bu modülü de
 * doğrudan çağırmaz.
 *
 * Filtreler güvenlik için değildir; güvenlik RLS'tedir. Buradaki koşullar
 * yalnız silinmiş kayıtları ve ilgisiz çemberleri listeden çıkarır.
 */

export type TaskErrorCode =
  'not_configured' | 'unauthenticated' | 'invalid_response' | 'conflict' | 'network';

/** Repository hatası. Serbest metin taşımaz; mesaj kodun kendisidir. */
export class TaskError extends Error {
  readonly code: TaskErrorCode;

  constructor(code: TaskErrorCode) {
    super(code);
    this.name = 'TaskError';
    this.code = code;
  }
}

/** Postgres tekil kısıt ihlali. */
const UNIQUE_VIOLATION = '23505';

const toTaskError = (error: { readonly code?: string } | null): TaskError => {
  if (error?.code === UNIQUE_VIOLATION) return new TaskError('conflict');
  if (error?.code === '42501') return new TaskError('unauthenticated');
  return new TaskError('network');
};

/** Çemberin görev kurallarını getirir. */
export const listTasks = async (circleId: string): Promise<readonly Task[]> => {
  if (!isSupabaseConfigured) throw new TaskError('not_configured');

  let response: { data: unknown; error: { code?: string } | null };
  try {
    response = await getSupabaseClient()
      .from('tasks')
      .select(
        'id, circle_id, kind, title, dtstart_local_date, dtstart_local_time, rrule, recurrence_until_local_date, assigned_to',
      )
      .eq('circle_id', circleId)
      .is('deleted_at', null);
  } catch {
    throw new TaskError('network');
  }

  if (response.error !== null) {
    logger.warn('list_tasks_failed', { code: response.error.code ?? '' });
    throw toTaskError(response.error);
  }

  const parsed = parseAtBoundary(taskListSchema, 'task_list', 'list_tasks', response.data);
  if (!parsed.ok) throw new TaskError('invalid_response');

  return parsed.data.map(toTask);
};

/**
 * Bir gün aralığındaki tamamlama kayıtlarını getirir.
 *
 * `void` kayıtları da çekilir: geri alınmış bir tamamlamayı geçerli saymamak
 * için onları görmek gerekir.
 */
export const listCompletions = async (
  circleId: string,
  occurrenceIdPrefix: string,
): Promise<readonly Completion[]> => {
  if (!isSupabaseConfigured) throw new TaskError('not_configured');

  let response: { data: unknown; error: { code?: string } | null };
  try {
    response = await getSupabaseClient()
      .from('task_completions')
      .select('id, task_id, occurrence_id, kind, completed_at, completed_by, voids_completion_id')
      .eq('circle_id', circleId)
      .like('occurrence_id', `${occurrenceIdPrefix}%`);
  } catch {
    throw new TaskError('network');
  }

  if (response.error !== null) {
    logger.warn('list_completions_failed', { code: response.error.code ?? '' });
    throw toTaskError(response.error);
  }

  const parsed = parseAtBoundary(
    completionListSchema,
    'completion_list',
    'list_completions',
    response.data,
  );
  if (!parsed.ok) throw new TaskError('invalid_response');

  return parsed.data.map(toCompletion);
};

/** Sunucuya gönderilecek tamamlama kaydı. */
export type CompletionInput = {
  readonly mutationId: string;
  readonly circleId: string;
  readonly taskId: string;
  readonly occurrenceId: string;
  readonly kind: 'done' | 'skipped' | 'void';
  readonly voidsCompletionId: string | null;
};

/** Tamamlama gönderiminin sonucu. */
export type SubmitOutcome =
  /** Sunucu kaydı kabul etti. */
  | { readonly status: 'accepted' }
  /**
   * Kayıt zaten vardı.
   *
   * İki durumda oluşur: (a) aynı `mutation_id` ile yeniden deneme —
   * idempotent, (b) başka biri aynı örneği tamamlamış. İkisi de kuyruktan
   * silinmelidir: tekrar denemek yeni bir sonuç üretmez.
   */
  | { readonly status: 'already_recorded' }
  /** Geçici hata; kuyrukta kalır ve sonra denenir. */
  | { readonly status: 'retry' };

/**
 * Tamamlamayı sunucuya yazar.
 *
 * Fırlatmaz: çağıran taraf kuyruk yönetimi yapar ve her sonucu ele almak
 * zorundadır.
 */
export const submitCompletion = async (input: CompletionInput): Promise<SubmitOutcome> => {
  if (!isSupabaseConfigured) return { status: 'retry' };

  try {
    const { error } = await getSupabaseClient().from('task_completions').insert({
      circle_id: input.circleId,
      task_id: input.taskId,
      occurrence_id: input.occurrenceId,
      kind: input.kind,
      mutation_id: input.mutationId,
      voids_completion_id: input.voidsCompletionId,
    });

    if (error === null) return { status: 'accepted' };

    // Tekil kısıt: ya aynı mutation_id yeniden gönderildi, ya da başkası
    // aynı örneği tamamladı. İkisinde de tekrar denemek anlamsızdır.
    if (error.code === UNIQUE_VIOLATION) {
      logger.info('completion_already_recorded');
      return { status: 'already_recorded' };
    }

    logger.warn('submit_completion_failed', { code: error.code ?? '' });
    return { status: 'retry' };
  } catch {
    return { status: 'retry' };
  }
};
