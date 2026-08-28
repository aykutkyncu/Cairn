import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  EmptyState,
  ErrorState,
  Input,
  Sheet,
  Skeleton,
  Text,
  useTheme,
  useThemePreference,
} from '@/ui';

/**
 * Tasarım sistemi denetim ekranı.
 *
 * Storybook yerine kullanılır. Tüm bileşen varyantlarını açık ve koyu temada,
 * uzun Türkçe metinle gösterir. Cihazın yazı boyutu en büyük ayara alınarak
 * taşma ve kırpılma bu ekranda kontrol edilir.
 */

const LONG_TEXT =
  'Babaannemin sabah ilacını verdikten sonra tansiyonunu ölçtüm, değerler geçen haftaya göre biraz daha düşük görünüyordu; kontrol randevusunda doktora sormak üzere not aldım.';

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text accessibilityRole="header" variant="title">
        {title}
      </Text>
      {children}
      <Divider spacing="md" />
    </View>
  );
}

function Palette() {
  const theme = useTheme();
  const entries = Object.entries(theme.colors);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {entries.map(([name, value]) => (
        <View
          key={name}
          style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md }}
        >
          <View
            style={{
              backgroundColor: value,
              borderColor: theme.colors.rule,
              borderRadius: theme.radius.sm,
              borderWidth: 1,
              height: 28,
              width: 28,
            }}
          />
          <Text variant="mono" tone="inkSoft" style={{ flex: 1 }}>
            {name}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Showcase() {
  const theme = useTheme();
  const { preference, setPreference } = useThemePreference();
  const [checked, setChecked] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [noteText, setNoteText] = useState('');

  return (
    <ScrollView
      contentContainerStyle={{ gap: theme.spacing.lg, padding: theme.spacing.lg }}
      style={{ backgroundColor: theme.colors.surface }}
    >
      <Text variant="display">Tasarım sistemi</Text>
      <Text tone="inkSoft">
        Aktif tema: {theme.name}. Bu ekran üretim yapılandırmasında erişilebilir değildir.
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <Button label="Açık" onPress={() => setPreference('light')} variant="secondary" />
        <Button label="Koyu" onPress={() => setPreference('dark')} variant="secondary" />
        <Button label="Sistem" onPress={() => setPreference('system')} variant="ghost" />
      </View>
      <Text tone="muted" variant="caption">
        Tercih: {preference}
      </Text>

      <Divider spacing="md" />

      <Section title="Tipografi">
        <Text variant="display">Display</Text>
        <Text variant="title">Title - {LONG_TEXT.slice(0, 60)}</Text>
        <Text variant="body">Body - {LONG_TEXT}</Text>
        <Text variant="caption" tone="muted">
          Caption - {LONG_TEXT.slice(0, 90)}
        </Text>
        <Text variant="mono">Mono - occurrence_id 2026-08-28T20:00+03:00</Text>
      </Section>

      <Section title="Renk tokenları">
        <Palette />
      </Section>

      <Section title="Button">
        <Button label="Birincil eylem" onPress={() => undefined} />
        <Button label="İkincil eylem" onPress={() => undefined} variant="secondary" />
        <Button label="Sade eylem" onPress={() => undefined} variant="ghost" />
        <Button label="Çemberi sil" onPress={() => undefined} variant="danger" />
        <Button label="Kaydet" loadingLabel="Kaydediliyor" loading onPress={() => undefined} />
        <Button label="Devre dışı eylem" disabled onPress={() => undefined} />
        <Button
          label="Bu düğmenin etiketi bilinçli olarak çok uzun tutulmuştur ki metin kırpılmasın"
          onPress={() => undefined}
          variant="secondary"
        />
      </Section>

      <Section title="Input">
        <Input label="Bakılan kişinin adı" placeholder="Örnek: Ayşe Yılmaz" required />
        <Input
          label="Not"
          hint="Sağlık notu içeriği olduğu gibi saklanır, temizlenmez."
          multiline
          onChangeText={setNoteText}
          value={noteText}
        />
        <Input label="E-posta" errorMessage="Geçerli bir e-posta adresi gir." value="ornek@" />
        <Input label="Salt okunur alan" editable={false} value="Değiştirilemez" />
      </Section>

      <Section title="Checkbox">
        <Checkbox checked={checked} label="Sabah ilacı verildi" onChange={setChecked} />
        <Checkbox checked={false} label="Akşam yürüyüşü yapıldı" onChange={() => undefined} />
        <Checkbox
          checked
          disabled
          label="Devre dışı seçenek: bu satır uzun bir Türkçe metinle sarmalanmalı ve kırpılmamalıdır"
          onChange={() => undefined}
        />
      </Section>

      <Section title="Card, Avatar, Badge">
        <Card>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md }}>
            <Avatar name="Ayşe Yılmaz" size="lg" />
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Text variant="title">Ayşe Yılmaz</Text>
              <Text tone="inkSoft" variant="caption">
                Bakım veren
              </Text>
            </View>
          </View>
          <Text>{LONG_TEXT}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            <Badge label="Tamamlandı" tone="success" />
            <Badge label="Bekliyor" tone="neutral" />
            <Badge label="Gecikti" tone="warning" />
            <Badge label="Başarısız" tone="danger" />
            <Badge label="Çevrimdışı" tone="accent" />
          </View>
        </Card>
        <Card variant="sunk">
          <Text variant="caption" tone="muted">
            Gömülü yüzey
          </Text>
          <Text>Bu kart gölge yerine zıtlıkla ayrışır.</Text>
        </Card>
      </Section>

      <Section title="Skeleton">
        <Skeleton accessibilityLabel="Görevler yükleniyor" height={22} width="70%" />
        <Skeleton height={16} />
        <Skeleton height={16} width="45%" />
      </Section>

      <Section title="EmptyState">
        <EmptyState
          actionLabel="Görev ekle"
          description="Bugün için planlanmış görev yok. İlk görevi ekleyerek başlayabilirsin."
          onAction={() => undefined}
          title="Bugün sakin görünüyor"
        />
      </Section>

      <Section title="ErrorState">
        <ErrorState
          description="Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar deneyebilirsin."
          onRetry={() => undefined}
          title="Görevler yüklenemedi"
        />
      </Section>

      <Section title="Sheet">
        <Button label="Paneli aç" onPress={() => setSheetVisible(true)} variant="secondary" />
        <Sheet
          onClose={() => setSheetVisible(false)}
          title="Görev ayrıntısı"
          visible={sheetVisible}
        >
          <Text>{LONG_TEXT}</Text>
          <Text>{LONG_TEXT}</Text>
        </Sheet>
      </Section>
    </ScrollView>
  );
}

export default function KitchenSinkScreen() {
  // Tema sağlayıcı kökte kuruludur; buradaki tema düğmeleri uygulamanın
  // tamamındaki tercihi değiştirir, böylece geçiş gerçek koşulda denenir.
  return <Showcase />;
}
