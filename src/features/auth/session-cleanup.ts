import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { logger } from '@/lib/logger';

/**
 * Oturum kapatma temizliği.
 *
 * Sözleşme gereği çıkışta şunlar silinir: SecureStore anahtarları, sorgu
 * önbelleği, yerel şifreli veritabanı anahtarı ve çevrimdışı outbox.
 *
 * BİLİNEN SINIR: iOS Keychain kayıtları uygulama kaldırıldıktan sonra bile
 * cihazda kalabilir. Bu, işletim sistemi davranışıdır ve uygulama tarafından
 * değiştirilemez. Bu yüzden burada yalnız GERÇEK oturum kapatma temizliği
 * garanti edilir; "uygulamayı silince veri gider" gibi bir vaat verilmez.
 *
 * Faz 07'de şifreli yerel veritabanı eklendiğinde `clearLocalDatabaseKey` ve
 * `clearOutbox` gerçek işlerini yapacaktır; şu an kayıtlı temizleyici yoktur.
 */

/** Oturum kapatıldığında silinmesi gereken SecureStore anahtarları. */
const SECURE_KEYS = ['cairn.local-db-key', 'cairn.device-id', 'cairn.push-token'] as const;

/** Faz 07'de gerçek uygulamalarıyla değiştirilecek temizleyici kaydı. */
type Cleaner = () => Promise<void>;

const registeredCleaners: Cleaner[] = [];

/**
 * Ek bir temizleyici kaydeder.
 *
 * Sorgu önbelleği, yerel veritabanı ve outbox kendi modüllerinden temizleyici
 * kaydeder; böylece bu modül onlara bağımlı olmaz ve katman sınırı korunur.
 */
export const registerSessionCleaner = (cleaner: Cleaner): (() => void) => {
  registeredCleaners.push(cleaner);
  return () => {
    const index = registeredCleaners.indexOf(cleaner);
    if (index >= 0) registeredCleaners.splice(index, 1);
  };
};

/** Test yalıtımı için kayıtlı temizleyicileri sıfırlar. */
export const resetSessionCleaners = (): void => {
  registeredCleaners.length = 0;
};

/** Kaç temizleyicinin kayıtlı olduğunu döndürür (tanılama ve test için). */
export const registeredCleanerCount = (): number => registeredCleaners.length;

const deleteSecureKeys = async (): Promise<void> => {
  if (Platform.OS === 'web') return;

  for (const key of SECURE_KEYS) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      // Tek bir anahtarın silinememesi tüm temizliği durdurmamalı.
      // Hata kaydında anahtar ADI güvenlidir; değeri hiçbir zaman loglanmaz.
      logger.warn('secure_key_delete_failed', { key });
      void error;
    }
  }
};

/**
 * Tüm oturum artıklarını temizler.
 *
 * Temizleyicilerden biri hata verse bile diğerleri çalışır: yarım kalmış bir
 * temizlik, hiç yapılmamış temizlikten daha kötüdür.
 *
 * @returns Başarısız olan adım sayısı. Çağıran taraf bunu kullanıcıya teknik
 *   ayrıntı göstermeden raporlayabilir.
 */
export const clearSessionArtifacts = async (): Promise<{ failedSteps: number }> => {
  let failedSteps = 0;

  try {
    await deleteSecureKeys();
  } catch {
    failedSteps += 1;
  }

  for (const cleaner of [...registeredCleaners]) {
    try {
      await cleaner();
    } catch {
      failedSteps += 1;
    }
  }

  logger.info('session_artifacts_cleared', { failedSteps });
  return { failedSteps };
};

/** Silinen anahtarların listesi (dokümantasyon ve test için). */
export const secureKeysClearedOnSignOut: readonly string[] = SECURE_KEYS;
