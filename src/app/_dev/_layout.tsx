import { Redirect, Stack } from 'expo-router';

/**
 * Geliştirici rotalarının kapısı.
 *
 * Bu bölüm yalnız geliştirme yapılandırmasında açılır. Üretim paketinde rota
 * erişilemez olur ve kullanıcı ana ekrana yönlendirilir.
 *
 * Sınır: dosya üretim paketinden fiziksel olarak çıkarılmaz, yalnız erişilemez hale
 * gelir. Tam paket dışı bırakma bundler seviyesinde ayrı bir iş kalemidir.
 */
export default function DevLayout() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: true, title: 'Geliştirici' }} />;
}
