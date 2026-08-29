import { CircleError, listCircles } from '../circle-repository';

/**
 * Çember repository testleri.
 *
 * Supabase istemcisi taklit edilir: amaç sunucuyu değil, SINIR davranışını
 * sınamaktır — bozuk yanıt sessizce geçmemeli, hata kodları hassas ayrıntı
 * taşımamalıdır.
 */

const mockResponse = jest.fn();
const mockIsConfigured = jest.fn(() => true);

jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mockIsConfigured();
  },
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            is: () => mockResponse(),
          }),
        }),
      }),
    }),
  }),
}));

const validRow = {
  role: 'caregiver',
  circles: {
    id: '11111111-1111-4111-8111-111111111111',
    care_recipient_name: 'Fatma Demir',
    timezone: 'Europe/Istanbul',
    default_currency: 'TRY',
  },
};

describe('listCircles', () => {
  beforeEach(() => {
    mockResponse.mockReset();
    mockIsConfigured.mockReturnValue(true);
  });

  it('geçerli yanıtı arayüz biçiminde döndürür', async () => {
    // Arrange
    mockResponse.mockResolvedValue({ data: [validRow], error: null });

    // Act
    const circles = await listCircles();

    // Assert
    expect(circles).toEqual([
      {
        id: '11111111-1111-4111-8111-111111111111',
        careRecipientName: 'Fatma Demir',
        timezone: 'Europe/Istanbul',
        defaultCurrency: 'TRY',
        role: 'caregiver',
      },
    ]);
  });

  it('boş listeyi hata saymaz', async () => {
    // Arrange: henüz çemberi olmayan kullanıcı hata değildir.
    mockResponse.mockResolvedValue({ data: [], error: null });

    // Act & Assert
    await expect(listCircles()).resolves.toEqual([]);
  });

  it('şemaya uymayan yanıtı sessizce geçirmez', async () => {
    // Arrange: sunucu bilinmeyen bir rol döndürüyor.
    mockResponse.mockResolvedValue({
      data: [{ ...validRow, role: 'superadmin' }],
      error: null,
    });

    // Act & Assert: yanlış yetki varsaymak yerine sınırda durur.
    await expect(listCircles()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('yetki hatasını kimlik doğrulama koduna çevirir', async () => {
    // Arrange
    mockResponse.mockResolvedValue({ data: null, error: { code: '42501' } });

    // Act & Assert
    await expect(listCircles()).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('ağ istisnasını network koduna çevirir', async () => {
    // Arrange
    mockResponse.mockRejectedValue(new Error('socket hang up'));

    // Act & Assert
    await expect(listCircles()).rejects.toMatchObject({ code: 'network' });
  });

  it('yapılandırma yokken sunucuya gitmeden durur', async () => {
    // Arrange
    mockIsConfigured.mockReturnValue(false);

    // Act & Assert
    await expect(listCircles()).rejects.toMatchObject({ code: 'not_configured' });
    expect(mockResponse).not.toHaveBeenCalled();
  });

  it('hata nesnesi mesajında yalnız kodu taşır', async () => {
    // Arrange: serbest metin bir gün hassas içerik taşır; mesaj kodun kendisidir.
    mockResponse.mockResolvedValue({ data: null, error: { code: '42501' } });

    // Act
    const error = await listCircles().catch((caught: unknown) => caught);

    // Assert
    expect(error).toBeInstanceOf(CircleError);
    expect((error as CircleError).message).toBe('unauthenticated');
  });
});
