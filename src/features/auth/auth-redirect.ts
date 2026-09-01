import { Platform } from 'react-native';

/**
 * Magic-link dönüş adresi.
 *
 * Platforma göre DEĞİŞİR ve bu fark önemlidir:
 *
 * - **Native (iOS/Android):** `cairn://auth/callback`. Uygulama şeması
 *   işletim sistemi tarafından uygulamaya yönlendirilir.
 * - **Web:** sayfanın kendi kökü (`http://localhost:8081` gibi). Tarayıcı
 *   `cairn://` şemasını açamaz; kullanıcı boş bir sekmeyle karşılaşır.
 *
 * Bu ayrım, uygulamanın ilk web çalıştırmasında ortaya çıktı: sabit
 * `cairn://auth/callback` adresi gönderildiği için magic-link'e tıklamak
 * boş sayfa açıyordu.
 *
 * Dönen adres, Supabase projesinin **izin listesinde** bulunmak zorundadır
 * (`Authentication → URL Configuration → Redirect URLs`). Listede olmayan
 * bir adrese yönlendirme sessizce site_url'e düşer.
 */

/** Native platformlarda kullanılan sabit dönüş adresi. */
export const NATIVE_AUTH_REDIRECT = 'cairn://auth/callback';

/** Web'de sayfanın kökü okunamazsa kullanılacak geliştirme adresi. */
export const WEB_FALLBACK_ORIGIN = 'http://localhost:8081';

/**
 * Bu platform için magic-link dönüş adresini üretir.
 *
 * @param origin Testlerin web kökünü verebilmesi için. Verilmezse tarayıcıdan
 *   okunur.
 */
export const authRedirectUrl = (origin?: string | null): string => {
  if (Platform.OS !== 'web') return NATIVE_AUTH_REDIRECT;

  if (typeof origin === 'string' && origin.length > 0) return origin;

  // `globalThis.location` sunucu tarafı render veya test ortamında
  // bulunmayabilir; bu durumda geliştirme adresine düşülür.
  const location = (globalThis as { location?: { origin?: string } }).location;
  const readOrigin = location?.origin;

  return typeof readOrigin === 'string' && readOrigin.length > 0 ? readOrigin : WEB_FALLBACK_ORIGIN;
};
