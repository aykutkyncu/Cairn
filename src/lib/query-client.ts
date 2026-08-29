import { QueryClient } from '@tanstack/react-query';

import { logger } from './logger';

/**
 * TanStack Query yapılandırması.
 *
 * Sunucu kaynakları burada yaşar; Zustand'a kopyalanmaz. Önbellek oturuma
 * bağlıdır: çıkışta tamamen temizlenir, aksi halde bir sonraki kullanıcı
 * öncekinin verisini bir an için görebilir.
 */

/** Verinin taze sayıldığı süre. Bakım verisi saniyede bir değişmez. */
const STALE_TIME_MS = 30_000;

/** Kullanılmayan verinin bellekte tutulma süresi. */
const GC_TIME_MS = 5 * 60_000;

/** Ağ hatalarında azami yeniden deneme sayısı. */
const MAX_RETRIES = 2;

/**
 * Yetki ve doğrulama hataları yeniden denenmez.
 *
 * 401/403 tekrar denemekle düzelmez; yalnız kullanıcıyı bekletir ve sunucuya
 * gereksiz yük bindirir.
 */
const NON_RETRYABLE_CODES: ReadonlySet<string> = new Set([
  'unauthenticated',
  'forbidden',
  'not_configured',
  'invitation_invalid',
  'invitation_expired',
  'invitation_already_used',
]);

const errorCodeOf = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === 'string' ? code : null;
};

export const shouldRetry = (failureCount: number, error: unknown): boolean => {
  const code = errorCodeOf(error);
  if (code !== null && NON_RETRYABLE_CODES.has(code)) return false;
  return failureCount < MAX_RETRIES;
};

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        gcTime: GC_TIME_MS,
        retry: shouldRetry,
        // Çevrimdışıyken sorgu duraklatılır; hata olarak gösterilmez.
        // Kullanıcı çevrimdışı olduğunu şeritten zaten görür.
        networkMode: 'offlineFirst',
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Yazma işlemleri sessizce tekrarlanmaz: idempotency anahtarı olmayan
        // bir yazmanın tekrarı çift kayıt üretebilir. Faz 05'te outbox
        // mutation_id ile güvenli tekrarı sağlayacak.
        retry: false,
        networkMode: 'offlineFirst',
      },
    },
  });

/**
 * Önbelleği tamamen temizler.
 *
 * Oturum kapatma temizliğine `registerSessionCleaner` ile bağlanır. Yalnız
 * `clear()` yeterli değildir: devam eden sorgular iptal edilmezse yanıtları
 * temizlenmiş önbelleğe geri yazılabilir.
 */
export const clearQueryCache = async (client: QueryClient): Promise<void> => {
  await client.cancelQueries();
  client.clear();
  logger.info('query_cache_cleared');
};
