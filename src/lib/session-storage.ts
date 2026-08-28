import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Supabase oturum depolaması.
 *
 * NATIVE (iOS/Android): expo-secure-store kullanılır. Token'lar iOS Keychain ve
 * Android Keystore tarafından korunur.
 *
 * WEB: SecureStore yoktur. Bu platformda oturum tarayıcının localStorage'ında
 * tutulur ve XSS'e karşı SecureStore'un verdiği korumadan YOKSUNDUR. Mobil
 * şifreleme varsayımı web'e TAŞINMAZ; bu sınır README'de ve aşağıda açıkça
 * belirtilir. Web yalnız geliştirme ve önizleme içindir.
 */

/** SecureStore anahtar boyut sınırı (yaklaşık). Aşan değerler parçalanır. */
const CHUNK_SIZE = 1800;

/** Parçalı kayıtlarda parça sayısını tutan anahtar soneki. */
const CHUNK_COUNT_SUFFIX = '__chunks';

const isWeb = Platform.OS === 'web';

/** SecureStore anahtarları yalnız harf, rakam, nokta, tire ve alt çizgi kabul eder. */
const toSafeKey = (key: string): string => key.replace(/[^A-Za-z0-9._-]/g, '_');

const webStorage = {
  getItem(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Depolama kapalı olabilir (özel pencere, site verisi engeli).
      // Oturum bellekte kalır; kullanıcı yeniden giriş yapar.
    }
  },
  removeItem(key: string): void {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Sessizce yut: silme başarısızsa da oturum kapatma akışı devam etmeli.
    }
  },
};

const readChunkCount = async (safeKey: string): Promise<number> => {
  const raw = await SecureStore.getItemAsync(`${safeKey}${CHUNK_COUNT_SUFFIX}`);
  if (raw === null) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const removeChunks = async (safeKey: string): Promise<void> => {
  const count = await readChunkCount(safeKey);
  for (let index = 0; index < count; index += 1) {
    await SecureStore.deleteItemAsync(`${safeKey}_${index}`);
  }
  await SecureStore.deleteItemAsync(`${safeKey}${CHUNK_COUNT_SUFFIX}`);
};

/**
 * Supabase'in beklediği depolama arayüzü.
 *
 * Oturum JSON'u SecureStore'un boyut sınırını aşabildiği için değer parçalara
 * bölünerek yazılır. Parça sayısı ayrı bir anahtarda tutulur.
 */
export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) return webStorage.getItem(key);

    const safeKey = toSafeKey(key);
    const count = await readChunkCount(safeKey);
    if (count === 0) return null;

    let value = '';
    for (let index = 0; index < count; index += 1) {
      const chunk = await SecureStore.getItemAsync(`${safeKey}_${index}`);
      // Parçalardan biri eksikse kayıt bozuktur; kısmi oturum döndürmek yerine
      // yokmuş gibi davranılır ve kullanıcı yeniden giriş yapar.
      if (chunk === null) return null;
      value += chunk;
    }
    return value;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      webStorage.setItem(key, value);
      return;
    }

    const safeKey = toSafeKey(key);
    await removeChunks(safeKey);

    const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
    for (let index = 0; index < chunkCount; index += 1) {
      const chunk = value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(`${safeKey}_${index}`, chunk);
    }
    await SecureStore.setItemAsync(`${safeKey}${CHUNK_COUNT_SUFFIX}`, String(chunkCount));
  },

  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      webStorage.removeItem(key);
      return;
    }
    await removeChunks(toSafeKey(key));
  },
};

/**
 * Bu platformda oturumun donanım destekli güvenli depoda tutulup tutulmadığı.
 * Arayüz, web'de kullanıcıya daha kısıtlı bir gizlilik vaadi göstermek için
 * bu bilgiyi kullanır.
 */
export const isSecureSessionStorage = !isWeb;
