import { logger } from '@/lib/logger';
import {
  isPersistentSecureStore,
  readSecureJson,
  removeSecureJson,
  writeSecureJson,
} from '@/lib/secure-json-store';

/**
 * Tamamlama kuyruğu (outbox).
 *
 * ÇEKİRDEK GARANTİ: bir görev tamamlandığında kayıt **önce kalıcı ve şifreli
 * yerel kuyruğa** yazılır, sonra sunucuya gönderilir. Uçak modunda yapılan
 * tamamlama, uygulama kapanıp açılsa bile kaybolmaz.
 *
 * Her kayıt istemcide üretilmiş kalıcı bir `mutationId` taşır. Yeniden
 * denemeler aynı kimlikle yapılır; sunucudaki `task_completions.mutation_id`
 * tekilliği ikinci denemenin yeni satır üretmesini engeller. Bu yüzden
 * "gönderdim mi bilmiyorum" durumunda tekrar göndermek güvenlidir.
 *
 * SINIR: kuyruk `expo-secure-store` üzerinde durur ve bu depo büyük veri
 * için tasarlanmamıştır. Bu yüzden kayıt sayısı `MAX_ENTRIES` ile
 * sınırlıdır. Sınıra ulaşıldığında **yeni kayıt reddedilir**; en eskisi
 * atılmaz. Kullanıcının tamamladığı bir görevi sessizce düşürmek, ona
 * kaydedilmemiş bir işi kaydedilmiş göstermekten daha kötüdür — çağıran
 * taraf reddi kullanıcıya bildirmek zorundadır.
 */

const OUTBOX_KEY = 'cairn.completion-outbox';

/** Kuyrukta tutulacak azami kayıt sayısı. */
export const MAX_ENTRIES = 200;

/** Bir kaydın kaç kez denendikten sonra kalıcı hata sayılacağı. */
export const MAX_ATTEMPTS = 8;

/** Kuyruğa yazılan tamamlama isteği. */
export type CompletionEntry = {
  /** İstemcide üretilen kalıcı mutasyon kimliği (UUID). */
  readonly mutationId: string;
  readonly circleId: string;
  readonly taskId: string;
  /** Kanonik occurrence kimliği. */
  readonly occurrenceId: string;
  readonly kind: 'done' | 'skipped' | 'void';
  /** Geri almada, geçersizlenen tamamlamanın kimliği. */
  readonly voidsCompletionId: string | null;
  /** Kaydın kuyruğa girdiği an (ISO-8601). */
  readonly queuedAt: string;
  /** Kaç kez gönderilmeye çalışıldı. */
  readonly attempts: number;
};

/** Kuyruğa ekleme sonucu. */
export type EnqueueResult =
  | { readonly ok: true; readonly queueSize: number }
  | { readonly ok: false; readonly reason: 'queue_full' | 'not_persistent' | 'write_failed' };

const readEntries = async (): Promise<CompletionEntry[]> => {
  const stored = await readSecureJson<CompletionEntry[]>(OUTBOX_KEY);
  return Array.isArray(stored) ? stored : [];
};

const writeEntries = async (entries: readonly CompletionEntry[]): Promise<void> => {
  if (entries.length === 0) {
    await removeSecureJson(OUTBOX_KEY);
    return;
  }
  await writeSecureJson(OUTBOX_KEY, entries);
};

/** Kuyruktaki kayıtları, giriş sırasıyla döndürür. */
export const listQueued = async (): Promise<readonly CompletionEntry[]> => readEntries();

/** Kuyruktaki kayıt sayısı. Arayüz bunu çevrimdışı şeridinde gösterir. */
export const queuedCount = async (): Promise<number> => (await readEntries()).length;

/**
 * Kaydı kuyruğa ekler.
 *
 * Aynı `mutationId` zaten kuyruktaysa **yeniden eklenmez**: çift dokunma bir
 * kaydı iki kez sıraya sokmamalıdır.
 *
 * Yazma başarıyla tamamlanmadan `ok: true` DÖNMEZ. Çağıran taraf, kullanıcıya
 * "kaydedildi" demeden önce bu sonucu beklemek zorundadır.
 */
