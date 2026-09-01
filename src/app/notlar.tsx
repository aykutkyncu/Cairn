import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { CircleGate, canWrite, useActiveCircle } from '@/features/circles';
import { NotesView, useHealthRecords } from '@/features/medical';
import { ErrorState, Skeleton, useTheme } from '@/ui';

/**
 * Notlar ve randevu soruları ekranı.
 *
 * Düzenleme bağlantısı yalnız kaydın KİMLİĞİNİ taşır; başlık ve gövde rota
 * parametresine yazılmaz — sağlık verisi URL'ye girmez.
 */
export default function NotlarScreen() {
  return <CircleGate>{(circleId) => <NotesContainer circleId={circleId} />}</CircleGate>;
}

function NotesContainer({ circleId }: { readonly circleId: string }) {
  const theme = useTheme();
  const { activeCircle } = useActiveCircle();
  const query = useHealthRecords(circleId, ['note', 'question']);

  if (query.isLoading) {
    return (
      <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
        <Skeleton height={theme.spacing.xxl} accessibilityLabel="Notlar yükleniyor" />
        <Skeleton height={theme.spacing.xxl} />
      </View>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Notlar alınamadı"
        description="Bağlantını kontrol edip tekrar deneyebilirsin. Kayıtlı notların duruyor."
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const records = query.data ?? [];

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.spacing.lg }}
      style={{ backgroundColor: theme.colors.surface }}
    >
      <NotesView
        notes={records.filter((record) => record.type === 'note')}
        questions={records.filter((record) => record.type === 'question')}
        canWrite={activeCircle !== null && canWrite(activeCircle.role)}
        onAddNote={() => router.push({ pathname: '/kayit-ekle', params: { type: 'note' } })}
        onAddQuestion={() => router.push({ pathname: '/kayit-ekle', params: { type: 'question' } })}
        onEdit={(record) => router.push({ pathname: '/kayit-duzenle', params: { id: record.id } })}
        // Yazar adı henüz çözülmüyor: üye adlarını okumak için profil
        // sorgusu gerekiyor ve o henüz yazılmadı. Uydurulmuş bir ad
        // göstermek yerine tarih tek başına gösterilir.
        authorName={() => null}
      />
    </ScrollView>
  );
}
