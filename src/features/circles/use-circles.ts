import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createCircle, useAuthStore } from '@/features/auth';

import { countCircleMembers, listCircles } from './circle-repository';
import type { CircleSummary } from './circle-schema';

/**
 * Çember hook'ları.
 *
 * Sunucu verisi TanStack Query önbelleğinde yaşar; Zustand'da yalnız
 * "hangi çember aktif" bilgisi (bir kimlik) tutulur. Çemberin adı, rolü ve
 * saat dilimi buraya kopyalanmaz — kopya, eskiyen ikinci bir doğruluk
 * kaynağı demektir.
 */

export const circleKeys = {
  all: ['circles'] as const,
  list: () => [...circleKeys.all, 'list'] as const,
  memberCount: (circleId: string) => [...circleKeys.all, 'member-count', circleId] as const,
} as const;

/**
 * Çember paylaşılıyor mu (birden çok aktif üye var mı)?
 *
 * Yalnız ARAYÜZ METNİ için kullanılır. Tek kullanıcıya "çemberdeki herkes
 * görür" demek karşılığı olmayan bir sözdür. Sayı okunamadığında paylaşımdan
 * söz edilmez: olmayan bir paylaşımı varmış gibi anlatmak, var olanı
 * söylememekten kötüdür.
 */
export const useIsSharedCircle = (circleId: string | null): boolean => {
  const query = useQuery({
    queryKey: circleKeys.memberCount(circleId ?? ''),
    queryFn: () => countCircleMembers(circleId as string),
    enabled: circleId !== null,
  });

  return (query.data ?? 1) > 1;
};

/**
 * Kurulum: kaydı oluşturur ve LİSTEYİ GEÇERSİZLER.
 *
 * Geçersizleme olmadan kayıt sunucuda oluşuyor ama önbellekteki boş liste
 * duruyordu: kullanıcı kurulumu bitirdiğinde "Başlayalım" ekranına geri
 * düşüyordu. Cihazda ilk çalıştırmada görülen kusur buydu.
 */
export const useCreateCircle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { readonly name: string; readonly timezone: string }) =>
      createCircle(input.name, input.timezone),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: circleKeys.all });
    },
  });
};

export const useCircles = () => {
  const status = useAuthStore((state) => state.status);

  return useQuery({
    queryKey: circleKeys.list(),
    queryFn: listCircles,
    // Oturum yokken sorgu koşmaz: yetkisiz bir istek göndermek, hem gereksiz
    // hem de hata durumunu kullanıcıya yanlış biçimde gösterir.
    enabled: status === 'signed-in',
  });
};

/**
 * Aktif çemberi döndürür.
 *
 * Aktif çember seçili değilse veya seçili kimlik artık listede yoksa
 * (üyelik kaldırılmış olabilir) listedeki ilk çember seçilir. Bu düzeltme
 * bir yan etkidir ve açıkça yapılır: sessizce yanlış çemberi göstermek,
 * bakım verenin yanlış kişiye ilaç işaretlemesine yol açabilir.
 */
export const useActiveCircle = (): {
  readonly activeCircle: CircleSummary | null;
  readonly circles: readonly CircleSummary[];
  readonly isLoading: boolean;
  readonly isError: boolean;
} => {
  const query = useCircles();
  const activeCircleId = useAuthStore((state) => state.activeCircleId);
  const setActiveCircleId = useAuthStore((state) => state.setActiveCircleId);

  const circles = query.data ?? [];
  const selected = circles.find((circle) => circle.id === activeCircleId) ?? null;
  const fallback = circles[0] ?? null;
  const activeCircle = selected ?? fallback;

  useEffect(() => {
    if (query.isLoading) return;
    if (activeCircle === null) return;
    if (activeCircle.id === activeCircleId) return;
    setActiveCircleId(activeCircle.id);
  }, [activeCircle, activeCircleId, query.isLoading, setActiveCircleId]);

  return {
    activeCircle,
    circles,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
