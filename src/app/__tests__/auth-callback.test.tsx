import { render, userEvent, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import AuthCallbackScreen from '../auth/callback';

/**
 * Magic-link dönüş ekranı testleri.
 *
 * Bu ekran native'de akışın son adımıdır: Supabase istemcisi orada
 * `detectSessionInUrl` kapalı çalışır, kodu takas eden başka kimse yoktur.
 *
 * Kritik davranışlar:
 * - Kod yoksa sunucuya hiç gidilmez.
 * - Sunucu bağlantıyı reddettiyse takas denenmez.
 * - Kod hiçbir koşulda ekranda görünmez.
 */

const mockCompleteMagicLink = jest.fn();
const mockParams = jest.fn();
const mockRedirect = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams(),
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
}));

jest.mock('@/features/auth', () => {
  const actual = jest.requireActual('@/features/auth');
  return {
    ...actual,
    completeMagicLink: (code: string) => mockCompleteMagicLink(code),
  };
});

const CODE = 'pkce-code-8f2c1a';

const renderScreen = () =>
  render(
    <ThemeProvider initialPreference="light">
      <AuthCallbackScreen />
    </ThemeProvider>,
  );

describe('AuthCallbackScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams.mockReturnValue({ code: CODE });
    mockCompleteMagicLink.mockResolvedValue({ ok: true, data: null });
  });

  it('koddaki oturumu takas eder ve köke yönlendirir', async () => {
    // Arrange & Act
    await renderScreen();

    // Assert: yönlendirme köke yapılır; nereye gidileceğine oturum durumu
    // karar verir, bu ekran değil.
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith('/'));
    expect(mockCompleteMagicLink).toHaveBeenCalledWith(CODE);
  });

  it('kod yokken sunucuya hiç gitmez', async () => {
    // Arrange
    mockParams.mockReturnValue({});

    // Act
    const { getByText } = await renderScreen();

    // Assert
    expect(mockCompleteMagicLink).not.toHaveBeenCalled();
    expect(getByText(/artık geçerli değil/)).toBeTruthy();
  });

  it('sunucu bağlantıyı reddettiyse takas denemez', async () => {
    // Arrange: Supabase süresi dolmuş bağlantıda `error` parametresi döner.
    mockParams.mockReturnValue({ error: 'access_denied', error_description: 'Email link expired' });

    // Act
    const { getByText } = await renderScreen();

    // Assert
    expect(mockCompleteMagicLink).not.toHaveBeenCalled();
    expect(getByText(/artık geçerli değil/)).toBeTruthy();
    // Sunucunun teknik açıklaması arayüze sızmaz.
    expect(() => getByText(/Email link expired/)).toThrow();
  });

  it('takas başarısızsa kullanıcı dostu mesaj gösterir ve kodu göstermez', async () => {
    // Arrange
    mockCompleteMagicLink.mockResolvedValue({ ok: false, code: 'network' });

    // Act
    const { getByText, queryByText } = await renderScreen();

    // Assert
    await waitFor(() => expect(getByText(/Bağlantı kurulamadı/)).toBeTruthy());
    expect(queryByText(new RegExp(CODE))).toBeNull();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('hata sonrası kullanıcı giriş ekranına dönebilir', async () => {
    // Arrange
    mockCompleteMagicLink.mockResolvedValue({ ok: false, code: 'unknown' });
    const { getByRole } = await renderScreen();
    const user = userEvent.setup();

    // Act
    await waitFor(() => expect(getByRole('button', { name: 'Giriş ekranına dön' })).toBeTruthy());
    await user.press(getByRole('button', { name: 'Giriş ekranına dön' }));

    // Assert
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith('/'));
  });

  it('parametre dizi olarak geldiğinde ilk değeri kullanır', async () => {
    // Expo Router aynı adı iki kez taşıyan bir bağlantıda dizi döndürür.
    mockParams.mockReturnValue({ code: [CODE, 'ikinci'] });

    await renderScreen();

    await waitFor(() => expect(mockCompleteMagicLink).toHaveBeenCalledWith(CODE));
  });

  it('ürün adını erişilebilir başlık olarak gösterir', async () => {
    mockCompleteMagicLink.mockReturnValue(new Promise(() => {}));

    const { getByRole } = await renderScreen();

    expect(getByRole('header', { name: 'Cairn' })).toBeTruthy();
  });
});
