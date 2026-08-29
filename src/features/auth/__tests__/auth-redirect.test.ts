import { Platform } from 'react-native';

import { NATIVE_AUTH_REDIRECT, WEB_FALLBACK_ORIGIN, authRedirectUrl } from '../auth-redirect';

/**
 * Magic-link dönüş adresi testleri.
 *
 * Bu davranış, ilk gerçek giriş denemesinde ortaya çıkan bir kusurun
 * karşılığıdır: web'de `cairn://auth/callback` adresi gönderiliyordu ve
 * tarayıcı uygulama şemasını açamadığı için kullanıcı boş sayfa görüyordu.
 */

describe('authRedirectUrl', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true });
  });

  const setPlatform = (os: string): void => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  };

  it('native platformlarda uygulama şemasını kullanır', () => {
    setPlatform('android');
    expect(authRedirectUrl()).toBe(NATIVE_AUTH_REDIRECT);

    setPlatform('ios');
    expect(authRedirectUrl()).toBe(NATIVE_AUTH_REDIRECT);
  });

  it('native platformda verilen origin’i yok sayar', () => {
    // Uygulama şeması sabittir; sayfa kökü native'de anlamsızdır.
    setPlatform('android');
    expect(authRedirectUrl('http://localhost:8081')).toBe(NATIVE_AUTH_REDIRECT);
  });

  it('web’de sayfanın kendi kökünü kullanır', () => {
    // Tarayıcı `cairn://` şemasını açamaz; kullanıcı boş sayfa görürdü.
    setPlatform('web');
    expect(authRedirectUrl('http://localhost:8081')).toBe('http://localhost:8081');
  });

  it('web’de farklı bir kök verildiğinde onu kullanır', () => {
    setPlatform('web');
    expect(authRedirectUrl('https://cairn.example')).toBe('https://cairn.example');
  });

  it('web’de kök okunamazsa geliştirme adresine düşer', () => {
    setPlatform('web');
    expect(authRedirectUrl(null)).toBe(WEB_FALLBACK_ORIGIN);
    expect(authRedirectUrl('')).toBe(WEB_FALLBACK_ORIGIN);
  });

  it('hiçbir platformda uygulama şemasını web adresiyle karıştırmaz', () => {
    setPlatform('web');
    expect(authRedirectUrl('http://localhost:8081').startsWith('cairn://')).toBe(false);

    setPlatform('android');
    expect(authRedirectUrl().startsWith('http')).toBe(false);
  });
});
