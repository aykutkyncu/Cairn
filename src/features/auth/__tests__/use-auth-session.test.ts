import { renderHook, waitFor } from '@testing-library/react-native';

import { resetAuthStore, useAuthStore } from '../auth-store';
import { useAuthSession } from '../use-auth-session';

/**
 * Oturum eşitleme testleri.
 *
 * Bu hook, uygulamanın ilk web çalıştırmasında ortaya çıkan bir kusurun
 * karşılığıdır: `auth-store` başlangıçta `loading` durumundaydı ve hiçbir
 * yer onu değiştirmiyordu. Sonuç, açılış ekranında sonsuza kadar bekleyen
 * bir uygulamaydı — kullanıcı giriş ekranına hiç ulaşamıyordu.
 *
 * Aşağıdaki testler, durumun HER yoldan çıkışa bağlandığını sabitler.
 */

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockUnsubscribe = jest.fn();
const mockIsConfigured = jest.fn(() => true);

jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mockIsConfigured();
  },
  getSupabaseClient: () => ({
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (handler: unknown) => mockOnAuthStateChange(handler),
    },
  }),
}));

const supabaseUser = { id: 'user-1', email: 'ornek@eposta.com' };

describe('useAuthSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthStore();
    mockIsConfigured.mockReturnValue(true);
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
  });

  it('oturum yoksa durumu signed-out yapar', async () => {
    // Arrange & Act
    renderHook(() => useAuthSession());

    // Assert: 'loading'de bırakmak kullanıcıyı açılış ekranında bekletirdi.
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signed-out'));
  });

  it('kalıcı depodaki oturumu okuyup signed-in yapar', async () => {
    // Arrange
    mockGetSession.mockResolvedValue({ data: { session: { user: supabaseUser } } });

    // Act
    renderHook(() => useAuthSession());

    // Assert
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signed-in'));
    expect(useAuthStore.getState().user).toEqual({ id: 'user-1', email: 'ornek@eposta.com' });
  });

  it('yapılandırma yoksa sunucuya gitmeden signed-out yapar', async () => {
    // Arrange: sunucu bağlı değilse oturum da olamaz.
    mockIsConfigured.mockReturnValue(false);

    // Act
    renderHook(() => useAuthSession());

    // Assert
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signed-out'));
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('oturum okuma hatasında signed-out yapar', async () => {
    // Arrange: yarım bir oturumla devam etmek, yeniden giriş istemekten riskli.
    mockGetSession.mockRejectedValue(new Error('secure store unavailable'));

    // Act
    renderHook(() => useAuthSession());

    // Assert
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signed-out'));
  });

  it('sonraki oturum değişikliklerini dinler', async () => {
    // Arrange
    renderHook(() => useAuthSession());
    await waitFor(() => expect(mockOnAuthStateChange).toHaveBeenCalled());

    // Act: magic-link dönüşü.
    const handler = mockOnAuthStateChange.mock.calls[0]?.[0] as (
      event: string,
      session: unknown,
    ) => void;
    handler('SIGNED_IN', { user: supabaseUser });

    // Assert
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signed-in'));
  });

  it('çıkış olayında durumu ve aktif çemberi temizler', async () => {
    // Arrange
    mockGetSession.mockResolvedValue({ data: { session: { user: supabaseUser } } });
    renderHook(() => useAuthSession());
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signed-in'));
    useAuthStore.getState().setActiveCircleId('c-1');

    // Act
    const handler = mockOnAuthStateChange.mock.calls[0]?.[0] as (
      event: string,
      session: unknown,
    ) => void;
    handler('SIGNED_OUT', null);

    // Assert: yeni kullanıcı öncekinin çemberini bir an bile görmemeli.
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signed-out'));
    expect(useAuthStore.getState().activeCircleId).toBeNull();
  });

  it('kimliği olmayan kullanıcıyı oturum saymaz', async () => {
    // Arrange: bozuk yanıt sessizce "giriş yapılmış" sayılmamalı.
    mockGetSession.mockResolvedValue({ data: { session: { user: { email: 'a@b.com' } } } });

    // Act
    renderHook(() => useAuthSession());

    // Assert
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signed-out'));
  });

  it('kaldırıldığında aboneliği bırakır', async () => {
    // Arrange
    const { unmount } = await renderHook(() => useAuthSession());
    await waitFor(() => expect(mockOnAuthStateChange).toHaveBeenCalled());

    // Act
    await unmount();

    // Assert
    await waitFor(() => expect(mockUnsubscribe).toHaveBeenCalledTimes(1));
  });
});
