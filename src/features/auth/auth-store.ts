import { create } from 'zustand';

/**
 * Oturum ve aktif çember durumu.
 *
 * Sözleşme gereği Zustand YALNIZ oturum, aktif çember ve tema tercihi için
 * kullanılır. Sunucu kaynakları (görevler, ilaçlar, notlar) buraya
 * kopyalanmaz; onlar TanStack Query önbelleğinde yaşar.
 */

/** Oturumun yaşam döngüsündeki durum. */
export type AuthStatus =
  /** Kalıcı depodan oturum okunuyor. */
  | 'loading'
  /** Oturum yok. */
  | 'signed-out'
  /** Oturum var. */
  | 'signed-in';

export type AuthUser = {
  readonly id: string;
  /** Yalnız giriş akışında gösterilir; log ve analytics'e yazılmaz. */
  readonly email: string | null;
  /**
   * Hesap anonim mi?
   *
   * Anonim hesap GERÇEK bir hesaptır (kendi `auth.uid()`'si vardır, RLS
   * normal çalışır) fakat **yalnız bu cihaza bağlıdır**: e-posta
   * eklenmeden cihaz kaybolursa veri geri getirilemez. Arayüz bunu sakin
   * ama açık biçimde söylemek zorundadır.
   */
  readonly isAnonymous: boolean;
};

type AuthState = {
  readonly status: AuthStatus;
  readonly user: AuthUser | null;
  /** Kullanıcının o an baktığı çember. Üyelik yoksa null. */
  readonly activeCircleId: string | null;
  readonly setSession: (user: AuthUser | null) => void;
  readonly setActiveCircleId: (circleId: string | null) => void;
  readonly clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  activeCircleId: null,

  setSession: (user) =>
    set({
      user,
      status: user === null ? 'signed-out' : 'signed-in',
      // Oturum değiştiğinde aktif çember taşınmaz: yeni kullanıcı önceki
      // kullanıcının çemberini görüyormuş gibi bir an bile oluşmamalıdır.
      ...(user === null ? { activeCircleId: null } : {}),
    }),

  setActiveCircleId: (circleId) => set({ activeCircleId: circleId }),

  clear: () => set({ status: 'signed-out', user: null, activeCircleId: null }),
}));

/** Test yalıtımı için depoyu başlangıç durumuna döndürür. */
export const resetAuthStore = (): void => {
  useAuthStore.setState({ status: 'loading', user: null, activeCircleId: null });
};
