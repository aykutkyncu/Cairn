import { render, waitFor } from '@testing-library/react-native';

import { resetAuthStore, useAuthStore } from '@/features/auth';
import { ThemeProvider } from '@/ui';

import AcceptInviteScreen from '../invite/[token]';

/**
 * Davet kabul ekranı testleri.
 *
 * Kritik davranışlar:
 * - Derin bağlantı parametresi doğrulanmadan sunucuya gitmez.
 * - Oturum yokken kabul denenmez; kullanıcı girişe yönlendirilir.
 * - Hata mesajları teknik ayrıntı ve token içermez.
 */

const mockAcceptInvitation = jest.fn();
const mockParams = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams(),
}));

jest.mock('@/features/auth', () => {
  const actual = jest.requireActual('@/features/auth');
  return {
    ...actual,
    acceptInvitation: (token: string) => mockAcceptInvitation(token),
  };
});

/** Token alfabesine uyan, iyi biçimli bir örnek. */
const VALID_TOKEN = 'abcdefghijkmnpqrstuvwxyz23456789';
const CIRCLE_ID = '11111111-1111-4111-8111-111111111111';

const renderScreen = () =>
  render(
    <ThemeProvider initialPreference="light">
      <AcceptInviteScreen />
    </ThemeProvider>,
  );

describe('AcceptInviteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthStore();
    mockParams.mockReturnValue({ token: VALID_TOKEN });
    mockAcceptInvitation.mockResolvedValue({ ok: true, data: CIRCLE_ID });
  });

  it('bozuk biçimli tokenı sunucuya hiç göndermez', async () => {
    // Arrange: token alfabesinde olmayan karakterler.
    mockParams.mockReturnValue({ token: 'karışık!!token' });
    useAuthStore.setState({
      status: 'signed-in',
      user: { id: 'u-1', email: null, isAnonymous: false },
    });

    // Act
    const { findByText } = await renderScreen();

    // Assert
    expect(await findByText(/Bu davet bağlantısı geçerli değil/)).toBeTruthy();
    expect(mockAcceptInvitation).not.toHaveBeenCalled();
  });

  it('token parametresi hiç yoksa hata gösterir', async () => {
    // Arrange
    mockParams.mockReturnValue({});
    useAuthStore.setState({
      status: 'signed-in',
      user: { id: 'u-1', email: null, isAnonymous: false },
    });

    // Act
    const { findByText } = await renderScreen();

    // Assert
    expect(await findByText(/Bu davet bağlantısı geçerli değil/)).toBeTruthy();
    expect(mockAcceptInvitation).not.toHaveBeenCalled();
  });

  it('oturum yokken kabul denemeden girişe yönlendirir', async () => {
    // Arrange
    useAuthStore.setState({ status: 'signed-out' });

    // Act
    const { findByText } = await renderScreen();

    // Assert
    expect(await findByText('Önce giriş yap')).toBeTruthy();
    expect(mockAcceptInvitation).not.toHaveBeenCalled();
  });

  it('oturum durumu okunurken bekler', async () => {
    // Arrange: 'loading' iken girişe atmak, oturumu olan kullanıcıyı yanıltır.
    useAuthStore.setState({ status: 'loading' });

    // Act
    const { findByText } = await renderScreen();

    // Assert
    expect(await findByText('Davet kontrol ediliyor')).toBeTruthy();
    expect(mockAcceptInvitation).not.toHaveBeenCalled();
  });

  it('başarılı kabulde aktif çemberi ayarlar', async () => {
    // Arrange
    useAuthStore.setState({
      status: 'signed-in',
      user: { id: 'u-1', email: null, isAnonymous: false },
    });

    // Act
    const { findByText } = await renderScreen();

    // Assert
    expect(await findByText('Çembere katıldın')).toBeTruthy();
    await waitFor(() => expect(useAuthStore.getState().activeCircleId).toBe(CIRCLE_ID));
  });

  it('tüketilmiş davette yeni bağlantı istemeyi önerir', async () => {
    // Arrange
    mockAcceptInvitation.mockResolvedValue({ ok: false, code: 'invitation_already_used' });
    useAuthStore.setState({
      status: 'signed-in',
      user: { id: 'u-1', email: null, isAnonymous: false },
    });

    // Act
    const { findByText } = await renderScreen();

    // Assert
    expect(await findByText(/daha önce kullanılmış/)).toBeTruthy();
  });

  it('hata ekranına tokenı yazmaz', async () => {
    // Arrange
    mockAcceptInvitation.mockResolvedValue({ ok: false, code: 'invitation_expired' });
    useAuthStore.setState({
      status: 'signed-in',
      user: { id: 'u-1', email: null, isAnonymous: false },
    });

    // Act
    const { findByText, toJSON } = await renderScreen();
    await findByText(/süresi dolmuş/);

    // Assert
    expect(JSON.stringify(toJSON())).not.toContain(VALID_TOKEN);
  });
});
