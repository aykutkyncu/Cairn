import { CLIENT_MAX_BYTES } from '../document-schema';
import { uploadDocument, uploadOutcomeMessage } from '../document-upload';

/**
 * Belge yükleme akışı testleri.
 *
 * Faz 06 kabul kriterleri:
 * - Büyük görsel için çıktı boyutu sınırı, iptal ve hata davranışı test edilir.
 * - Yükleme kullanıcının açık seçimiyle başlar.
 *
 * Ayrıca sabitlenen davranış: üst veri yazımı başarısız olursa yüklenen nesne
 * SİLİNİR. Yoksa depoda kimsenin göremeyeceği, silme akışının dışında kalan
 * bir sağlık belgesi kalırdı.
 */

const mockUploadObject = jest.fn();
const mockCreateRecord = jest.fn();
const mockRemoveObject = jest.fn();

jest.mock('../document-repository', () => ({
  uploadDocumentObject: (path: string, body: unknown, mime: string) =>
    mockUploadObject(path, body, mime),
  createDocumentRecord: (input: unknown) => mockCreateRecord(input),
  removeDocumentObject: (path: string) => mockRemoveObject(path),
}));

// Native modüller testte çalışmaz; akışın kendisi sınanır.
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }));

const CIRCLE_ID = '11111111-1111-4111-8111-111111111111';
const FILE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const picked = {
  uri: 'file:///tmp/ham.jpg',
  fileName: 'tahlil-sonucu-fatma-demir.jpg',
  mimeType: 'image/jpeg',
};

/** Verilen boyutta sahte dosya içeriği. */
const bytes = (size: number): ArrayBuffer => new ArrayBuffer(size);

const deps = (overrides: Record<string, unknown> = {}) => ({
  pickFile: jest.fn().mockResolvedValue(picked),
  shrinkImage: jest
    .fn()
    .mockResolvedValue({ uri: 'file:///tmp/kucuk.jpg', mimeType: 'image/jpeg' }),
  readFileBytes: jest.fn().mockResolvedValue(bytes(200_000)),
  newId: () => FILE_ID,
  ...overrides,
});

const input = { circleId: CIRCLE_ID, source: 'library' as const, title: null };

