import { render, userEvent, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import SignInScreen from '../(auth)/sign-in';

/**
 * Giriş ekranı testleri.
 *
 * Kritik davranışlar:
 * - AÇILIŞTA e-posta istenmez: kapıda adres sormak, değeri hiç görmemiş
 *   kullanıcıyı kaybettirir.
 * - Hesabın yalnız bu cihazda olduğu açıkça yazılır.
 * - "Gönderildi" mesajı, e-postanın kayıtlı olup olmadığından BAĞIMSIZDIR;
 *   aksi halde hangi adreslerin sistemde olduğu sızardı.
 */

const mockSendMagicLink = jest.fn();
const mockStartAnonymously = jest.fn();

const mockRedirect = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
}));

jest.mock('@/features/auth', () => {
  const { create } = jest.requireActual<typeof import('zustand')>('zustand');
  const store = create(() => ({ status: 'signed-out' as string }));
  return {
    __store: store,
    useAuthStore: store,
    sendMagicLink: (email: string, redirect: string) => mockSendMagicLink(email, redirect),
    startAnonymously: () => mockStartAnonymously(),
    // Test ortamı native platform olarak koşar; dönüş adresi uygulama şemasıdır.
    authRedirectUrl: () => 'cairn://auth/callback',
  };
});

/** Taklit edilen oturum deposu. */
const authStore = (
  jest.requireMock('@/features/auth') as { __store: { setState: (s: unknown) => void } }
).__store;

const renderScreen = () =>
  render(
    <ThemeProvider initialPreference="light">
      <SignInScreen />
    </ThemeProvider>,
  );

/** E-posta adımına geçer: açılışta e-posta alanı GÖRÜNMEZ. */
const goToEmailStep = async (screen: Awaited<ReturnType<typeof renderScreen>>) => {
  const user = userEvent.setup();
  await user.press(screen.getByRole('button', { name: 'E-postamla gir' }));
  await waitFor(() => expect(screen.getByLabelText(/E-posta/)).toBeTruthy());
  return user;
};

/** E-postayı yazıp bağlantıyı gönderir. */
const sendLink = async (screen: Awaited<ReturnType<typeof renderScreen>>) => {
  const user = await goToEmailStep(screen);
  await user.type(screen.getByLabelText(/E-posta/), 'ornek@eposta.com');
  await user.press(screen.getByRole('button', { name: 'Giriş kodu gönder' }));
  return user;
};

