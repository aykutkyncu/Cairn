import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOnlineStatus } from '@/features/app-shell';
import { logger } from '@/lib/logger';

import { dequeueByOccurrence, enqueue, listQueued, type EnqueueResult } from './completion-outbox';
import { flushCompletionOutbox, pendingKeysOf } from './completion-sync';
import { buildDayPlan, type DayPlan, type PlannedOccurrence } from './day-plan';
import { listCompletions, listTasks } from './task-repository';
import { toWallClock, toLocalDateString } from './timezone';

/**
 * Bugün ekranının veri kaynağı.
 *
 * Tamamlama akışının sırası **değiştirilemez**:
 *   1. Kalıcı ve şifreli kuyruğa yaz.
 *   2. Yazma başarılıysa arayüzü güncelle.
 *   3. Bağlantı varsa sunucuya göndermeyi dene.
 *
 * Kuyruğa yazma başarısızsa kullanıcıya "kaydedildi" DENMEZ. Sözleşme:
 * "Çevrimdışı yazı yalnızca kalıcı outbox'a başarıyla yazıldıysa kullanıcının
 * beklediği şekilde gösterilir."
 */

export const taskKeys = {
  all: ['tasks'] as const,
  list: (circleId: string) => [...taskKeys.all, 'list', circleId] as const,
  completions: (circleId: string, day: string) =>
    [...taskKeys.all, 'completions', circleId, day] as const,
  outbox: ['tasks', 'outbox'] as const,
} as const;

/** Çemberin saat dilimindeki bugünün tarihi. */
export const todayLocalDate = (timeZone: string, now: Date = new Date()): string =>
  toLocalDateString(toWallClock(now, timeZone));

export type UseDayPlanOptions = {
  readonly circleId: string | null;
  readonly timeZone: string;
  /** Gösterilecek gün. Verilmezse çember saat dilimindeki bugün. */
  readonly localDate?: string;
};

export const useDayPlan = (options: UseDayPlanOptions) => {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const circleId = options.circleId;

  const [now, setNow] = useState(() => new Date());
  const localDate = options.localDate ?? todayLocalDate(options.timeZone, now);

  // Gecikme hesabı zamana bağlıdır; dakikada bir tazelenir. Saniyede bir
  // güncellemek pili tüketir ve ekranı görünür biçimde değiştirmez.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const tasksQuery = useQuery({
    queryKey: taskKeys.list(circleId ?? ''),
    queryFn: () => listTasks(circleId as string),
    enabled: circleId !== null,
  });

  const completionsQuery = useQuery({
    queryKey: taskKeys.completions(circleId ?? '', localDate),
    queryFn: () => listCompletions(circleId as string, localDate),
    enabled: circleId !== null,
  });

  const outboxQuery = useQuery({
    queryKey: taskKeys.outbox,
    queryFn: listQueued,
    // Kuyruk yereldir: ağ durumu ne olursa olsun okunur.
    networkMode: 'always',
  });

  const plan: DayPlan = useMemo(
    () =>
      buildDayPlan({
        tasks: tasksQuery.data ?? [],
        completions: completionsQuery.data ?? [],
        pendingKeys: pendingKeysOf(outboxQuery.data ?? []),
        localDate,
        timeZone: options.timeZone,
        now,
      }),
    [tasksQuery.data, completionsQuery.data, outboxQuery.data, localDate, options.timeZone, now],
  );

  const refreshLocal = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: taskKeys.outbox });
  }, [queryClient]);

  const refreshServer = useCallback(async () => {
    if (circleId === null) return;
    await queryClient.invalidateQueries({
      queryKey: taskKeys.completions(circleId, localDate),
    });
  }, [circleId, localDate, queryClient]);

  /**
   * Kuyruğu göndermeyi dener ve sonucu arayüze yansıtır.
   *
   * Çevrimdışıyken hiç denenmez: başarısız olacağı bilinen bir istek yalnız
   * deneme sayacını şişirir.
   */
  const flush = useCallback(async () => {
    if (!onlineManager.isOnline()) return;

    const result = await flushCompletionOutbox();
    await refreshLocal();
    if (result.sent > 0) await refreshServer();
  }, [refreshLocal, refreshServer]);

  // Bağlantı geri geldiğinde bekleyenler kendiliğinden gönderilir.
  useEffect(() => {
    if (!isOnline) return;
    void flush();
  }, [isOnline, flush]);

  const completion = useMutation({
    networkMode: 'always',
    mutationFn: async (variables: {
      readonly item: PlannedOccurrence;
      readonly kind: 'done' | 'void';
    }): Promise<EnqueueResult> => {
      if (circleId === null) return { ok: false, reason: 'not_persistent' };

      // Henüz gönderilmemiş bir tamamlamanın geri alınması, kuyruktan
      // çıkarmaktır: geçersizlenecek bir sunucu kaydı yoktur.
      if (variables.kind === 'void' && variables.item.completionId === null) {
        const removed = await dequeueByOccurrence(
          variables.item.taskId,
          variables.item.occurrenceId,
        );
        return removed ? { ok: true, queueSize: 0 } : { ok: false, reason: 'write_failed' };
      }

      const mutationId = Crypto.randomUUID();

      // 1. Önce kalıcı kuyruk. Bu adım başarısızsa hiçbir şey olmamış sayılır.
      const queued = await enqueue({
        mutationId,
        circleId,
        taskId: variables.item.taskId,
        occurrenceId: variables.item.occurrenceId,
        kind: variables.kind,
        voidsCompletionId: variables.kind === 'void' ? variables.item.completionId : null,
      });

      return queued;
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        logger.warn('completion_not_queued', { code: result.reason });
        return;
      }
      // 2. Arayüz kuyruktan beslenir: kullanıcı işaretlemesini hemen görür.
      await refreshLocal();
      // 3. Bağlantı varsa gönderilir.
      await flush();
    },
  });

  return {
    plan,
    isLoading: tasksQuery.isLoading || completionsQuery.isLoading,
    isError: tasksQuery.isError || completionsQuery.isError,
    isOnline,
    pendingCount: outboxQuery.data?.length ?? 0,
    /** Görevi tamamlar. Sonuç, kuyruğa yazmanın başarısını bildirir. */
    complete: (item: PlannedOccurrence) => completion.mutateAsync({ item, kind: 'done' }),
    /** Tamamlamayı geri alır: silmez, void kaydı üretir. */
    undo: (item: PlannedOccurrence) => completion.mutateAsync({ item, kind: 'void' }),
    refetch: async () => {
      await Promise.all([tasksQuery.refetch(), completionsQuery.refetch(), refreshLocal()]);
    },
  };
};
