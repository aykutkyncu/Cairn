import {
  CLIENT_MAX_BYTES,
  SERVER_MAX_BYTES,
  buildObjectPath,
  checkUploadable,
  documentListSchema,
  extensionForMimeType,
  formatBytes,
  isAllowedMimeType,
  toDocument,
  uploadRejectionMessage,
} from '../document-schema';

/**
 * Belge şeması testleri.
 *
 * En kritik davranış nesne yolundadır: yol YALNIZ çember kimliği, UUID ve
 * uzantı taşır. Orijinal dosya adı ("tahlil-fatma-demir.jpg") yola girseydi,
 * hasta adı imzalı URL üzerinden sızardı.
 */

const CIRCLE_ID = '11111111-1111-4111-8111-111111111111';
const FILE_ID = '22222222-2222-4222-8222-222222222222';

describe('buildObjectPath', () => {
  it('yolu çember kimliği ve UUID ile kurar', () => {
    expect(buildObjectPath(CIRCLE_ID, FILE_ID, 'image/jpeg')).toBe(`${CIRCLE_ID}/${FILE_ID}.jpg`);
  });

  it('yola orijinal dosya adını koymaz', () => {
    // Fonksiyon dosya adını parametre olarak bile almaz; sızma yolu yoktur.
    const path = buildObjectPath(CIRCLE_ID, FILE_ID, 'application/pdf');

    expect(path).toBe(`${CIRCLE_ID}/${FILE_ID}.pdf`);
    expect(path).not.toMatch(/[a-zçğıöşü]{4,}\./i);
  });

  it('yol düzeni Storage politikasının beklediği biçimdedir', () => {
    // `0008_storage.sql` yetkiyi yolun İLK parçasından doğrular.
    const [first] = buildObjectPath(CIRCLE_ID, FILE_ID, 'image/png').split('/');

    expect(first).toBe(CIRCLE_ID);
  });
});

describe('extensionForMimeType', () => {
  it('bilinen türleri eşler', () => {
    expect(extensionForMimeType('image/jpeg')).toBe('jpg');
    expect(extensionForMimeType('image/png')).toBe('png');
    expect(extensionForMimeType('image/webp')).toBe('webp');
    expect(extensionForMimeType('image/heic')).toBe('heic');
    expect(extensionForMimeType('application/pdf')).toBe('pdf');
  });

  it('bilinmeyen türe nötr uzantı verir', () => {
    expect(extensionForMimeType('application/zip')).toBe('bin');
  });
});

describe('isAllowedMimeType', () => {
  it('bucket listesiyle aynı türleri kabul eder', () => {
    expect(isAllowedMimeType('image/jpeg')).toBe(true);
    expect(isAllowedMimeType('application/pdf')).toBe(true);
  });

  it('listede olmayan türü reddeder', () => {
    expect(isAllowedMimeType('application/zip')).toBe(false);
    expect(isAllowedMimeType('text/html')).toBe(false);
  });
});

describe('checkUploadable', () => {
  it('kabul edilen tür ve boyutta sorun bildirmez', () => {
    expect(checkUploadable({ mimeType: 'image/jpeg', byteSize: 1024 })).toBeNull();
  });

  it('desteklenmeyen türü reddeder', () => {
    expect(checkUploadable({ mimeType: 'text/html', byteSize: 10 })).toEqual({
      reason: 'mime_not_allowed',
    });
  });

  it('istemci sınırını aşan dosyayı reddeder', () => {
    const byteSize = CLIENT_MAX_BYTES + 1;

    expect(checkUploadable({ mimeType: 'image/jpeg', byteSize })).toEqual({
      reason: 'too_large',
      byteSize,
    });
  });

  it('istemci sınırı sunucu sınırının altındadır', () => {
    // Sunucu sınırına dayanmak, hatayı yükleme bittikten SONRA göstermek
    // olurdu.
    expect(CLIENT_MAX_BYTES).toBeLessThan(SERVER_MAX_BYTES);
  });
});

describe('uploadRejectionMessage', () => {
  it('teknik ayrıntı içermeyen mesaj verir', () => {
    const message = uploadRejectionMessage({ reason: 'mime_not_allowed' });

    expect(message).toMatch(/Fotoğraf veya PDF/);
    expect(message).not.toMatch(/mime/i);
  });

  it('boyut mesajında gerçek boyutu gösterir', () => {
    expect(uploadRejectionMessage({ reason: 'too_large', byteSize: 6 * 1024 * 1024 })).toMatch(
      /6\.0 MB/,
    );
  });
});

describe('formatBytes', () => {
  it('birimleri okunur biçimde yazar', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('documentListSchema', () => {
  const row = {
    id: '33333333-3333-4333-8333-333333333333',
    circle_id: CIRCLE_ID,
    object_path: `${CIRCLE_ID}/${FILE_ID}.jpg`,
    original_filename: 'tahlil.jpg',
    mime_type: 'image/jpeg',
    byte_size: 120_000,
    title: null,
    created_at: '2026-09-01T18:30:00+00:00',
    created_by: null,
  };

  it('geçerli satırı kabul eder', () => {
    expect(documentListSchema.safeParse([row]).success).toBe(true);
  });

  it('sıfır boyutlu dosyayı kabul etmez', () => {
    expect(documentListSchema.safeParse([{ ...row, byte_size: 0 }]).success).toBe(false);
  });

  it('sunucu sütun adlarını arayüze taşımaz', () => {
    const parsed = documentListSchema.parse([row]);
    const document = toDocument(parsed[0]!);

    expect(document.originalFilename).toBe('tahlil.jpg');
    expect(Object.keys(document)).not.toContain('object_path');
  });
});
