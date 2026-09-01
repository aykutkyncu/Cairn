import { render, userEvent, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import IlacEkleScreen from '../ilac-ekle';

/**
 * İlaç ekleme ekranı testleri.
 *
 * Faz 06 kabul kriteri: **otomatik ilaç hatırlatması yaratılmaz.** Aşağıdaki
 * testler, kayıttan sonra hiçbir görev oluşmadığını ve görev formunun ancak
 * kullanıcının açık onayıyla açıldığını sabitler.
 */

const mockCreateMedication = jest.fn();
const mockMutate = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: (args: unknown) => mockRouterReplace(args),
    back: () => mockRouterBack(),
  },
}));

jest.mock('@/features/circles', () => ({
  CircleGate: ({ children }: { children: (circleId: string) => unknown }) => children('c-1'),
}));

jest.mock('@/features/medical', () => {
  const actual = jest.requireActual('@/features/medical');
  return {
    ...actual,
    useCreateMedication: () => ({
      mutate: (input: unknown, options: { onSuccess: (saved: unknown) => void }) => {
        mockMutate(input);
        mockCreateMedication(input, options);
      },
      isPending: false,
      isError: false,
    }),
  };
});

const renderScreen = () =>
  render(
    <ThemeProvider initialPreference="light">
      <IlacEkleScreen />
    </ThemeProvider>,
  );

describe('IlacEkleScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Varsayılan: sunucu kaydı kabul eder.
    mockCreateMedication.mockImplementation(
      (input: { name: string }, options: { onSuccess: (saved: unknown) => void }) => {
        options.onSuccess({ name: input.name });
      },
    );
  });

  it('ilaç doğruluğu vaadi vermez', async () => {
    const { getByText } = await renderScreen();

    expect(getByText(/ilaç doğruluğunu denetlemez/)).toBeTruthy();
  });

  it('adı boşken kaydetmeye izin vermez', async () => {
    const { getByRole } = await renderScreen();
    const user = userEvent.setup();

    await user.press(getByRole('button', { name: 'İlacı kaydet' }));

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('kaydettikten sonra hatırlatma kurmaz, açıkça sorar', async () => {
    const { getByLabelText, getByRole, getByText } = await renderScreen();
    const user = userEvent.setup();

    await user.type(getByLabelText(/İlacın adı/), 'Metformin');
    await user.press(getByRole('button', { name: 'İlacı kaydet' }));

    // Kayıt yapıldı, fakat hiçbir görev oluşturulmadı ve hiçbir yere
    // yönlendirilmedi: karar kullanıcınındır.
    await waitFor(() => expect(getByText('İlaç kaydedildi')).toBeTruthy());
    expect(getByText(/Hatırlatma kurulmadı/)).toBeTruthy();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('onaylanırsa görev formunu ön dolgu ile açar', async () => {
    const { getByLabelText, getByRole } = await renderScreen();
    const user = userEvent.setup();

    await user.type(getByLabelText(/İlacın adı/), 'Metformin');
    await user.type(getByLabelText(/^Doz/), '500 mg');
    await user.press(getByRole('button', { name: 'İlacı kaydet' }));
    await waitFor(() => expect(getByRole('button', { name: 'Hatırlatma kur' })).toBeTruthy());
    await user.press(getByRole('button', { name: 'Hatırlatma kur' }));

    // Yalnız başlık ve tür taşınır; saat ve tekrar kullanıcıya bırakılır.
    expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: '/gorev-ekle',
      params: { title: 'Metformin · 500 mg', kind: 'medication' },
    });
  });

  it('vazgeçilirse hiçbir görev formu açılmaz', async () => {
    const { getByLabelText, getByRole } = await renderScreen();
    const user = userEvent.setup();

    await user.type(getByLabelText(/İlacın adı/), 'Metformin');
    await user.press(getByRole('button', { name: 'İlacı kaydet' }));
    await waitFor(() => expect(getByRole('button', { name: 'Şimdi değil' })).toBeTruthy());
    await user.press(getByRole('button', { name: 'Şimdi değil' }));

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it('serbest doz metnini olduğu gibi gönderir', async () => {
    const { getByLabelText, getByRole } = await renderScreen();
    const user = userEvent.setup();

    await user.type(getByLabelText(/İlacın adı/), 'Metformin');
    await user.type(getByLabelText(/^Doz/), 'yarım tablet');
    await user.press(getByRole('button', { name: 'İlacı kaydet' }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ dosage: 'yarım tablet', name: 'Metformin' }),
    );
  });
});