describe('uploadDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadObject.mockResolvedValue(undefined);
    mockCreateRecord.mockResolvedValue({ id: 'doc-1' });
  });

  it('seçilen görseli küçültüp yükler ve üst veriyi yazar', async () => {
    const d = deps();

    const outcome = await uploadDocument(input, d);

    expect(outcome).toEqual({ status: 'uploaded', documentId: 'doc-1' });
    expect(d.shrinkImage).toHaveBeenCalledWith(picked.uri);
    // Küçültülmüş dosya okunur, ham dosya değil.
    expect(d.readFileBytes).toHaveBeenCalledWith('file:///tmp/kucuk.jpg');
  });

  it('nesne yoluna orijinal dosya adını yazmaz', async () => {
    await uploadDocument(input, deps());

    const [objectPath] = mockUploadObject.mock.calls[0] as [string];
    expect(objectPath).toBe(`${CIRCLE_ID}/${FILE_ID}.jpg`);
    expect(objectPath).not.toContain('fatma');
  });

  it('orijinal adı yalnız üst veriye yazar', async () => {
    await uploadDocument(input, deps());

    expect(mockCreateRecord).toHaveBeenCalledWith(
      expect.objectContaining({ originalFilename: picked.fileName }),
    );
  });

  it('kullanıcı vazgeçtiğinde hiçbir şey yüklemez', async () => {
    const outcome = await uploadDocument(
      input,
      deps({ pickFile: jest.fn().mockResolvedValue('cancelled') }),
    );

    expect(outcome).toEqual({ status: 'cancelled' });
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it('izin verilmediğinde sunucuya gitmez', async () => {
    const outcome = await uploadDocument(
      input,
      deps({ pickFile: jest.fn().mockResolvedValue('denied') }),
    );

    expect(outcome).toEqual({ status: 'permission_denied' });
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it('küçültmeden sonra hâlâ büyük dosyayı reddeder', async () => {
    // Denetim küçültmeden SONRA yapılır: küçültme denenmeden reddetmek,
    // kullanıcının elindeki tek belgeyi kullanılamaz ilan etmek olurdu.
    const d = deps({
      readFileBytes: jest.fn().mockResolvedValue(bytes(CLIENT_MAX_BYTES + 1)),
    });

    const outcome = await uploadDocument(input, d);

    expect(outcome).toMatchObject({ status: 'rejected' });
    expect(d.shrinkImage).toHaveBeenCalled();
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it('desteklenmeyen türü yüklemez', async () => {
    const d = deps({
      pickFile: jest.fn().mockResolvedValue({ ...picked, mimeType: 'application/zip' }),
    });

    const outcome = await uploadDocument(input, d);

    expect(outcome).toMatchObject({ status: 'rejected' });
    // Görsel olmadığı için küçültme de denenmez.
    expect(d.shrinkImage).not.toHaveBeenCalled();
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it('PDF küçültmeye sokulmaz', async () => {
    const d = deps({
      pickFile: jest.fn().mockResolvedValue({ ...picked, mimeType: 'application/pdf' }),
    });

    const outcome = await uploadDocument(input, d);

    expect(outcome.status).toBe('uploaded');
    expect(d.shrinkImage).not.toHaveBeenCalled();
  });

  it('üst veri yazılamazsa yüklenen nesneyi siler', async () => {
    // Yoksa depoda kimsenin göremeyeceği, silme akışının dışında kalan bir
    // sağlık belgesi kalırdı.
    mockCreateRecord.mockRejectedValue({ code: 'forbidden' });

    const outcome = await uploadDocument(input, deps());

    expect(outcome).toEqual({ status: 'failed', code: 'forbidden' });
    expect(mockRemoveObject).toHaveBeenCalledWith(`${CIRCLE_ID}/${FILE_ID}.jpg`);
  });

  it('yükleme başarısızsa temizlik denemez', async () => {
    // Yüklenmemiş bir nesneyi silmeye çalışmak gereksiz bir istektir.
    mockUploadObject.mockRejectedValue({ code: 'network' });

    const outcome = await uploadDocument(input, deps());

    expect(outcome).toEqual({ status: 'failed', code: 'network' });
    expect(mockRemoveObject).not.toHaveBeenCalled();
  });

  it('küçültme hatasında ham dosyayı yüklemez', async () => {
    // Ham dosya sunucu sınırını aşabilir ve gereksiz veri taşırdı.
    const d = deps({ shrinkImage: jest.fn().mockRejectedValue(new Error('decode')) });

    const outcome = await uploadDocument(input, d);

    expect(outcome).toEqual({ status: 'failed', code: 'shrink_failed' });
    expect(mockUploadObject).not.toHaveBeenCalled();
  });
});

describe('uploadOutcomeMessage', () => {
  it('başarı ve iptalde mesaj göstermez', () => {
    // Vazgeçen kullanıcıya uyarı göstermek, onu hata yapmış gibi
    // hissettirirdi.
    expect(uploadOutcomeMessage({ status: 'uploaded', documentId: 'd' })).toBeNull();
    expect(uploadOutcomeMessage({ status: 'cancelled' })).toBeNull();
  });

  it('izin reddinde ne yapılacağını söyler', () => {
    expect(uploadOutcomeMessage({ status: 'permission_denied' })).toMatch(/ayarlarından/);
  });

  it('hata mesajında teknik kod göstermez', () => {
    const message = uploadOutcomeMessage({ status: 'failed', code: 'network' });

    expect(message).not.toBeNull();
    expect(message).not.toMatch(/network/);
  });
});
