import { logger } from '@/lib/logger';

import { listSendable, markAttempted, markSent, type CompletionEntry } from './completion-outbox';
import { submitCompletion } from './task-repository';

/**
 * Kuyruk gönderimi.
 *
 * Kuyruktaki her kayıt **aynı `mutationId` ile** gönderilir. Sunucudaki
 * `task_completions.mutation_id` tekilliği sayesinde yeniden deneme yeni
 * satır üretmez; bu yüzden "gönderdim mi bilmiyorum" durumunda tekrar
 * göndermek güvenlidir.
 *
 * Faz 07'de genel senkron motoru gelecek. Buradaki dar dilim yalnız
 * tamamlamaları taşır ve tek işi vardır: kullanıcının yaptığı işaretleme
 * kaybolmasın.
 */

export type FlushResult = {
  readonly sent: number;
  readonly failed: number;
  readonly remaining: number;
};

const sendOne = async (entry: CompletionEntry): Promise<boolean> => {
  const outcome = await submitCompletion({
    mutationId: entry.mutationId,
    circleId: entry.circleId,
    taskId: entry.taskId,
    occurrenceId: entry.occurrenceId,
    kind: entry.kind,
    voidsCompletionId: entry.voidsCompletionId,
  });

  // 'already_recorded' de başarıdır: kayıt sunucuda vardır, tekrar denemek
  // yeni bir sonuç üretmez.
  if (outcome.status === 'accepted' || outcome.status === 'already_recorded') {
    await markSent(entry.mutationId);
    return true;
  }

  await markAttempted(entry.mutationId);
  return false;
};

/**
 * Kuyruğu sunucuya boşaltır.
 *
 * Kayıtlar **sırayla** gönderilir. Paralel gönderim, aynı görevin farklı
 * örneklerinde sıralamayı bozabilir ve bir tamamlama ile onun geri alınması
 * ters sırada ulaşabilirdi.
 *
 * Bir kayıt kalıcı olarak başarısızsa kuyrukta kalır; sonraki çağrılarda
 * yeniden denenir ve deneme sınırını aşınca gönderilmez olur.
 */
export const flushCompletionOutbox = async (): Promise<FlushResult> => {
  const pending = await listSendable();
  if (pending.length === 0) return { sent: 0, failed: 0, remaining: 0 };

  let sent = 0;
  let failed = 0;

  for (const entry of pending) {
    const ok = await sendOne(entry);
    if (ok) {
      sent += 1;
      continue;
    }

    failed += 1;
    // İlk kalıcı hatada durulur: ağ yoksa kalan kayıtları denemek yalnız
    // deneme sayaçlarını boşuna şişirir.
    break;
  }

  const remaining = (await listSendable()).length;
  logger.info('completion_outbox_flushed', { sent, failed, remaining });

  return { sent, failed, remaining };
};

/** Kuyruktaki kayıtların `taskId|occurrenceId` anahtarları. */
export const pendingKeysOf = (entries: readonly CompletionEntry[]): ReadonlySet<string> =>
  new Set(entries.map((entry) => `${entry.taskId}|${entry.occurrenceId}`));