describe('SignInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMagicLink.mockResolvedValue({ ok: true, data: null });
    mockStartAnonymously.mockResolvedValue({ ok: true, data: null });
    authStore.setState({ status: 'signed-out' });
  });

  it('oturum açıldığında ekranda kalmaz', async () => {
    // Hesapsız başlangıçta oturum BU ekranda açılır; yönlendirme olmazsa
    // kullanıcı işe yaramış bir düğmeye tekrar tekrar basardı.
    authStore.setState({ status: 'signed-in' });

    await renderScreen();

    expect(mockRedirect).toHaveBeenCalledWith('/');
  });

  it('ürün adını erişilebilir başlık olarak gösterir', async () => {
    const { getByRole } = await renderScreen();

    expect(getByRole('header', { name: 'Cairn' })).toBeTruthy();
  });

  it('açılışta e-posta İSTEMEZ', async () => {
    // Kapıda adres sormak, değeri hiç görmemiş kullanıcıyı kaybettirir.
    const { queryByLabelText, getByRole } = await renderScreen();

    // "E-postamla gir" düğmesi görünür; asıl mesele GİRDİ alanının olmaması.
    expect(queryByLabelText('E-posta, zorunlu')).toBeNull();
    expect(getByRole('button', { name: 'Hemen başla' })).toBeTruthy();
  });

  it('başlamadan önce veri sınırını ve tıbbi sınırı yazar', async () => {
    const { getByText } = await renderScreen();

    expect(getByText(/paylaşmayı sen seçmedikçe kimse göremez/)).toBeTruthy();
    expect(getByText(/tıbbi tavsiye vermez/)).toBeTruthy();
  });

  it('hesabın cihaza bağlı olduğunu açıkça söyler', async () => {
    // Kurtarma yolu olmayan bir hesap, kullanıcıya sessizce verilemez.
    const { getByText } = await renderScreen();

    expect(getByText(/yalnız bu cihazdadır/)).toBeTruthy();
    expect(getByText(/geri getirilemez/)).toBeTruthy();
  });

  it('hesapsız başlatır', async () => {
    const { getByRole } = await renderScreen();
    const user = userEvent.setup();

    await user.press(getByRole('button', { name: 'Hemen başla' }));

    expect(mockStartAnonymously).toHaveBeenCalledTimes(1);
    expect(mockSendMagicLink).not.toHaveBeenCalled();
  });

  it('hesapsız başlatma başarısızsa hatayı gösterir', async () => {
    // Anonim giriş Supabase panelinde kapalıysa kullanıcı sebepsiz bir
    // boşlukla karşılaşmamalıdır.
    mockStartAnonymously.mockResolvedValue({ ok: false, code: 'unknown' });
    const { getByRole, findByText } = await renderScreen();
    const user = userEvent.setup();

    await user.press(getByRole('button', { name: 'Hemen başla' }));

    expect(await findByText(/Beklenmeyen bir sorun/)).toBeTruthy();
  });

  it('e-posta yolundan hesapsız başlangıca dönebilir', async () => {
    const screen = await renderScreen();
    const user = await goToEmailStep(screen);

    await user.press(screen.getByRole('button', { name: 'Vazgeç, hesapsız başla' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Hemen başla' })).toBeTruthy());
  });

  it('geçersiz e-posta ile gönderim yapmaz', async () => {
    const screen = await renderScreen();
    const user = await goToEmailStep(screen);

    await user.type(screen.getByLabelText(/E-posta/), 'ornek');
    await user.press(screen.getByRole('button', { name: 'Giriş kodu gönder' }));

    expect(mockSendMagicLink).not.toHaveBeenCalled();
  });

  it('bağlantıyı gönderir ve gönderildiğini söyler', async () => {
    const screen = await renderScreen();
    await sendLink(screen);

    expect(mockSendMagicLink).toHaveBeenCalledWith('ornek@eposta.com', 'cairn://auth/callback');
    await waitFor(() => expect(screen.getByText('GÖNDERİLDİ')).toBeTruthy());
  });

  it('gönderim hatasında gönderildi demez', async () => {
    mockSendMagicLink.mockResolvedValue({ ok: false, code: 'network' });
    const screen = await renderScreen();
    const user = await goToEmailStep(screen);
    const { getByLabelText, getByRole, findByText, queryByText } = screen;

    await user.type(getByLabelText(/E-posta/), 'ornek@eposta.com');
    await user.press(getByRole('button', { name: 'Giriş kodu gönder' }));

    await findByText(/Bağlantı kurulamadı/);
    // "Gönderildi" demek, gönderilmemiş bir bağlantıyı beklettirirdi.
    expect(queryByText('GÖNDERİLDİ')).toBeNull();
  });

  it('hata mesajı teknik ayrıntı ve e-posta içermez', async () => {
    mockSendMagicLink.mockResolvedValue({ ok: false, code: 'rate_limited' });
    const screen = await renderScreen();
    const user = await goToEmailStep(screen);
    const { getByLabelText, getByRole, findByText, queryByText } = screen;

    await user.type(getByLabelText(/E-posta/), 'ornek@eposta.com');
    await user.press(getByRole('button', { name: 'Giriş kodu gönder' }));

    await findByText(/Çok fazla deneme/);
    expect(queryByText(/rate_limited/)).toBeNull();
    expect(queryByText(/429/)).toBeNull();
  });
});
