import { render, userEvent, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import SignInScreen from '../(auth)/sign-in';

/**
 * Giriş ekranı testleri.
 *
 * Kritik davranışlar:
 * - Kod adımına geçiş, e-postanın kayıtlı olup olmadığından BAĞIMSIZDIR;
 *   aksi halde hangi adreslerin sistemde olduğu sızardı.
 * - Yanlış koddan sonra kod alanı ekranda KALIR: kullanıcı yeniden
 *   yazacağı yeri kaybetmemelidir.
 * - E-posta istenmeden önce ne olduğu ve ne olmadığı yazılıdır.
 */

const mockSendMagicLink = jest.fn();
const mockVerifyEmailCode = jest.fn();

jest.mock('@/features/auth', () => ({
  sendMagicLink: (email: string, redirect: string) => mockSendMagicLink(email, redirect),
  verifyEmailCode: (email: string, code: string) => mockVerifyEmailCode(email, code),
  // Test ortamı native platform olarak koşar; dönüş adresi uygulama şemasıdır.
  authRedirectUrl: () => 'cairn://auth/callback',
}));

const renderScreen = () =>
  render(
    <ThemeProvider initialPreference="light">
      <SignInScreen />
    </ThemeProvider>,
  );

/** E-postayı yazıp kod adımına geçer. */
const goToCodeStep = async (screen: Awaited<ReturnType<typeof renderScreen>>) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/E-posta/), 'ornek@eposta.com');
  await user.press(screen.getByRole('button', { name: 'Giriş kodu gönder' }));
  await waitFor(() => expect(screen.getByLabelText(/6 haneli kod/)).toBeTruthy());
  return user;
};

describe('SignInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMagicLink.mockResolvedValue({ ok: true, data: null });
    mockVerifyEmailCode.mockResolvedValue({ ok: true, data: null });
  });

  it('ürün adını erişilebilir başlık olarak gösterir', async () => {
    const { getByRole } = await renderScreen();

    expect(getByRole('header', { name: 'Cairn' })).toBeTruthy();
  });

  it('e-posta istemeden önce veri sınırını ve tıbbi sınırı yazar', async () => {
    // Sağlık verisi tutacak bir uygulamaya adres vermeden önce kullanıcı
    // neyin nerede durduğunu bilmelidir.
    const { getByText } = await renderScreen();

    expect(getByText(/yalnız kurduğun çemberin üyelerine açıktır/)).toBeTruthy();
    expect(getByText(/tıbbi tavsiye vermez/)).toBeTruthy();
  });

  it('geçersiz e-posta ile gönderim yapmaz', async () => {
    const { getByLabelText, getByRole } = await renderScreen();
    const user = userEvent.setup();

    await user.type(getByLabelText(/E-posta/), 'ornek');
    await user.press(getByRole('button', { name: 'Giriş kodu gönder' }));

    expect(mockSendMagicLink).not.toHaveBeenCalled();
  });

  it('kod gönderir ve kod adımına geçer', async () => {
    const screen = await renderScreen();
    await goToCodeStep(screen);

    expect(mockSendMagicLink).toHaveBeenCalledWith('ornek@eposta.com', 'cairn://auth/callback');
    expect(screen.getByRole('button', { name: 'Giriş yap' })).toBeTruthy();
  });

  it('bağlantı yolunun da açık olduğunu söyler', async () => {
    // Kod birincil, bağlantı yedektir; kullanıcı ikisini de bilmelidir.
    const screen = await renderScreen();
    await goToCodeStep(screen);

    expect(screen.getByText(/bağlantıya dokunarak da/)).toBeTruthy();
  });

  it('eksik kodu sunucuya göndermez', async () => {
    const screen = await renderScreen();
    const user = await goToCodeStep(screen);

    await user.type(screen.getByLabelText(/6 haneli kod/), '123');
    await user.press(screen.getByRole('button', { name: 'Giriş yap' }));

    expect(mockVerifyEmailCode).not.toHaveBeenCalled();
  });

  it('altı haneli kodu doğrulamaya gönderir', async () => {
    const screen = await renderScreen();
    const user = await goToCodeStep(screen);

    await user.type(screen.getByLabelText(/6 haneli kod/), '123456');
    await user.press(screen.getByRole('button', { name: 'Giriş yap' }));

    expect(mockVerifyEmailCode).toHaveBeenCalledWith('ornek@eposta.com', '123456');
  });

  it('yanlış kodda kod alanı ekranda kalır', async () => {
    // Alan kaybolsaydı kullanıcı yeniden yazacağı yeri bulamazdı.
    mockVerifyEmailCode.mockResolvedValue({ ok: false, code: 'unauthenticated' });
    const screen = await renderScreen();
    const user = await goToCodeStep(screen);

    await user.type(screen.getByLabelText(/6 haneli kod/), '000000');
    await user.press(screen.getByRole('button', { name: 'Giriş yap' }));

    await waitFor(() => expect(screen.getByText(/Kod yanlış veya süresi dolmuş/)).toBeTruthy());
    expect(screen.getByLabelText(/6 haneli kod/)).toBeTruthy();
  });

  it('kodu tekrar gönderebilir', async () => {
    const screen = await renderScreen();
    const user = await goToCodeStep(screen);

    await user.press(screen.getByRole('button', { name: 'Kodu tekrar gönder' }));

    expect(mockSendMagicLink).toHaveBeenCalledTimes(2);
  });

  it('gönderim hatasında kod adımına geçmez', async () => {
    mockSendMagicLink.mockResolvedValue({ ok: false, code: 'network' });
    const { getByLabelText, getByRole, findByText, queryByLabelText } = await renderScreen();
    const user = userEvent.setup();

    await user.type(getByLabelText(/E-posta/), 'ornek@eposta.com');
    await user.press(getByRole('button', { name: 'Giriş kodu gönder' }));

    await findByText(/Bağlantı kurulamadı/);
    expect(queryByLabelText(/6 haneli kod/)).toBeNull();
  });

  it('hata mesajı teknik ayrıntı ve e-posta içermez', async () => {
    mockSendMagicLink.mockResolvedValue({ ok: false, code: 'rate_limited' });
    const { getByLabelText, getByRole, findByText, queryByText } = await renderScreen();
    const user = userEvent.setup();

    await user.type(getByLabelText(/E-posta/), 'ornek@eposta.com');
    await user.press(getByRole('button', { name: 'Giriş kodu gönder' }));

    await findByText(/Çok fazla deneme/);
    expect(queryByText(/rate_limited/)).toBeNull();
    expect(queryByText(/429/)).toBeNull();
  });
});
