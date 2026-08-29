import { useEffect } from 'react';

import { logger } from '@/lib/logger';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

import { useAuthStore, type AuthUser } from './auth-store';

/**
 * Oturum durumunu Supabase ile eşitler.
 *
 * BU HOOK OLMADAN UYGULAMA AÇILMAZ: `auth-store` başlangıçta `loading`
 * durumundadır ve `src/app/index.tsx` bu durumda hiçbir yere yönlendirmez.
 * Onu `signed-in` veya `signed-out` yapacak tek yer burasıdır.
 *
 * İki kaynak dinlenir:
 *   1. Açılışta kalıcı depodaki oturum (`getSession`) — SecureStore'dan okunur.
 *   2. Sonraki değişiklikler (`onAuthStateChange`) — giriş, çıkış, token
 *      yenileme ve magic-link dönüşü.
 *
 * Yapılandırma yoksa durum `signed-out` yapılır. `loading`'de bırakmak,
 * kullanıcıyı açılış ekranında sonsuza kadar bekletirdi.
 */

/** Supabase kullanıcısını uygulamanın sakladığı asgari biçime indirger. */
const toAuthUser = (
  user: { id?: unknown; email?: unknown } | null | undefined,
): AuthUser | null => {
  if (user === null || user === undefined) return null;
  if (typeof user.id !== 'string' || user.id.length === 0) return null;

  return {
    id: user.id,
    // E-posta yalnız arayüzde gösterilir; log ve analytics'e yazılmaz.
    email: typeof user.email === 'string' ? user.email : null,
  };
};

export const useAuthSession = (): void => {
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Sunucu bağlı değil: oturum da olamaz. Kullanıcı giriş ekranını görür
      // ve oradaki mesaj yapılandırmanın eksik olduğunu söyler.
      logger.warn('auth_session_not_configured');
      setSession(null);
      return;
    }

    let active = true;
    const client = getSupabaseClient();

    void client.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(toAuthUser(data.session?.user));
      })
      .catch(() => {
        // Kalıcı depo okunamadıysa oturum yok sayılır: yarım bir oturumla
        // devam etmek, yeniden giriş istemekten daha risklidir.
        if (active) setSession(null);
      });

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      // Olay adı hassas değildir; kullanıcı kimliği ve e-posta loglanmaz.
      logger.debug('auth_state_changed', { event });
      setSession(toAuthUser(session?.user));
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [setSession]);
};
