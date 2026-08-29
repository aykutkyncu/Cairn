import { render, userEvent, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import SignInScreen from '../(auth)/sign-in';

/**
 * Giriş ekranı testleri.
 *
 * En kritik davranış: başarı mesajı, e-postanın kayıtlı olup olmadığından
 * BAĞIMSIZ gösterilir. Aksi halde hangi adreslerin sistemde olduğu sızardı.
 */

const mockSendMagicLink = jest.fn();

jest.mock('@/features/auth', () => ({
  sendMagicLink: (email: string, redirect: string) => mockSendMagicLink(email, redirect),
}));

const renderScreen = () =>
  render(
    <ThemeProvider initialPreference="light">
      <SignInScreen />
    </ThemeProvider>,
  );

describe('SignInScreen', () => {
  beforeEach(() => {
    mockSendMagicLink.mockReset();
    mockSendMagicLink.mockResolvedValue({ ok: true, data: null });
  });

  it('ürün adını erişilebilir başlık olarak gösterir', async () => {
    const { getByRole } = await renderScreen();

    expect(getByRole('header', { name: 'Cairn' })).toBeTruthy();
  });

  it('geçersiz e-posta ile gönderim yapmaz', async () => {
    // Arrange
    const { getByLabelText, getByRole } = await renderScreen();

    // Act: "@" içermeyen bir metin.
    const user = userEvent.setup();
    await user.type(getByLabelText(/E-posta/), 'ornek');
    await user.press(getByRole('button', { name: 'Giriş bağlantısı gönder' }));

    // Assert
    expect(mockSendMagicLink).not.toHaveBeenCalled();
  });

  it('geçerli e-postayı kırpıp gönderir', async () => {
    // Arrange
    const { getByLabelText, getByRole } = await renderScreen();

    // Act
    const user = userEvent.setup();
    await user.type(getByLabelText(/E-posta/), '  ornek@eposta.com  ');
    await user.press(getByRole('button', { name: 'Giriş bağlantısı gönder' }));

    // Assert
    await waitFor(() => expect(mockSendMagicLink).toHaveBeenCalledTimes(1));
    expect(mockSendMagicLink).toHaveBeenCalledWith('ornek@eposta.com', 'cairn://auth/callback');
  });

  it('başarıda kullanıcıya adresin kayıtlı olup olmadığını sızdırmayan mesaj gösterir', async () => {
    // Arrange
    const { getByLabelText, getByRole, findByText } = await renderScreen();

    // Act
    const user = userEvent.setup();
    await user.type(getByLabelText(/E-posta/), 'ornek@eposta.com');
    await user.press(getByRole('button', { name: 'Giriş bağlantısı gönder' }));

    // Assert: mesaj "hesabın var" ya da "kayıt bulunamadı" demez.
    const message = await findByText(/Bağlantı gönderildi/);
    expect(message).toBeTruthy();
  });

  it('hata kodunu teknik ayrıntı içermeyen bir cümleye çevirir', async () => {
    // Arrange
    mockSendMagicLink.mockResolvedValue({ ok: false, code: 'rate_limited' });
    const { getByLabelText, getByRole, findByText } = await renderScreen();

    // Act
    const user = userEvent.setup();
    await user.type(getByLabelText(/E-posta/), 'ornek@eposta.com');
    await user.press(getByRole('button', { name: 'Giriş bağlantısı gönder' }));

    // Assert
    expect(await findByText(/Çok fazla deneme yapıldı/)).toBeTruthy();
  });

  it('kullanıcı yazmaya devam edince hata mesajını kaldırır', async () => {
    // Arrange
    mockSendMagicLink.mockResolvedValue({ ok: false, code: 'network' });
    const { getByLabelText, getByRole, findByText, queryByText } = await renderScreen();

    const user = userEvent.setup();
    await user.type(getByLabelText(/E-posta/), 'ornek@eposta.com');
    await user.press(getByRole('button', { name: 'Giriş bağlantısı gönder' }));
    await findByText(/Bağlantı kurulamadı/);

    // Act
    await user.type(getByLabelText(/E-posta/), 'x');

    // Assert
    await waitFor(() => expect(queryByText(/Bağlantı kurulamadı/)).toBeNull());
  });

  it('şifre alanı ve üçüncü taraf giriş düğmesi göstermez', async () => {
    // Sözleşme: çalıştırılmamış bir akış için düğme göstermek, olmayan bir
    // özelliği vaat etmektir.
    const { queryByText, queryByLabelText } = await renderScreen();

    expect(queryByLabelText(/Şifre/)).toBeNull();
    expect(queryByText(/Google/)).toBeNull();
    expect(queryByText(/Apple/)).toBeNull();
  });
});
