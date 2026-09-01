import { render, userEvent } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import { MedicalFileView } from '../medical-file-view';
import type { HealthRecord, Medication } from '../medical-schema';

/**
 * Tıbbi dosya görünüm testleri.
 *
 * Sınanan davranışlar:
 * - Aktif/geçmiş ilaç ayrımı ÇEMBERİN gününe göre yapılır.
 * - Eksik alan "eklenmedi" diye görünür olur; sessizce boş bırakılmaz.
 * - İzleyici rolünde ekleme çağrısı hiç çizilmez.
 */

const CIRCLE_ID = '11111111-1111-4111-8111-111111111111';

const medication = (overrides: Partial<Medication> = {}): Medication => ({
  id: `${overrides.name ?? 'ilac'}-id`,
  circleId: CIRCLE_ID,
  name: 'Metformin',
  dosage: '500 mg',
  frequencyText: 'Günde iki kez',
  startedOn: '2026-01-01',
  endedOn: null,
  prescribedBy: null,
  notes: null,
  ...overrides,
});

const record = (overrides: Partial<HealthRecord> = {}): HealthRecord => ({
  id: `${overrides.title ?? 'kayit'}-id`,
  circleId: CIRCLE_ID,
  type: 'allergy',
  title: 'Penisilin',
  body: null,
  recordedOn: null,
  createdAt: '2026-02-01T10:00:00+00:00',
  updatedAt: '2026-02-01T10:00:00+00:00',
  createdBy: null,
  revision: 1,
  ...overrides,
});

const renderView = (props: Partial<Parameters<typeof MedicalFileView>[0]> = {}) =>
  render(
    <ThemeProvider initialPreference="light">
      <MedicalFileView
        medications={[]}
        records={[]}
        today="2026-09-01"
        canWrite
        onAddMedication={jest.fn()}
        onAddRecord={jest.fn()}
        onOpenNotes={jest.fn()}
        onOpenDocuments={jest.fn()}
        onOpenSearch={jest.fn()}
        {...props}
      />
    </ThemeProvider>,
  );

describe('MedicalFileView', () => {
  it('başlığı erişilebilir başlık olarak gösterir', async () => {
    const { getByRole } = await renderView();

    expect(getByRole('header', { name: 'Dosya' })).toBeTruthy();
  });

  it('ilaç doğruluğu vaadi vermez', async () => {
    // Sözleşme: uygulama ilaç doğruluğunu garanti etmez.
    const { getByText } = await renderView();

    expect(getByText(/ilaç doğruluğunu denetlemez/)).toBeTruthy();
  });

  it('aktif ilacı listeler', async () => {
    const { getByText } = await renderView({ medications: [medication()] });

    expect(getByText('Metformin')).toBeTruthy();
    expect(getByText('500 mg · Günde iki kez')).toBeTruthy();
  });

  it('eksik doz ve sıklığı "eklenmedi" diye gösterir', async () => {
    // Boş bırakmak, bilginin var olduğu ama gösterilmediği izlenimi verirdi.
    const { getByText } = await renderView({
      medications: [medication({ dosage: null, frequencyText: null })],
    });

    expect(getByText('Doz eklenmedi · Sıklık eklenmedi')).toBeTruthy();
  });

  it('bitiş günü bugün olan ilacı hâlâ kullanılanlar arasında gösterir', async () => {
    const { getByText, queryByText } = await renderView({
      medications: [medication({ endedOn: '2026-09-01' })],
      today: '2026-09-01',
    });

    expect(getByText('Kullandığı ilaçlar')).toBeTruthy();
    expect(queryByText('Geçmiş ilaçlar')).toBeNull();
  });

  it('bitmiş ilacı geçmiş bölümüne ayırır', async () => {
    const { getByText } = await renderView({
      medications: [
        medication({ name: 'Metformin' }),
        medication({ name: 'Amoksisilin', endedOn: '2026-08-01' }),
      ],
      today: '2026-09-01',
    });

    expect(getByText('Geçmiş ilaçlar')).toBeTruthy();
    expect(getByText('Amoksisilin')).toBeTruthy();
  });

  it('kayıt bölümlerini ve sayılarını gösterir', async () => {
    const { getByText } = await renderView({
      records: [record({ title: 'Penisilin' }), record({ title: 'Polen' })],
    });

    expect(getByText('Alerji')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
    expect(getByText('Penisilin')).toBeTruthy();
  });

  it('boş bölümde ekleme çağrısı gösterir', async () => {
    const { getByRole, getByText } = await renderView();

    expect(getByText('Teşhis kaydı eklenmedi.')).toBeTruthy();
    expect(getByRole('button', { name: 'Teşhis ekle' })).toBeTruthy();
  });

  it('izleyici rolünde ekleme düğmesi çizilmez', async () => {
    // Yazma yetkisi RLS'tedir; burada amaç çalışmayacak bir düğme
    // göstermemektir.
    const { queryByRole } = await renderView({ canWrite: false });

    expect(queryByRole('button', { name: 'İlaç ekle' })).toBeNull();
    expect(queryByRole('button', { name: 'Alerji ekle' })).toBeNull();
  });

  it('ilaç ekleme çağrısını iletir', async () => {
    const onAddMedication = jest.fn();
    const { getByRole } = await renderView({ onAddMedication });
    const user = userEvent.setup();

    await user.press(getByRole('button', { name: 'İlaç ekle' }));

    expect(onAddMedication).toHaveBeenCalledTimes(1);
  });

  it('kayıt ekleme çağrısını türüyle birlikte iletir', async () => {
    const onAddRecord = jest.fn();
    const { getByRole } = await renderView({ onAddRecord });
    const user = userEvent.setup();

    await user.press(getByRole('button', { name: 'Doktor ekle' }));

    expect(onAddRecord).toHaveBeenCalledWith('doctor');
  });

  it('bakılan kişinin adını ekrana yazmaz', async () => {
    // Dosya ekranı çember adını taşımaz; o bilgi üst bardadır.
    const { queryByText } = await renderView({ medications: [medication()] });

    expect(queryByText(/İnayet/)).toBeNull();
  });
});
