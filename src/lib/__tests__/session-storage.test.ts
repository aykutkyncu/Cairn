import * as SecureStore from 'expo-secure-store';

import { isSecureSessionStorage, sessionStorage } from '../session-storage';

/**
 * Oturum depolaması testleri.
 *
 * Kritik davranışlar:
 * - Uzun oturum JSON'u SecureStore boyut sınırını aşmasın diye parçalanır.
 * - Parçalardan biri eksikse KISMİ oturum döndürülmez; kayıt yokmuş sayılır.
 *   Yarım bir oturumla devam etmek, yeniden giriş istemekten daha risklidir.
 * - Yazma öncesi eski parçalar silinir; aksi halde kısa bir oturum, uzun bir
 *   oturumun artık parçalarıyla birleşip bozuk değer üretirdi.
 */

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const getItemAsync = SecureStore.getItemAsync as jest.MockedFunction<
  typeof SecureStore.getItemAsync
>;
const setItemAsync = SecureStore.setItemAsync as jest.MockedFunction<
  typeof SecureStore.setItemAsync
>;
const deleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<
  typeof SecureStore.deleteItemAsync
>;

/** SecureStore'u bellekte taklit eden basit bir depo. */
const createFakeStore = () => {
  const store = new Map<string, string>();

  getItemAsync.mockImplementation(async (key: string) => store.get(key) ?? null);
  setItemAsync.mockImplementation(async (key: string, value: string) => {
    store.set(key, value);
  });
  deleteItemAsync.mockImplementation(async (key: string) => {
    store.delete(key);
  });

  return store;
};

describe('sessionStorage', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    store = createFakeStore();
  });

  it('mobilde güvenli depo kullanıldığını bildirir', () => {
    // Test ortamı native platform olarak koşar.
    expect(isSecureSessionStorage).toBe(true);
  });

  it('kaydedilen değeri aynen geri okur', async () => {
    // Arrange & Act
    await sessionStorage.setItem('sb-token', '{"access_token":"abc"}');

    // Assert
    await expect(sessionStorage.getItem('sb-token')).resolves.toBe('{"access_token":"abc"}');
  });

  it('kayıt yokken null döndürür', async () => {
    await expect(sessionStorage.getItem('yok')).resolves.toBeNull();
  });

  it('boyut sınırını aşan değeri parçalara böler', async () => {
    // Arrange: 4000 karakterlik bir oturum JSON'u.
    const long = 'x'.repeat(4000);

    // Act
    await sessionStorage.setItem('sb-token', long);

    // Assert: 1800'lük parçalar -> 3 parça + sayaç.
    expect(store.get('sb-token__chunks')).toBe('3');
    expect(store.get('sb-token_0')?.length).toBe(1800);
    expect(store.get('sb-token_2')?.length).toBe(400);
    await expect(sessionStorage.getItem('sb-token')).resolves.toBe(long);
  });

  it('parçalardan biri eksikse kısmi oturum döndürmez', async () => {
    // Arrange
    await sessionStorage.setItem('sb-token', 'y'.repeat(4000));
    store.delete('sb-token_1');

    // Act & Assert: yarım oturumla devam etmek yeniden girişten risklidir.
    await expect(sessionStorage.getItem('sb-token')).resolves.toBeNull();
  });

  it('yeni yazmadan önce eski parçaları siler', async () => {
    // Arrange: önce uzun, sonra kısa bir oturum.
    await sessionStorage.setItem('sb-token', 'a'.repeat(4000));

    // Act
    await sessionStorage.setItem('sb-token', 'kısa');

    // Assert: eski parçalar kalsaydı okuma bozuk değer üretirdi.
    expect(store.get('sb-token__chunks')).toBe('1');
    expect(store.has('sb-token_1')).toBe(false);
    expect(store.has('sb-token_2')).toBe(false);
    await expect(sessionStorage.getItem('sb-token')).resolves.toBe('kısa');
  });

  it('silme işlemi tüm parçaları ve sayacı kaldırır', async () => {
    // Arrange
    await sessionStorage.setItem('sb-token', 'b'.repeat(4000));

    // Act
    await sessionStorage.removeItem('sb-token');

    // Assert
    expect(store.size).toBe(0);
    await expect(sessionStorage.getItem('sb-token')).resolves.toBeNull();
  });

  it('SecureStore alfabesine uymayan anahtarı güvenli biçime çevirir', async () => {
    // Arrange & Act: Supabase anahtarları ':' ve '/' içerebilir.
    await sessionStorage.setItem('sb:proje/auth-token', 'değer');

    // Assert
    expect(store.has('sb_proje_auth-token__chunks')).toBe(true);
    await expect(sessionStorage.getItem('sb:proje/auth-token')).resolves.toBe('değer');
  });

  it('bozuk parça sayacını sıfır sayar', async () => {
    // Arrange: dışarıdan bozulmuş bir sayaç.
    store.set('sb-token__chunks', 'sayı-değil');

    // Act & Assert
    await expect(sessionStorage.getItem('sb-token')).resolves.toBeNull();
  });

  it('boş değeri sıfır parça olarak yazar', async () => {
    await sessionStorage.setItem('sb-token', '');

    expect(store.get('sb-token__chunks')).toBe('0');
    await expect(sessionStorage.getItem('sb-token')).resolves.toBeNull();
  });
});
