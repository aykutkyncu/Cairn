import { render, userEvent } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import { NotesView, formatRecordDate } from '../notes-view';
import type { HealthRecord } from '../medical-schema';

/**
 * Notlar görünümü testleri.
 *
 * Sınanan davranışlar:
 * - Randevu soruları ile notlar ayrı bölümlerdedir.
 * - Düzenlenmiş not, düzenlendiği belli olacak biçimde işaretlenir.
 * - İzleyici rolünde düzenleme ve ekleme çağrısı çizilmez.
 */

const CIRCLE_ID = '11111111-1111-4111-8111-111111111111';

const record = (overrides: Partial<HealthRecord> = {}): HealthRecord => ({
  id: `${overrides.title ?? 'kayit'}-id`,
  circleId: CIRCLE_ID,
  type: 'note',
  title: 'Kontrol notu',
  body: 'Tansiyon 140/90 ölçüldü',
  recordedOn: null,
  createdAt: '2026-09-01T18:30:00+00:00',
  updatedAt: '2026-09-01T18:30:00+00:00',
  createdBy: null,
  revision: 1,
  ...overrides,
});

const renderView = (props: Partial<Parameters<typeof NotesView>[0]> = {}) =>
  render(
    <ThemeProvider initialPreference="light">
      <NotesView
        notes={[]}
        questions={[]}
        canWrite
        onAddNote={jest.fn()}
        onAddQuestion={jest.fn()}
        onEdit={jest.fn()}
        authorName={() => null}
        {...props}
      />
    </ThemeProvider>,
  );

describe('formatRecordDate', () => {
  it('ISO tarihi gün.ay.yıl biçimine çevirir', () => {
    expect(formatRecordDate('2026-09-01T18:30:00+00:00')).toBe('01.09.2026');
    expect(formatRecordDate('2026-09-01')).toBe('01.09.2026');
  });

  it('tanımadığı biçimi bozmadan döndürür', () => {
    expect(formatRecordDate('bilinmeyen')).toBe('bilinmeyen');
  });
});

describe('NotesView', () => {
  it('notları ve soruları ayrı bölümlerde gösterir', async () => {
    // Randevu öncesi "sormayı unutma" listesi, günlük notların arasında
    // kaybolduğunda işe yaramaz.
    const { getAllByText, getByText } = await renderView({
      notes: [record({ title: 'Kontrol notu' })],
      questions: [record({ title: 'Dozu artıralım mı?', type: 'question' })],
    });

    expect(getByText('Randevu öncesi sorular')).toBeTruthy();
    expect(getByText('Dozu artıralım mı?')).toBeTruthy();
    // "Notlar" hem ekran başlığı hem bölüm başlığıdır; ikisi de beklenir.
    expect(getAllByText('Notlar')).toHaveLength(2);
    expect(getByText('Kontrol notu')).toBeTruthy();
  });

  it('boş bölümlerde çağrı gösterir', async () => {
    const { getByRole, getByText } = await renderView();

    expect(getByText('Henüz not yok.')).toBeTruthy();
    expect(getByRole('button', { name: 'Not ekle' })).toBeTruthy();
    expect(getByRole('button', { name: 'Soru ekle' })).toBeTruthy();
  });

  it('düzenlenmiş notu işaretler', async () => {
    // Kullanıcı, okuduğu metnin ilk hali olmadığını bilmelidir.
    const { getByText } = await renderView({ notes: [record({ revision: 3 })] });

    expect(getByText('düzenlendi')).toBeTruthy();
  });

  it('ilk sürümde düzenlendi etiketi göstermez', async () => {
    const { queryByText } = await renderView({ notes: [record({ revision: 1 })] });

    expect(queryByText('düzenlendi')).toBeNull();
  });

  it('tarihi gösterir, yazar bilinmiyorsa uydurmaz', async () => {
    const { getByText, queryByText } = await renderView({ notes: [record()] });

    expect(getByText('01.09.2026')).toBeTruthy();
    expect(queryByText(/·/)).toBeNull();
  });

  it('yazar biliniyorsa tarihle birlikte gösterir', async () => {
    const { getByText } = await renderView({
      notes: [record({ createdBy: 'u-1' })],
      authorName: () => 'Ayşe',
    });

    expect(getByText('01.09.2026 · Ayşe')).toBeTruthy();
  });

  it('izleyici rolünde ekleme ve düzenleme çizilmez', async () => {
    const { queryByRole } = await renderView({ canWrite: false, notes: [record()] });

    expect(queryByRole('button', { name: 'Not ekle' })).toBeNull();
    expect(queryByRole('button', { name: 'Düzenle' })).toBeNull();
  });

  it('düzenleme çağrısını kaydın kendisiyle iletir', async () => {
    const onEdit = jest.fn();
    const target = record();
    const { getByRole } = await renderView({ notes: [target], onEdit });
    const user = userEvent.setup();

    await user.press(getByRole('button', { name: 'Düzenle' }));

    expect(onEdit).toHaveBeenCalledWith(target);
  });
});
