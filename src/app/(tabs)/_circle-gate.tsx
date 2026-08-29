import type { ReactNode } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { useActiveCircle } from '@/features/circles';
import { EmptyState, ErrorState, Skeleton, useTheme } from '@/ui';

/**
 * Sekme içeriğini aktif çemberin durumuna göre kapılar.
 *
 * Her sekme aynı dört durumu ele almak zorundadır: yükleniyor, çember yok,
 * hata ve içerik. Bunu her ekranda yeniden yazmak, birinde unutulmasına yol
 * açar; tek yerde toplanır.
 *
 * Dosya adı alt çizgiyle başlar: Expo Router bunu rota saymaz.
 */

export type CircleGateProps = {
  /** Çember hazır olduğunda gösterilecek içerik. */
  readonly children: (circleId: string) => ReactNode;
};

export function CircleGate({ children }: CircleGateProps) {
  const theme = useTheme();
  const { activeCircle, isLoading, isError } = useActiveCircle();

  if (isLoading) {
    return (
      <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
        <Skeleton height={theme.spacing.xxl} accessibilityLabel="İçerik yükleniyor" />
        <Skeleton height={theme.spacing.xxl} />
        <Skeleton height={theme.spacing.xxl} />
      </View>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Çemberler alınamadı"
        description="Bağlantını kontrol edip tekrar deneyebilirsin. Kayıtlı bilgilerin duruyor."
      />
    );
  }

  if (activeCircle === null) {
    return (
      <EmptyState
        title="Henüz bir çemberin yok"
        description="Bakımını paylaştığın kişi için bir çember kur, sonra diğerlerini davet et."
        actionLabel="Çember kur"
        onAction={() => router.push('/(onboarding)/create-circle')}
      />
    );
  }

  return <>{children(activeCircle.id)}</>;
}
