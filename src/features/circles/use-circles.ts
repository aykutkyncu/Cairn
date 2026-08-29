import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth';

import { listCircles } from './circle-repository';
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
} as const;

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
