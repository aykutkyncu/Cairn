import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { logger } from './logger';

/**
 * Küçük JSON belgeleri için kalıcı, şifreli depo.
 *
 * NATIVE: `expo-secure-store` — iOS Keychain / Android Keystore. Sağlık
 * verisine dokunan çevrimdışı kayıtlar (tamamlama notu gibi) düz metin
 * olarak diske yazılmaz.
 *
 * WEB: SecureStore yoktur. Bu platformda depo **bellekte** tutulur ve
 * uygulama kapanınca kaybolur. Bilinçli bir karardır: web yalnız geliştirme
 * ve önizleme içindir ve `localStorage`'a sağlık verisi yazmak, mobil
 * şifreleme vaadini sessizce web'e taşımak olurdu.
 *
 * SecureStore anahtar başına yaklaşık 2 KB tutar; bu yüzden değer parçalara
 * bölünür. Bu depo **küçük kuyruklar** içindir, genel amaçlı bir veritabanı
 * değildir; çağıran taraf kayıt sayısını sınırlamalıdır.
 */

/** SecureStore anahtar boyut sınırının altında kalan güvenli parça boyutu. */
const CHUNK_SIZE = 1800;

const CHUNK_COUNT_SUFFIX = '__chunks';

const isWeb = Platform.OS === 'web';

/** SecureStore anahtarları yalnız harf, rakam, nokta, tire ve alt çizgi kabul eder. */
const toSafeKey = (key: string): string => key.replace(/[^A-Za-z0-9._-]/g, '_');

/** Web'de kullanılan bellek içi yedek. Kalıcı DEĞİLDİR. */
const memoryStore = new Map<string, string>();

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

const readRaw = async (key: string): Promise<string | null> => {
  if (isWeb) return memoryStore.get(key) ?? null;

  const safeKey = toSafeKey(key);
  const count = await readChunkCount(safeKey);
  if (count === 0) return null;

  let value = '';
  for (let index = 0; index < count; index += 1) {
    const chunk = await SecureStore.getItemAsync(`${safeKey}_${index}`);
    // Parçalardan biri eksikse kayıt bozuktur. Yarım bir kuyruk, hiç
    // olmayan kuyruktan daha tehlikelidir: eksik kayıtları gönderilmiş
    // sanabiliriz.
    if (chunk === null) {
      logger.warn('secure_json_chunk_missing', { key: safeKey, index });
      return null;
    }
    value += chunk;
  }
  return value;
};

const writeRaw = async (key: string, value: string): Promise<void> => {
  if (isWeb) {
    memoryStore.set(key, value);
    return;
  }

  const safeKey = toSafeKey(key);
  await removeChunks(safeKey);

  const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
  for (let index = 0; index < chunkCount; index += 1) {
    await SecureStore.setItemAsync(
      `${safeKey}_${index}`,
      value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
    );
  }
  await SecureStore.setItemAsync(`${safeKey}${CHUNK_COUNT_SUFFIX}`, String(chunkCount));
};

/**
 * JSON belgesini okur.
 *
 * Bozuk veya beklenmedik biçimli içerik `null` döndürür; çağıran taraf bunu
 * "kayıt yok" gibi ele alır. Ayrıştırma hatası loglanırken **içerik
 * yazılmaz**: kuyrukta sağlık verisi bulunabilir.
 */
export const readSecureJson = async <T>(key: string): Promise<T | null> => {
  const raw = await readRaw(key);
  if (raw === null) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn('secure_json_parse_failed', { key });
    return null;
  }
};

/** JSON belgesini yazar. */
export const writeSecureJson = async (key: string, value: unknown): Promise<void> => {
  await writeRaw(key, JSON.stringify(value));
};

/** Belgeyi tamamen siler. */
export const removeSecureJson = async (key: string): Promise<void> => {
  if (isWeb) {
    memoryStore.delete(key);
    return;
  }
  await removeChunks(toSafeKey(key));
};

/** Test yalıtımı için bellek içi web deposunu boşaltır. */
export const resetMemoryStore = (): void => {
  memoryStore.clear();
};

/**
 * Bu platformda depo gerçekten kalıcı ve şifreli mi?
 *
 * Arayüz, web'de kullanıcıya "çevrimdışı yazdıkların kaydedildi" demeden
 * önce bunu denetlemelidir.
 */
export const isPersistentSecureStore = !isWeb;
