import { RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { useActiveCircle } from '@/features/circles';
import { DayPlanView, useDayPlan } from '@/features/tasks';
import { ErrorState, OfflineBanner, Skeleton, useTheme } from '@/ui';

import { CircleGate } from './_circle-gate';

/**
 * Bugün sekmesi.
 *
 * Ekran veri istemcisine dokunmaz: `useDayPlan` hook'u görevleri, tamamlama
 * kayıtlarını ve çevrimdışı kuyruğu birleştirir.
 */
export default function BugunScreen() {
  return <CircleGate>{(circleId) => <DayPlanContainer circleId={circleId} />}</CircleGate>;
}

function DayPlanContainer({ circleId }: { readonly circleId: string }) {
  const theme = useTheme();
  const { activeCircle } = useActiveCircle();
  const day = useDayPlan({
    circleId,
    timeZone: activeCircle?.timezone ?? 'Europe/Istanbul',
  });

  if (day.isLoading) {
    return (
      <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
        <Skeleton height={theme.spacing.xxl} accessibilityLabel="Bugünün planı yükleniyor" />
        <Skeleton height={theme.spacing.xxl} />
        <Skeleton height={theme.spacing.xxl} />
      </View>
    );
  }

  if (day.isError) {
    return (
      <ErrorState
        title="Bugünün planı alınamadı"
        description="Bağlantını kontrol edip tekrar deneyebilirsin. İşaretlediklerin cihazında duruyor."
        onRetry={() => {
          void day.refetch();
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner isOffline={!day.isOnline} pendingCount={day.pendingCount} />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              void day.refetch();
            }}
          />
        }
      >
        <DayPlanView
          plan={day.plan}
          onComplete={(item) => {
            void day.complete(item);
          }}
          onUndo={(item) => {
            void day.undo(item);
          }}
          onAddTask={() => router.push('/gorev-ekle')}
        />
      </ScrollView>
    </View>
  );
}
