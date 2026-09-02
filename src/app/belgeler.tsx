import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';

import { CircleGate, canWrite, useActiveCircle } from '@/features/circles';
import {
  formatBytes,
  uploadOutcomeMessage,
  uploadRejectionMessage,
  useDocuments,
  useSignedDocumentUrl,
  useUploadDocument,
  type MedicalDocument,
  type UploadSource,
} from '@/features/medical';
import { Button, Card, EmptyState, ErrorState, Skeleton, Text, useTheme } from '@/ui';

/**
 * Belgeler ekranı.
 *
 * Kamera ve galeri **yalnız kullanıcının dokunuşuyla** açılır; uygulama
 * kendiliğinden hiçbir kaynağa erişmez. İptal ve izin reddi hata değildir.
 *
 * Görüntüleme kısa ömürlü imzalı URL ile yapılır ve adres her açılışta
 * yeniden üretilir. Kalıcı bir genel bağlantı hiçbir zaman oluşturulmaz.
 */
export default function BelgelerScreen() {
  return <CircleGate>{(circleId) => <DocumentsContainer circleId={circleId} />}</CircleGate>;
}

function DocumentsContainer({ circleId }: { readonly circleId: string }) {
  const theme = useTheme();
  const { activeCircle } = useActiveCircle();
  const query = useDocuments(circleId);
  const uploader = useUploadDocument();
  const signer = useSignedDocumentUrl();

  const [notice, setNotice] = useState<string | null>(null);

  const isWriter = activeCircle !== null && canWrite(activeCircle.role);

  const handleUpload = async (source: UploadSource): Promise<void> => {
    setNotice(null);
    const outcome = await uploader.upload({ circleId, source, title: null });

    if (outcome.status === 'rejected') {
      setNotice(uploadRejectionMessage(outcome.rejection));
      return;
    }
    // İptal ve başarı mesaj gerektirmez; vazgeçen kullanıcıya uyarı
    // göstermek onu hata yapmış gibi hissettirirdi.
    setNotice(uploadOutcomeMessage(outcome));
  };

  const handleOpen = async (document: MedicalDocument): Promise<void> => {
    setNotice(null);
    try {
      const url = await signer.mutateAsync(document.objectPath);
      await Linking.openURL(url);
    } catch {
      setNotice('Belge açılamadı. Bağlantını kontrol edip tekrar deneyebilirsin.');
    }
  };

  if (query.isLoading) {
    return (
      <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
        <Skeleton height={theme.spacing.xxl} accessibilityLabel="Belgeler yükleniyor" />
        <Skeleton height={theme.spacing.xxl} />
      </View>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Belgeler alınamadı"
        description="Bağlantını kontrol edip tekrar deneyebilirsin."
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const documents = query.data ?? [];

  return (
    <ScrollView
      contentContainerStyle={{ gap: theme.spacing.lg, padding: theme.spacing.lg }}
      style={{ backgroundColor: theme.colors.surface }}
    >
      <Text accessibilityRole="header" variant="display">
        Belgeler
      </Text>

      <Text tone="inkSoft">
        Fotoğraflar yüklenmeden önce cihazında küçültülür. Belgeler yalnız çember üyelerine, kısa
        ömürlü bir bağlantıyla açılır.
      </Text>

      {notice !== null ? (
        <Card variant="sunk">
          <Text tone="danger" variant="caption" style={{ fontWeight: '700' }}>
            BİLGİ
          </Text>
          <Text>{notice}</Text>
        </Card>
      ) : null}

      {isWriter ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Fotoğraf çek"
              loading={uploader.isPending}
              loadingLabel="Yükleniyor"
              onPress={() => {
                void handleUpload('camera');
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              variant="secondary"
              label="Galeriden seç"
              onPress={() => {
                void handleUpload('library');
              }}
            />
          </View>
        </View>
      ) : null}

      {documents.length === 0 ? (
        <EmptyState
          title="Henüz belge yok"
          description="Reçete, tahlil sonucu veya rapor fotoğrafı ekleyebilirsin."
        />
      ) : (
        documents.map((document) => (
          <Card key={document.id}>
            <View style={{ gap: theme.spacing.xs }}>
              <Text variant="body" style={{ fontWeight: '600' }}>
                {document.title ?? document.originalFilename}
              </Text>
              <Text tone="inkSoft" variant="caption">
                {formatBytes(document.byteSize)}
              </Text>
              <Button
                variant="ghost"
                label="Belgeyi aç"
                onPress={() => {
                  void handleOpen(document);
                }}
              />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}
