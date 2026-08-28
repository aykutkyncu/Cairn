import { AppState, Platform } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { logger } from './logger';
import { sessionStorage } from './session-storage';

/**
 * Supabase istemcisi.
 *
 * Sözleşme gereği ekranlar bu modülü DOĞRUDAN içe aktaramaz; ESLint kuralı
 * `src/app` altından erişimi engeller. Veri erişimi `src/features` altındaki
 * repository ve hook katmanından geçer.
 *
 * Buradaki anahtar PUBLIC anon anahtarıdır ve istemci paketine gömülür; gizli
 * değildir. Güvenlik RLS ile sağlanır. service_role anahtarı hiçbir koşulda
 * istemciye konmaz.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Yapılandırma eksikse uygulama çökmez; ilgili akışlar kapalı görünür. */
export const isSupabaseConfigured =
  typeof supabaseUrl === 'string' &&
  supabaseUrl.length > 0 &&
  typeof supabaseAnonKey === 'string' &&
  supabaseAnonKey.length > 0;

let client: SupabaseClient | null = null;

/**
 * Supabase istemcisini döndürür.
 *
 * Yapılandırma yoksa hata fırlatır. Çağıran taraf önce
 * `isSupabaseConfigured` denetler ve kullanıcıya sakin bir açıklama gösterir;
 * teknik hata metni arayüze sızmaz.
 */
export const getSupabaseClient = (): SupabaseClient => {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase yapılandırması eksik');
  }

  if (client === null) {
    client = createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        storage: sessionStorage,
        // Oturum yenileme uygulama ön plandayken yapılır; arka planda zamanlayıcı
        // çalıştırmak mobilde güvenilir değildir.
        autoRefreshToken: true,
        persistSession: true,
        // Mobilde URL'den oturum algılama kapalıdır: derin bağlantılar
        // uygulamanın kendi yönlendirme katmanında doğrulanarak işlenir.
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
      global: {
        headers: { 'x-application-name': 'cairn' },
      },
    });

    // Uygulama arka plana alındığında otomatik yenilemeyi durdurur; öne
    // geldiğinde yeniden başlatır. Aksi halde arka planda başarısız yenileme
    // denemeleri birikir.
    if (Platform.OS !== 'web') {
      AppState.addEventListener('change', (state) => {
        if (client === null) return;
        if (state === 'active') {
          void client.auth.startAutoRefresh();
        } else {
          void client.auth.stopAutoRefresh();
        }
      });
    }

    logger.debug('supabase_client_created', { platform: Platform.OS });
  }

  return client;
};

/**
 * Bellekteki istemci örneğini bırakır.
 *
 * Oturum kapatma temizliğinin son adımıdır: yeni bir oturum açıldığında
 * istemci sıfırdan kurulur ve eski oturumun bellekteki izleri kalmaz.
 */
export const resetSupabaseClient = (): void => {
  client = null;
};
