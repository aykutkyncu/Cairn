import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { CircleGate } from '@/features/circles';
import { healthRecordTypeLabel, useHealthRecordSearch } from '@/features/medical';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Skeleton, Text, useTheme } from '@/ui';

/**
 * Tıbbi dosya araması.
 *
 * Sorgu **sunucuya gider**; ekran bunu açıkça yazar. Güvenlik RLS ve
 * `circle_id` koşuluyla sağlanır: yalnız üye olunan çemberin kayıtları
 * döner. "Aramanız cihazınızdan çıkmıyor" demek yanlış bir gizlilik vaadi
 * olurdu.
 *
 * Sorgu metni rota parametresine YAZILMAZ: kullanıcının aradığı şey de
 * sağlık verisidir ve URL'ye girmez.
 */
export default function AraScreen() {
  return <CircleGate>{(circleId) => <SearchContainer circleId={circleId} />}</CircleGate>;
}

function SearchContainer({ circleId }: { readonly circleId: string }) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const trimmed = query.trim();

  const search = useHealthRecordSearch(circleId, query);
  const isTooShort = trimmed.length > 0 && trimmed.length < 2;

  return (
    <ScrollView
      contentContainerStyle={{ gap: theme.spacing.lg, padding: theme.spacing.lg }}
      style={{ backgroundColor: theme.colors.surface }}
    >
      <Text accessibilityRole="header" variant="display">
        Dosyada ara
      </Text>

      <Input
        label="Ara"
        hint="Arama sunucuda yapılır. Yalnız bu çemberin kayıtlarında sonuç bulunur."
        onChangeText={setQuery}
        placeholder="Örneğin: penisilin"
        value={query}
      />

      {isTooShort ? <Text tone="inkSoft">En az iki harf yaz.</Text> : null}

      {trimmed.length >= 2 && search.isLoading ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Skeleton height={theme.spacing.xxl} accessibilityLabel="Sonuçlar aranıyor" />
          <Skeleton height={theme.spacing.xxl} />
        </View>
      ) : null}

      {search.isError ? (
        <ErrorState
          title="Arama yapılamadı"
          description="Bağlantını kontrol edip tekrar deneyebilirsin."
          onRetry={() => {
            void search.refetch();
          }}
        />
      ) : null}

      {trimmed.length >= 2 && !search.isLoading && !search.isError ? (
        <SearchResults
          records={search.data ?? []}
          onOpen={(id) => router.push({ pathname: '/kayit-duzenle', params: { id } })}
        />
      ) : null}
    </ScrollView>
  );
}

function SearchResults({
  records,
  onOpen,
}: {
  readonly records: readonly {
    readonly id: string;
    readonly title: string;
    readonly body: string | null;
    readonly type: Parameters<typeof healthRecordTypeLabel>[0];
  }[];
  readonly onOpen: (id: string) => void;
}) {
  const theme = useTheme();

  if (records.length === 0) {
    return (
      <EmptyState
        title="Sonuç yok"
        description="Başka bir sözcük deneyebilirsin. Arama şimdilik yalnız başlıklarda yapılır."
      />
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {records.map((record) => (
        <Card key={record.id}>
          <View style={{ gap: theme.spacing.xs }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm }}>
              <Text variant="body" style={{ flex: 1, fontWeight: '600' }}>
                {record.title}
              </Text>
              <Badge label={healthRecordTypeLabel(record.type)} tone="neutral" />
            </View>
            {record.body !== null ? (
              <Text tone="inkSoft" variant="caption" numberOfLines={2}>
                {record.body}
              </Text>
            ) : null}
            <Button variant="ghost" label="Kaydı aç" onPress={() => onOpen(record.id)} />
          </View>
        </Card>
      ))}
    </View>
  );
}