export const enqueue = async (
  entry: Omit<CompletionEntry, 'queuedAt' | 'attempts'>,
): Promise<EnqueueResult> => {
  if (!isPersistentSecureStore) {
    // Web'de kuyruk kalıcı değildir; "kaydedildi" demek yanlış olurdu.
    return { ok: false, reason: 'not_persistent' };
  }

  const entries = await readEntries();

  const existing = entries.findIndex((queued) => queued.mutationId === entry.mutationId);
  if (existing >= 0) return { ok: true, queueSize: entries.length };

  if (entries.length >= MAX_ENTRIES) {
    logger.warn('completion_outbox_full', { queueSize: entries.length });
    return { ok: false, reason: 'queue_full' };
  }

  const next: CompletionEntry[] = [
    ...entries,
    { ...entry, queuedAt: new Date().toISOString(), attempts: 0 },
  ];

  try {
    await writeEntries(next);
  } catch {
    // Disk yazması başarısızsa kayıt YOKTUR. Kullanıcıya "kaydedildi"
    // demek, olmayan bir güvence vermektir.
    logger.warn('completion_outbox_write_failed');
    return { ok: false, reason: 'write_failed' };
  }

  logger.info('completion_queued', { queueSize: next.length });

  return { ok: true, queueSize: next.length };
};

/**
 * Kaydı kuyruktan siler.
 *
 * Yalnız sunucu kaydı kabul ettiğinde (veya "zaten var" dediğinde) çağrılır.
 */
export const markSent = async (mutationId: string): Promise<void> => {
  const entries = await readEntries();
  await writeEntries(entries.filter((entry) => entry.mutationId !== mutationId));
};

/**
 * Henüz gönderilmemiş bir kaydı kuyruktan çıkarır.
 *
 * Geri almanın çevrimdışı karşılığıdır: sunucuya hiç ulaşmamış bir
 * tamamlamayı `void` kaydıyla geçersizlemek anlamsızdır — geçersizlenecek
 * bir kayıt yoktur. Kuyruktan çıkarmak, kullanıcının "yapmadım" demesinin
 * doğru karşılığıdır.
 *
 * @returns Kayıt bulunup çıkarıldıysa true.
 */
export const dequeueByOccurrence = async (
  taskId: string,
  occurrenceId: string,
): Promise<boolean> => {
  const entries = await readEntries();
  const remaining = entries.filter(
    (entry) => !(entry.taskId === taskId && entry.occurrenceId === occurrenceId),
  );

  if (remaining.length === entries.length) return false;

  await writeEntries(remaining);
  logger.info('completion_dequeued', { queueSize: remaining.length });
  return true;
};

/** Başarısız denemeyi işaretler ve kaydı kuyrukta bırakır. */
export const markAttempted = async (mutationId: string): Promise<void> => {
  const entries = await readEntries();
  await writeEntries(
    entries.map((entry) =>
      entry.mutationId === mutationId ? { ...entry, attempts: entry.attempts + 1 } : entry,
    ),
  );
};

/**
 * Gönderilmeye hazır kayıtları döndürür.
 *
 * Deneme sınırını aşanlar **kuyrukta kalır ama gönderilmez**: sonsuza kadar
 * denemek pili tüketir, sessizce atmak ise kullanıcının işini kaybetmektir.
 * Bu kayıtlar kullanıcıya gösterilip elle çözülmelidir.
 */
export const listSendable = async (): Promise<readonly CompletionEntry[]> =>
  (await readEntries()).filter((entry) => entry.attempts < MAX_ATTEMPTS);

/** Deneme sınırını aşmış, kullanıcı müdahalesi gereken kayıtlar. */
export const listStuck = async (): Promise<readonly CompletionEntry[]> =>
  (await readEntries()).filter((entry) => entry.attempts >= MAX_ATTEMPTS);

/**
 * Kuyruğu tamamen siler.
 *
 * Oturum kapatma temizliğine bağlanır: bir sonraki kullanıcının cihazında
 * öncekinin bekleyen tamamlamaları kalmamalıdır.
 */
export const clearOutbox = async (): Promise<void> => {
  await removeSecureJson(OUTBOX_KEY);
  logger.info('completion_outbox_cleared');
};
