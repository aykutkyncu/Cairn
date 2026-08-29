import { useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';

import { registerSessionCleaner } from '@/features/auth';
import { startNetworkWatcher } from '@/lib/network';
import { clearQueryCache, createQueryClient } from '@/lib/query-client';
import { ErrorBoundary, ThemeProvider } from '@/ui';

import { reportBoundaryError } from './report-boundary-error';

/**
 * Uygulamanın sağlayıcı ağacı.
 *
 * Sıra bilinçlidir: hata sınırı EN DIŞTADIR, böylece bir sağlayıcının
 * kurulumunda oluşan hata da yakalanır. Tema sınırın içindedir ki hata
 * ekranı da doğru temada görünsün.
 */

export type AppProvidersProps = {
  readonly children: ReactNode;
  /** Testlerin kendi istemcisini vermesi için. */
  readonly queryClient?: QueryClient;
  readonly onGoHome?: () => void;
};

export function AppProviders({ children, queryClient, onGoHome }: AppProvidersProps) {
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
    <ErrorBoundary onError={reportBoundaryError} {...(onGoHome === undefined ? {} : { onGoHome })}>
      <ThemeProvider>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
