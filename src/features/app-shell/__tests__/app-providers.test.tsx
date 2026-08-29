import { Text as RNText } from 'react-native';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';

import { clearSessionArtifacts, resetSessionCleaners } from '@/features/auth';
import { createQueryClient } from '@/lib/query-client';

import { AppProviders } from '../app-providers';

/**
 * Sağlayıcı ağacı testleri.
 *
 * Kritik davranış: oturum kapatıldığında sorgu önbelleği GERÇEKTEN temizlenir.
 * Aksi halde bir sonraki kullanıcı, öncekinin verisini bir an için görebilir.
 */

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  }),
}));

function CacheProbe() {
  const client = useQueryClient();
  const cached = client.getQueryData<string>(['probe']);
  return <RNText>{cached ?? 'boş'}</RNText>;
}

describe('AppProviders', () => {
  beforeEach(() => {
    resetSessionCleaners();
  });

  it('çocuklarını sağlayıcı ağacının içinde gösterir', async () => {
    const { getByText } = await render(
      <AppProviders>
        <RNText>İçerik</RNText>
      </AppProviders>,
    );

    expect(getByText('İçerik')).toBeTruthy();
  });

  it('sorgu istemcisini çocuklara sunar', async () => {
    const client = createQueryClient();
    client.setQueryData(['probe'], 'önbellekteki değer');

    const { getByText } = await render(
      <AppProviders queryClient={client}>
        <CacheProbe />
      </AppProviders>,
    );

    expect(getByText('önbellekteki değer')).toBeTruthy();
  });

  it('oturum kapatma temizliğine önbelleği kaydeder', async () => {
    // Arrange
    const client = createQueryClient();
    client.setQueryData(['probe'], 'önceki kullanıcının verisi');

    await render(
      <AppProviders queryClient={client}>
        <RNText>İçerik</RNText>
      </AppProviders>,
    );

    // Act: gerçek oturum kapatma temizliği çalışır.
    await clearSessionArtifacts();

    // Assert
    await waitFor(() => expect(client.getQueryData(['probe'])).toBeUndefined());
  });

  it('sağlayıcı kaldırıldığında temizleyici kaydını geri alır', async () => {
    // Arrange
    const client = createQueryClient();
    const { unmount } = await render(
      <AppProviders queryClient={client}>
        <RNText>İçerik</RNText>
      </AppProviders>,
    );

    // Act
    unmount();
    client.setQueryData(['probe'], 'yeni değer');
    await clearSessionArtifacts();

    // Assert: kaldırılmış bir ağacın önbelleği artık temizlenmez.
    expect(client.getQueryData(['probe'])).toBe('yeni değer');
  });

  it('render hatasını yakalar ve kullanıcı dostu ekran gösterir', async () => {
    // Arrange
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    function Exploding(): never {
      throw new Error('Metformin kaydı okunamadı: Ayşe Yılmaz');
    }

    // Act
    const { getByText, toJSON } = await render(
      <AppProviders>
        <Exploding />
      </AppProviders>,
    );

    // Assert
    expect(getByText('Bir şeyler ters gitti')).toBeTruthy();
    expect(JSON.stringify(toJSON())).not.toContain('Metformin');

    consoleError.mockRestore();
  });
});

describe('QueryClientProvider bağlantısı', () => {
  it('AppProviders dışındaki bir ağaç kendi istemcisini kullanır', async () => {
    // Yalıtım kontrolü: sağlayıcı ağacı küresel bir istemci sızdırmaz.
    const client = createQueryClient();
    client.setQueryData(['probe'], 'bağımsız');

    const { getByText } = await render(
      <QueryClientProvider client={client}>
        <CacheProbe />
      </QueryClientProvider>,
    );

    expect(getByText('bağımsız')).toBeTruthy();
  });
});
