import { render, userEvent, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import KayitDuzenleScreen from '../kayit-duzenle';

/**
 * Kayıt düzenleme ekranı testleri.
 *
 * Sözleşme maddesi: **sessiz son-yazan-kazan sağlık metninde yasaktır.**
 * Aşağıdaki testler, çakışmanın kullanıcıya gösterildiğini ve düzenlemeye
 * başlanan sürümün sunucuya iletildiğini sabitler.
 *
 * İkinci kritik davranış: rota yalnız KİMLİK taşır. Başlık ve gövde
 * parametreyle taşınsaydı sağlık verisi URL'ye yazılmış olurdu.
 */

const mockParams = jest.fn();
const mockUseHealthRecord = jest.fn();
const mockMutate = jest.fn();
const mockUpdateState = jest.fn();
const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams(),
  router: { push: jest.fn(), replace: jest.fn(), back: () => mockRouterBack() },
}));

jest.mock('@/features/circles', () => ({
  CircleGate: ({ children }: { children: (circleId: string) => unknown }) => children('c-1'),
}));

jest.mock('@/features/medical', () => {
  const actual = jest.requireActual('@/features/medical');
  return {
    ...actual,
    useHealthRecord: () => mockUseHealthRecord(),
    useUpdateHealthRecord: () => ({
      mutate: (input: unknown, options: { onSuccess: () => void }) => {
        mockMutate(input, options);
      },
      ...mockUpdateState(),
    }),
  };
});

const RECORD_ID = '33333333-3333-4333-8333-333333333333';

const record = {
  id: RECORD_ID,
  circleId: '11111111-1111-4111-8111-111111111111',
  type: 'note' as const,
  title: 'Kontrol notu',
  body: 'Tansiyon 140/90',
  recordedOn: null,
  createdAt: '2026-09-01T18:30:00+00:00',
  updatedAt: '2026-09-01T18:30:00+00:00',
  createdBy: null,
  revision: 2,
};

const renderScreen = () =>
  render(
    <ThemeProvider initialPreference="light">
      <KayitDuzenleScreen />
    </ThemeProvider>,
  );

describe('KayitDuzenleScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams.mockReturnValue({ id: RECORD_ID });
    mockUseHealthRecord.mockReturnValue({
      data: record,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    mockUpdateState.mockReturnValue({ isPending: false, isError: false, error: null });
  });

  it('kaydın metnini sunucudan okur, parametreden değil', async () => {
    // Rota yalnız kimlik taşır; başlık ve gövde URL'ye yazılmaz.
    const { getByDisplayValue } = await renderScreen();

    expect(mockParams).toHaveBeenCalled();
    expect(getByDisplayValue('Kontrol notu')).toBeTruthy();
    expect(getByDisplayValue('Tansiyon 140/90')).toBeTruthy();
  });

  it('kimlik yoksa hata gösterir ve sunucuya gitmez', async () => {
    mockParams.mockReturnValue({});

    const { getByText } = await renderScreen();

    expect(getByText('Kayıt bulunamadı')).toBeTruthy();
  });

  it('kayıt silinmişse uydurma içerik göstermez', async () => {
    mockUseHealthRecord.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    const { getByText } = await renderScreen();

    expect(getByText(/silinmiş olabilir/)).toBeTruthy();
  });

  it('düzenlemeye başlanan sürümü gönderir', async () => {
    const { getByLabelText, getByRole } = await renderScreen();
    const user = userEvent.setup();

    await user.clear(getByLabelText(/Başlık/));
    await user.type(getByLabelText(/Başlık/), 'Yeni başlık');
    await user.press(getByRole('button', { name: 'Değişikliği kaydet' }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: RECORD_ID, baseRevision: 2, title: 'Yeni başlık' }),
      expect.anything(),
    );
  });

  it('çakışmayı kullanıcıya gösterir ve yazdığını gönderilmiş saymaz', async () => {
    mockUpdateState.mockReturnValue({
      isPending: false,
      isError: true,
      error: { code: 'conflict' },
    });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('ÇAKIŞMA')).toBeTruthy());
    expect(getByText(/başka biri değiştirdi/)).toBeTruthy();
    expect(getByText(/gönderilmedi/)).toBeTruthy();
  });

  it('çakışma dışındaki hatada teknik ayrıntı göstermez', async () => {
    mockUpdateState.mockReturnValue({
      isPending: false,
      isError: true,
      error: { code: 'network' },
    });

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('HATA')).toBeTruthy();
    expect(queryByText(/network/)).toBeNull();
  });

  it('boş başlıkla kaydetmeye izin vermez', async () => {
    const { getByLabelText, getByRole } = await renderScreen();
    const user = userEvent.setup();

    await user.clear(getByLabelText(/Başlık/));
    await user.press(getByRole('button', { name: 'Değişikliği kaydet' }));

    expect(mockMutate).not.toHaveBeenCalled();
  });
});
