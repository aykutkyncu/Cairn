import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { CircleGate, canWrite, useActiveCircle } from '@/features/circles';
import { MedicalFileView, useHealthRecords, useMedications } from '@/features/medical';
import { todayLocalDate } from '@/features/tasks';
import { ErrorState, Skeleton, useTheme } from '@/ui';

/**
 * Dosya sekmesi.
 *
 * Ekran veri istemcisine dokunmaz: ilaçlar ve sağlık kayıtları hook
 * katmanından gelir, görünüm `MedicalFileView` içindedir.
 *
 * Belgeler, notlar ve arama sonraki adımlarda eklenecek; var olmayan bir
 * özellik varmış gibi gösterilmez.
 */
export default function DosyaScreen() {
  return <CircleGate>{(circleId) => <MedicalFileContainer circleId={circleId} />}</CircleGate>;
}

function MedicalFileContainer({ circleId }: { readonly circleId: string }) {
  const theme = useTheme();
  const { activeCircle } = useActiveCircle();
  const timeZone = activeCircle?.timezone ?? 'Europe/Istanbul';

  const medications = useMedications(circleId);
  const records = useHealthRecords(circleId, ['allergy', 'diagnosis', 'doctor']);

  const isLoading = medications.isLoading || records.isLoading;
  const isError = medications.isError || records.isError;

  if (isLoading) {
    return (
      <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
        <Skeleton height={theme.spacing.xxl} accessibilityLabel="Dosya yükleniyor" />
        <Skeleton height={theme.spacing.xxl} />
        <Skeleton height={theme.spacing.xxl} />
      </View>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Dosya alınamadı"
        description="Bağlantını kontrol edip tekrar deneyebilirsin. Kayıtlı bilgiler duruyor."
        onRetry={() => {
          void medications.refetch();
          void records.refetch();
        }}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
      <MedicalFileView
        medications={medications.data ?? []}
        records={records.data ?? []}
        // Gün, cihazın değil ÇEMBERİN saat dilimindedir: "bugün biten" bir
        // ilaç iki bakım verende farklı gün altında görünmemelidir.
        today={todayLocalDate(timeZone)}
        canWrite={activeCircle !== null && canWrite(activeCircle.role)}
        onAddMedication={() => router.push('/ilac-ekle')}
        onAddRecord={(type) => router.push({ pathname: '/kayit-ekle', params: { type } })}
        onOpenNotes={() => router.push('/notlar')}
        onOpenSearch={() => router.push('/ara')}
      />
    </ScrollView>
  );
}
