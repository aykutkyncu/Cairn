import * as SecureStore from 'expo-secure-store';

import {
  clearSessionArtifacts,
  registerSessionCleaner,
  registeredCleanerCount,
  resetSessionCleaners,
  secureKeysClearedOnSignOut,
} from '../session-cleanup';

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

const deleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<
  typeof SecureStore.deleteItemAsync
>;

describe('clearSessionArtifacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSessionCleaners();
  });

  it('tüm SecureStore anahtarlarını siler', async () => {
    // Arrange & Act
    await clearSessionArtifacts();

    // Assert
    const deletedKeys = deleteItemAsync.mock.calls.map(([key]) => key);
    for (const key of secureKeysClearedOnSignOut) {
      expect(deletedKeys).toContain(key);
    }
  });

  it('yerel veritabanı anahtarını ve push tokenını siler', async () => {
    // Arrange & Act
    await clearSessionArtifacts();

    // Assert: bu ikisi sözleşmede açıkça sayılıyor.
    const deletedKeys = deleteItemAsync.mock.calls.map(([key]) => key);
    expect(deletedKeys).toContain('cairn.local-db-key');
    expect(deletedKeys).toContain('cairn.push-token');
  });

  it('kayıtlı temizleyicileri çalıştırır', async () => {
    // Arrange
    const clearQueryCache = jest.fn(async () => undefined);
    const clearOutbox = jest.fn(async () => undefined);
    registerSessionCleaner(clearQueryCache);
    registerSessionCleaner(clearOutbox);

    // Act
    const result = await clearSessionArtifacts();

    // Assert
    expect(clearQueryCache).toHaveBeenCalledTimes(1);
    expect(clearOutbox).toHaveBeenCalledTimes(1);
    expect(result.failedSteps).toBe(0);
  });

  it('bir temizleyici hata verse bile diğerlerini çalıştırır', async () => {
    // Arrange: yarım kalmış temizlik, hiç yapılmamış temizlikten daha kötüdür.
    const failing = jest.fn(async () => {
      throw new Error('beklenmeyen');
    });
    const succeeding = jest.fn(async () => undefined);
    registerSessionCleaner(failing);
    registerSessionCleaner(succeeding);

    // Act
    const result = await clearSessionArtifacts();

    // Assert
    expect(succeeding).toHaveBeenCalledTimes(1);
    expect(result.failedSteps).toBe(1);
  });

  it('SecureStore silme hatası tüm temizliği durdurmaz', async () => {
    // Arrange
    deleteItemAsync.mockRejectedValueOnce(new Error('keychain hatası'));
    const cleaner = jest.fn(async () => undefined);
    registerSessionCleaner(cleaner);

    // Act
    await clearSessionArtifacts();

    // Assert
    expect(cleaner).toHaveBeenCalledTimes(1);
  });

  it('kayıt kaldırma fonksiyonu temizleyiciyi listeden çıkarır', async () => {
    // Arrange
    const cleaner = jest.fn(async () => undefined);
    const unregister = registerSessionCleaner(cleaner);
    expect(registeredCleanerCount()).toBe(1);

    // Act
    unregister();
    await clearSessionArtifacts();

    // Assert
    expect(registeredCleanerCount()).toBe(0);
    expect(cleaner).not.toHaveBeenCalled();
  });
});
