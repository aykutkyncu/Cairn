import { Share } from 'react-native';
import { render, userEvent, waitFor } from '@testing-library/react-native';

import { resetAuthStore, useAuthStore } from '@/features/auth';
import { ThemeProvider } from '@/ui';

import CreateCircleScreen from '../(onboarding)/create-circle';
import InviteScreen from '../(onboarding)/invite';

/**
 * Onboarding ekranı testleri.
 *
 * Kritik davranışlar:
 * - Zaman dilimi ÇEMBERE aittir; cihaz saati yalnız başlangıç önerisidir.
 * - Davet bağlantısındaki ham token sunucuya gitmez ve belirli bir mesajlaşma
 *   uygulamasına kesin gönderim vaat edilmez.
 */

const mockCreateCircle = jest.fn();
const mockCreateInvitation = jest.fn();
const mockGenerateToken = jest.fn();

jest.mock('@/features/circles', () => {
  const actual = jest.requireActual('@/features/circles');
  return {
    ...actual,
    // Kurulum artık listeyi geçersizleyen bir mutation hook'undan geçer.
    useCreateCircle: () => ({
      mutateAsync: (input: { name: string; timezone: string }) =>
        mockCreateCircle(input.name, input.timezone),
    }),
  };
});

jest.mock('@/features/auth', () => {
  const actual = jest.requireActual('@/features/auth');
  return {
    ...actual,
    createCircle: (name: string, timezone: string) => mockCreateCircle(name, timezone),
    createInvitation: (circleId: string, token: string) => mockCreateInvitation(circleId, token),
    generateInvitationToken: () => mockGenerateToken(),
  };
});

const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: (path: string) => mockRouterReplace(path), back: jest.fn() },
}));

jest.mock('expo-localization', () => ({
  getCalendars: () => [{ timeZone: 'Europe/Berlin' }],
}));

const CIRCLE_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'abcdefghijkmnpqrstuvwxyz23456789';

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider initialPreference="light">{ui}</ThemeProvider>);

describe('CreateCircleScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthStore();
    mockCreateCircle.mockResolvedValue({ ok: true, data: CIRCLE_ID });
  });

  it('cihaz saat dilimini başlangıç önerisi olarak doldurur', async () => {
    // Arrange & Act
    const { getByLabelText } = await wrap(<CreateCircleScreen />);

    // Assert: öneri, kullanıcının değiştiremeyeceği bir dayatma değildir.
    expect(getByLabelText(/Zaman dilimi/).props.value).toBe('Europe/Berlin');
  });

  it('kendisi için kurarken ad İSTEMEZ', async () => {
    // Tek başına kullanım birinci sınıf yoldur: kendi takibini tutan
    // kişiden "bakılan kişinin adı" istemek anlamsızdır.
    const { queryByLabelText, getByRole } = await wrap(<CreateCircleScreen />);
    const user = userEvent.setup();

    expect(queryByLabelText(/Bakılan kişinin adı/)).toBeNull();
    await user.press(getByRole('button', { name: 'Başla' }));

    expect(mockCreateCircle).toHaveBeenCalledWith('Kendim', expect.any(String));
  });

  it('başkası için kurarken ad boşken kaydetmez', async () => {
    const { getByRole } = await wrap(<CreateCircleScreen />);
    const user = userEvent.setup();

    await user.press(getByRole('radio', { name: 'Başkası için' }));
    await user.press(getByRole('button', { name: 'Başla' }));

    expect(mockCreateCircle).not.toHaveBeenCalled();
  });

  it('kendisi için kurarken paylaşımdan söz etmez', async () => {
    // Karşılığı olmayan bir paylaşım vaadi verilmez.
    const { queryByText } = await wrap(<CreateCircleScreen />);

    expect(queryByText(/görünür/)).toBeNull();
  });

  it('adı ve zaman dilimini kırparak gönderir', async () => {
    // Arrange
    const user = userEvent.setup();
    const { getByLabelText, getByRole } = await wrap(<CreateCircleScreen />);

    // Act
    await user.press(getByRole('radio', { name: 'Başkası için' }));
    await user.type(getByLabelText(/Bakılan kişinin adı/), '  Fatma Demir  ');
    await user.press(getByRole('button', { name: 'Başla' }));

    // Assert
    await waitFor(() => expect(mockCreateCircle).toHaveBeenCalledTimes(1));
    expect(mockCreateCircle).toHaveBeenCalledWith('Fatma Demir', 'Europe/Berlin');
  });

  it('kurulum bitince ekranda kalmaz', async () => {
    // Ekranda kalmak, kullanıcıyı işe yaramış bir düğmeye tekrar bastırırdı.
    const { getByRole } = await wrap(<CreateCircleScreen />);
    const user = userEvent.setup();

    await user.press(getByRole('button', { name: 'Başla' }));

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/'));
  });

  it('başarıda yeni çemberi aktif yapar', async () => {
    // Arrange
    const user = userEvent.setup();
    const { getByLabelText, getByRole } = await wrap(<CreateCircleScreen />);

    // Act
    await user.press(getByRole('radio', { name: 'Başkası için' }));
    await user.type(getByLabelText(/Bakılan kişinin adı/), 'Fatma Demir');
    await user.press(getByRole('button', { name: 'Başla' }));

    // Assert
    await waitFor(() => expect(useAuthStore.getState().activeCircleId).toBe(CIRCLE_ID));
  });

  it('hatayı teknik ayrıntı içermeyen bir cümleye çevirir', async () => {
    // Arrange
    mockCreateCircle.mockResolvedValue({ ok: false, code: 'forbidden' });
    const user = userEvent.setup();
    const { getByLabelText, getByRole, findByText } = await wrap(<CreateCircleScreen />);

    // Act
    await user.press(getByRole('radio', { name: 'Başkası için' }));
    await user.type(getByLabelText(/Bakılan kişinin adı/), 'Fatma Demir');
    await user.press(getByRole('button', { name: 'Başla' }));

    // Assert
    expect(await findByText('Bu işlem için yetkin yok.')).toBeTruthy();
  });
});

