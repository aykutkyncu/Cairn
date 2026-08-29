import {
  acceptInvitation,
  createCircle,
  createInvitation,
  sendMagicLink,
  signOut,
} from '../auth-repository';

/**
 * Kimlik ve üyelik repository testleri.
 *
 * Sınanan davranışlar:
 * - Sunucu hatası hassas ayrıntı taşımayan bir koda indirgenir.
 * - Ham davet tokenı sunucuya GİTMEZ; yalnız hash'i gider.
 * - Yapılandırma yokken sunucuya hiç gidilmez.
 * - Çıkış, sunucu adımı başarısız olsa bile yerel temizliği yapar.
 */

const mockSignInWithOtp = jest.fn();
const mockServerSignOut = jest.fn();
const mockRpc = jest.fn();
const mockResetClient = jest.fn();
const mockIsConfigured = jest.fn(() => true);

jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mockIsConfigured();
  },
  resetSupabaseClient: () => mockResetClient(),
  getSupabaseClient: () => ({
    auth: {
      signInWithOtp: (args: unknown) => mockSignInWithOtp(args),
      signOut: () => mockServerSignOut(),
    },
    rpc: (name: string, args: unknown) => mockRpc(name, args),
  }),
}));

// expo-crypto native modüldür; testte deterministik bir SHA-256 taklidi
// kullanılır. Amaç hash algoritmasını değil, HAM TOKENIN sunucuya
// gitmediğini kanıtlamaktır.
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: jest.fn().mockResolvedValue('a'.repeat(64)),
}));

const mockClearArtifacts = jest.fn();

jest.mock('../session-cleanup', () => ({
  clearSessionArtifacts: () => mockClearArtifacts(),
}));

const CIRCLE_ID = '11111111-1111-4111-8111-111111111111';

/** Token alfabesine uyan, iyi biçimli bir örnek. */
const PLAIN_TOKEN = 'abcdefghijkmnpqrstuvwxyz23456789';

