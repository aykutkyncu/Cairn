import type { ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';

import { resetAuthStore, useAuthStore } from '@/features/auth';
import { createQueryClient } from '@/lib/query-client';

import { useActiveCircle } from '../use-circles';

/**
 * Aktif çember seçimi testleri.
 *
 * En kritik davranış: seçili çember artık listede yoksa (üyelik kaldırılmış
 * olabilir) kullanıcı yanlış çemberde bırakılmaz.
 */

const mockListCircles = jest.fn();

jest.mock('../circle-repository', () => ({
  listCircles: () => mockListCircles(),
}));

const circle = (id: string, name: string) => ({
  id,
  careRecipientName: name,
  timezone: 'Europe/Istanbul',
  defaultCurrency: 'TRY',
  role: 'caregiver' as const,
});

describe('useActiveCircle', () => {
  let client: QueryClient;

  // Sarmalayıcı her render'da yeniden çağrılır; istemci dışarıda tutulmazsa
  // her render yeni bir önbellek yaratır ve sorgu hiç tamamlanmaz.
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    mockListCircles.mockReset();
    resetAuthStore();
    useAuthStore.setState({
      status: 'signed-in',
      user: { id: 'u-1', email: null, isAnonymous: false },
    });
    client = createQueryClient();
    client.setDefaultOptions({ queries: { retry: false, gcTime: 0 } });
  });

  afterEach(() => {
    client.clear();
    client.unmount();
  });

  it('seçim yokken listedeki ilk çemberi seçer', async () => {
    // Arrange
    mockListCircles.mockResolvedValue([circle('c-1', 'Fatma'), circle('c-2', 'Hasan')]);

    // Act
    const { result } = await renderHook(() => useActiveCircle(), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.activeCircle?.id).toBe('c-1'));
    expect(useAuthStore.getState().activeCircleId).toBe('c-1');
  });

  it('kullanıcının seçtiği çemberi korur', async () => {
    // Arrange
    mockListCircles.mockResolvedValue([circle('c-1', 'Fatma'), circle('c-2', 'Hasan')]);
    useAuthStore.getState().setActiveCircleId('c-2');

    // Act
    const { result } = await renderHook(() => useActiveCircle(), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.activeCircle?.id).toBe('c-2'));
  });

  it('seçili çember listeden düştüyse ilk çembere geçer', async () => {
    // Arrange: üyelik kaldırılmış bir çember hâlâ seçili.
    mockListCircles.mockResolvedValue([circle('c-1', 'Fatma')]);
    useAuthStore.getState().setActiveCircleId('silinmis-cember');

    // Act
    const { result } = await renderHook(() => useActiveCircle(), { wrapper });

    // Assert: sessizce yanlış çemberde bırakılmaz.
    await waitFor(() => expect(result.current.activeCircle?.id).toBe('c-1'));
    await waitFor(() => expect(useAuthStore.getState().activeCircleId).toBe('c-1'));
  });

  it('çember yoksa aktif çember null kalır', async () => {
    // Arrange
    mockListCircles.mockResolvedValue([]);

    // Act
    const { result } = await renderHook(() => useActiveCircle(), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeCircle).toBeNull();
    expect(useAuthStore.getState().activeCircleId).toBeNull();
  });

  it('hata durumunda isError bildirir ve çember uydurmaz', async () => {
    // Arrange
    mockListCircles.mockRejectedValue(Object.assign(new Error('forbidden'), { code: 'forbidden' }));

    // Act
    const { result } = await renderHook(() => useActiveCircle(), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.activeCircle).toBeNull();
  });

  it('oturum yokken sunucuya hiç gitmez', async () => {
    // Arrange
    resetAuthStore();
    useAuthStore.setState({ status: 'signed-out' });

    // Act
    const { result } = await renderHook(() => useActiveCircle(), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.activeCircle).toBeNull());
    expect(mockListCircles).not.toHaveBeenCalled();
  });
});
