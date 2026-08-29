import { useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';

import { registerSessionCleaner, useAuthSession } from '@/features/auth';
import { startNetworkWatcher } from '@/lib/network';
import { clearQueryCache, createQueryClient } from '@/lib/query-client';
import { ErrorBoundary, ThemeProvider } from '@/ui';

import { reportBoundaryError } from './report-boundary-error';

/**
 * Uygulamanın sağlayıcı ağacı.
 *
 * Sıra bilinçlidir: **tema en dıştadır, hata sınırı onun içindedir.**
 * Hata ekranının kendisi tasarım sistemini (dolayısıyla tema tokenlarını)
 * kullanır; sınır temanın dışında olsaydı, bir render hatasında yedek ekran
 * da patlar ve kullanıcı hata ekranı yerine boş bir ekran görürdü.
 *
 * Bunun bedeli, `ThemeProvider`'ın KENDİ kurulumunda oluşacak bir hatanın
 * yakalanamamasıdır. Bu kabul edilmiş bir sınırdır: tema sağlayıcısı yalnız
 * bir context ve renk tablosu kurar, ağ veya depolama işi yapmaz.
 */

export type AppProvidersProps = {
  readonly children: ReactNode;
  /** Testlerin kendi istemcisini vermesi için. */
  readonly queryClient?: QueryClient;
  readonly onGoHome?: () => void;
};

export function AppProviders({ children, queryClient, onGoHome }: AppProvidersProps) {
  // Oturum durumunu Supabase ile eşitler. Bu çağrı olmadan uygulama açılış
  // ekranında `loading` durumunda sonsuza kadar bekler.
  useAuthSession();

  // İstemci bir kez oluşturulur ve bileşenin ömrü boyunca aynı kalır; bu
  // yüzden temizleyici doğrudan onu kapatabilir, ref'e gerek yoktur.
  const [client] = useState<QueryClient>(() => queryClient ?? createQueryClient());

  useEffect(() => {
    const stopWatcher = startNetworkWatcher();

    // Önbellek temizliği oturum kapatma akışına buradan kaydolur; böylece
    // auth modülü sorgu katmanına bağımlı olmaz.
    const unregister = registerSessionCleaner(() => clearQueryCache(client));

    return () => {
      unregister();
      stopWatcher();
    };
  }, [client]);

  return (
    <ThemeProvider>
      <ErrorBoundary
        onError={reportBoundaryError}
        {...(onGoHome === undefined ? {} : { onGoHome })}
      >
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