describe('InviteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthStore();
    mockGenerateToken.mockResolvedValue(TOKEN);
    mockCreateInvitation.mockResolvedValue({ ok: true, data: CIRCLE_ID });
  });

  it('aktif çember yokken sunucuya gitmez', async () => {
    // Arrange
    const user = userEvent.setup();
    const { getByRole, findByText } = await wrap(<InviteScreen />);

    // Act
    await user.press(getByRole('button', { name: 'Davet bağlantısı oluştur' }));

    // Assert
    expect(await findByText('Bu çembere davet etme yetkin yok.')).toBeTruthy();
    expect(mockCreateInvitation).not.toHaveBeenCalled();
  });

  it('bağlantıyı uygulama şemasıyla üretir', async () => {
    // Arrange
    useAuthStore.getState().setActiveCircleId(CIRCLE_ID);
    const user = userEvent.setup();
    const { getByRole, findByText } = await wrap(<InviteScreen />);

    // Act
    await user.press(getByRole('button', { name: 'Davet bağlantısı oluştur' }));

    // Assert
    expect(await findByText(`cairn://invite/${TOKEN}`)).toBeTruthy();
    expect(mockCreateInvitation).toHaveBeenCalledWith(CIRCLE_ID, TOKEN);
  });

  it('paylaşımda cihazın kendi paylaşım sayfasını kullanır', async () => {
    // Arrange: belirli bir mesajlaşma uygulamasına kesin gönderim vaat edilmez.
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    useAuthStore.getState().setActiveCircleId(CIRCLE_ID);
    const user = userEvent.setup();
    const { getByRole, findByText } = await wrap(<InviteScreen />);

    // Act
    await user.press(getByRole('button', { name: 'Davet bağlantısı oluştur' }));
    await findByText(`cairn://invite/${TOKEN}`);
    await user.press(getByRole('button', { name: 'Paylaş' }));

    // Assert
    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
    expect(String(shareSpy.mock.calls[0]?.[0]?.message)).toContain(`cairn://invite/${TOKEN}`);

    shareSpy.mockRestore();
  });

  it('paylaşım iptal edilirse hata göstermez', async () => {
    // Arrange: kullanıcının vazgeçmesi bir arıza değildir.
    const shareSpy = jest.spyOn(Share, 'share').mockRejectedValue(new Error('cancelled'));
    useAuthStore.getState().setActiveCircleId(CIRCLE_ID);
    const user = userEvent.setup();
    const { getByRole, findByText, queryByText } = await wrap(<InviteScreen />);

    // Act
    await user.press(getByRole('button', { name: 'Davet bağlantısı oluştur' }));
    await findByText(`cairn://invite/${TOKEN}`);
    await user.press(getByRole('button', { name: 'Paylaş' }));

    // Assert
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    expect(queryByText(/Davet oluşturulamadı/)).toBeNull();

    shareSpy.mockRestore();
  });

  it('hız sınırında bekleme mesajı gösterir', async () => {
    // Arrange
    mockCreateInvitation.mockResolvedValue({ ok: false, code: 'rate_limited' });
    useAuthStore.getState().setActiveCircleId(CIRCLE_ID);
    const user = userEvent.setup();
    const { getByRole, findByText } = await wrap(<InviteScreen />);

    // Act
    await user.press(getByRole('button', { name: 'Davet bağlantısı oluştur' }));

    // Assert
    expect(await findByText(/Kısa sürede çok fazla davet oluşturuldu/)).toBeTruthy();
  });
});