describe('auth-repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConfigured.mockReturnValue(true);
    mockClearArtifacts.mockResolvedValue({ failedSteps: 0 });
  });

  describe('sendMagicLink', () => {
    it('yapılandırma yokken sunucuya gitmez', async () => {
      mockIsConfigured.mockReturnValue(false);

      await expect(sendMagicLink('a@b.com', 'cairn://x')).resolves.toEqual({
        ok: false,
        code: 'not_configured',
      });
      expect(mockSignInWithOtp).not.toHaveBeenCalled();
    });

    it('e-posta ve yönlendirme adresini iletir', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });

      const result = await sendMagicLink('a@b.com', 'cairn://auth/callback');

      expect(result).toEqual({ ok: true, data: null });
      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        email: 'a@b.com',
        options: { emailRedirectTo: 'cairn://auth/callback' },
      });
    });

    it('hız sınırı hatasını rate_limited koduna çevirir', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: { code: '53400', status: 429 } });

      await expect(sendMagicLink('a@b.com', 'cairn://x')).resolves.toEqual({
        ok: false,
        code: 'rate_limited',
      });
    });

    it('ağ istisnasını network koduna çevirir', async () => {
      mockSignInWithOtp.mockRejectedValue(new Error('socket hang up'));

      await expect(sendMagicLink('a@b.com', 'cairn://x')).resolves.toEqual({
        ok: false,
        code: 'network',
      });
    });
  });

  describe('createCircle', () => {
    it('atomik RPC ile çember kurar', async () => {
      mockRpc.mockResolvedValue({ data: CIRCLE_ID, error: null });

      const result = await createCircle('Fatma Demir', 'Europe/Istanbul');

      expect(result).toEqual({ ok: true, data: CIRCLE_ID });
      expect(mockRpc).toHaveBeenCalledWith('create_circle_with_owner', {
        care_recipient_name: 'Fatma Demir',
        circle_timezone: 'Europe/Istanbul',
      });
    });

    it('uuid olmayan yanıtı kabul etmez', async () => {
      mockRpc.mockResolvedValue({ data: 'uuid-değil', error: null });

      await expect(createCircle('Fatma', 'Europe/Istanbul')).resolves.toEqual({
        ok: false,
        code: 'unknown',
      });
    });

    it('yetki hatasını forbidden koduna çevirir', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { code: '42501' } });

      await expect(createCircle('Fatma', 'Europe/Istanbul')).resolves.toEqual({
        ok: false,
        code: 'forbidden',
      });
    });
  });

  describe('createInvitation', () => {
    it('sunucuya ham tokenı değil yalnız hash gönderir', async () => {
      // Arrange
      mockRpc.mockResolvedValue({ data: CIRCLE_ID, error: null });

      // Act
      await createInvitation(CIRCLE_ID, PLAIN_TOKEN, 'caregiver');

      // Assert: gönderilen yükün hiçbir yerinde ham token bulunmaz.
      const payload = JSON.stringify(mockRpc.mock.calls[0]);
      expect(payload).not.toContain(PLAIN_TOKEN);
      expect(mockRpc).toHaveBeenCalledWith(
        'create_circle_invitation',
        expect.objectContaining({ target_circle_id: CIRCLE_ID, invited_role: 'caregiver' }),
      );
    });

    it('rolü verilmezse bakım veren olarak davet eder', async () => {
      mockRpc.mockResolvedValue({ data: CIRCLE_ID, error: null });

      await createInvitation(CIRCLE_ID, PLAIN_TOKEN);

      expect(mockRpc.mock.calls[0]?.[1]).toMatchObject({ invited_role: 'caregiver' });
    });
  });

  describe('acceptInvitation', () => {
    it('sunucuya ham tokenı göndermez', async () => {
      mockRpc.mockResolvedValue({ data: CIRCLE_ID, error: null });

      await acceptInvitation(PLAIN_TOKEN);

      expect(JSON.stringify(mockRpc.mock.calls[0])).not.toContain(PLAIN_TOKEN);
    });

    it('tüketilmiş daveti ayrı bir kodla bildirir', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { hint: 'invitation_already_used' } });

      await expect(acceptInvitation(PLAIN_TOKEN)).resolves.toEqual({
        ok: false,
        code: 'invitation_already_used',
      });
    });

    it('süresi dolmuş daveti ayrı bir kodla bildirir', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { hint: 'invitation_expired' } });

      await expect(acceptInvitation(PLAIN_TOKEN)).resolves.toEqual({
        ok: false,
        code: 'invitation_expired',
      });
    });

    it('başarıda çember kimliğini döndürür', async () => {
      mockRpc.mockResolvedValue({ data: CIRCLE_ID, error: null });

      await expect(acceptInvitation(PLAIN_TOKEN)).resolves.toEqual({
        ok: true,
        data: CIRCLE_ID,
      });
    });
  });

  describe('signOut', () => {
    it('sunucu çıkışı başarısız olsa bile yerel temizliği yapar', async () => {
      // Arrange: cihazda kalan token, sunucudaki oturumdan daha büyük risktir.
      mockServerSignOut.mockResolvedValue({ error: { message: 'offline' } });

      // Act
      const result = await signOut();

      // Assert
      expect(mockClearArtifacts).toHaveBeenCalledTimes(1);
      expect(mockResetClient).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ ok: true, data: { failedSteps: 1 } });
    });

    it('sunucu çıkışı istisna atsa bile yerel temizliği yapar', async () => {
      mockServerSignOut.mockRejectedValue(new Error('network down'));

      const result = await signOut();

      expect(mockClearArtifacts).toHaveBeenCalledTimes(1);
      expect(result.ok).toBe(true);
    });

    it('yapılandırma yokken bile yerel temizliği yapar', async () => {
      mockIsConfigured.mockReturnValue(false);

      await signOut();

      expect(mockServerSignOut).not.toHaveBeenCalled();
      expect(mockClearArtifacts).toHaveBeenCalledTimes(1);
      expect(mockResetClient).toHaveBeenCalledTimes(1);
    });

    it('başarılı çıkışta hatasız tamamlanır', async () => {
      mockServerSignOut.mockResolvedValue({ error: null });

      await expect(signOut()).resolves.toEqual({ ok: true, data: { failedSteps: 0 } });
    });
  });
});
