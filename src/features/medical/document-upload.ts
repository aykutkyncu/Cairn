import * as Crypto from 'expo-crypto';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { logger } from '@/lib/logger';

import {
  COMPRESSION_QUALITY,
  TARGET_LONG_EDGE,
  buildObjectPath,
  checkUploadable,
  type UploadRejection,
} from './document-schema';
import {
  createDocumentRecord,
  removeDocumentObject,
  uploadDocumentObject,
} from './document-repository';

/**
 * Belge yükleme akışı.
 *
 * Sıra bilinçlidir ve değiştirilemez:
 *
 * ```
 * 1. kullanıcı kaynağı SEÇER (kamera / galeri)   - kendiliğinden açılmaz
 * 2. görsel CİHAZ ÜZERİNDE küçültülür ve sıkıştırılır
 * 3. sınır denetlenir (tür, boyut)               - sunucuya gitmeden
 * 4. Storage'a yüklenir                          - nesne adı UUID
 * 5. üst veri yazılır                            - orijinal ad ayrı sütunda
 * ```
 *
 * 5. adım başarısız olursa 4. adımda yüklenen nesne SİLİNİR: kimsenin
 * göremeyeceği bir dosyayı depoda bırakmak, silme akışının dışında kalan bir
 * sağlık belgesi bırakmaktır.
 *
 * Küçültme oranı hakkında vaat verilmez: sıkışma görselin içeriğine bağlıdır.
 */

export type UploadSource = 'camera' | 'library';

export type UploadOutcome =
  | { readonly status: 'uploaded'; readonly documentId: string }
  /** Kullanıcı seçimden vazgeçti. Hata değildir, sessizce biter. */
  | { readonly status: 'cancelled' }
  /** İzin verilmedi; kullanıcıya ayarlardan açması söylenir. */
  | { readonly status: 'permission_denied' }
  | { readonly status: 'rejected'; readonly rejection: UploadRejection }
  | { readonly status: 'failed'; readonly code: string };

/** Seçilen dosyanın uygulama için anlamlı özeti. */
type PickedFile = {
  readonly uri: string;
  readonly fileName: string;
  readonly mimeType: string;
};

const DEFAULT_MIME = 'image/jpeg';

/** Kaynak seçimi. İzin istemi kullanıcının dokunuşundan sonra gelir. */
const pick = async (source: UploadSource): Promise<PickedFile | 'cancelled' | 'denied'> => {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) return 'denied';

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    // Sıkıştırmayı biz yapıyoruz; seçicinin kendi kalitesini düşürmesi
    // ikinci bir kayıp katmanı olurdu.
    quality: 1,
    allowsMultipleSelection: false,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled) return 'cancelled';

  const asset = result.assets[0];
  if (asset === undefined) return 'cancelled';

  return {
    uri: asset.uri,
    // Orijinal ad sağlık verisi taşıyabilir ("tahlil-fatma.jpg"); yalnız
    // üst veri sütununda saklanır, dosya yoluna asla girmez.
    fileName: asset.fileName ?? 'belge.jpg',
    mimeType: asset.mimeType ?? DEFAULT_MIME,
  };
};

/** Görseli cihaz üzerinde küçültür ve sıkıştırır. */
const shrink = async (uri: string): Promise<{ uri: string; mimeType: string }> => {
  const result = await manipulateAsync(uri, [{ resize: { width: TARGET_LONG_EDGE } }], {
    compress: COMPRESSION_QUALITY,
    format: SaveFormat.JPEG,
  });

  return { uri: result.uri, mimeType: 'image/jpeg' };
};

/** Dosyayı belleğe okur. Yükleme gövdesi budur. */
const readBytes = async (uri: string): Promise<ArrayBuffer> => {
  const response = await fetch(uri);
  return await response.arrayBuffer();
};

export type UploadDeps = {
  readonly pickFile: typeof pick;
  readonly shrinkImage: typeof shrink;
  readonly readFileBytes: typeof readBytes;
  readonly newId: () => string;
};

const defaultDeps: UploadDeps = {
  pickFile: pick,
  shrinkImage: shrink,
  readFileBytes: readBytes,
  newId: () => Crypto.randomUUID(),
};

/**
 * Belge yükler.
 *
 * Fırlatmaz: her sonuç açıkça döner ve çağıran arayüz hepsini ele almak
 * zorundadır. Yükleme yarıda kesilirse geride yetim nesne bırakılmaz.
 *
 * @param deps Testlerin native modülleri değiştirebilmesi için.
 */
export const uploadDocument = async (
  input: {
    readonly circleId: string;
    readonly source: UploadSource;
    readonly title: string | null;
  },
  deps: Partial<UploadDeps> = {},
): Promise<UploadOutcome> => {
  const { pickFile, shrinkImage, readFileBytes, newId } = { ...defaultDeps, ...deps };

  const picked = await pickFile(input.source);
  if (picked === 'cancelled') return { status: 'cancelled' };
  if (picked === 'denied') return { status: 'permission_denied' };

  let uri = picked.uri;
  let mimeType = picked.mimeType;

  // PDF küçültülmez; yalnız görseller yeniden boyutlandırılır.
  if (mimeType.startsWith('image/')) {
    try {
      const shrunk = await shrinkImage(picked.uri);
      uri = shrunk.uri;
      mimeType = shrunk.mimeType;
    } catch {
      logger.warn('document_shrink_failed');
      return { status: 'failed', code: 'shrink_failed' };
    }
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await readFileBytes(uri);
  } catch {
    return { status: 'failed', code: 'read_failed' };
  }

  // Denetim küçültmeden SONRA yapılır: küçültme denenmeden reddetmek,
  // kullanıcının elindeki tek belgeyi kullanılamaz ilan etmek olurdu.
  const rejection = checkUploadable({ mimeType, byteSize: bytes.byteLength });
  if (rejection !== null) return { status: 'rejected', rejection };

  const objectPath = buildObjectPath(input.circleId, newId(), mimeType);

  try {
    await uploadDocumentObject(objectPath, bytes, mimeType);
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'network';
    return { status: 'failed', code };
  }

  try {
    const document = await createDocumentRecord({
      circleId: input.circleId,
      objectPath,
      originalFilename: picked.fileName,
      mimeType,
      byteSize: bytes.byteLength,
      title: input.title,
    });

    return { status: 'uploaded', documentId: document.id };
  } catch (error) {
    // Üst veri yazılamadı: yüklenen nesne kimsenin göremeyeceği bir yetim
    // olurdu. Temizlenir.
    await removeDocumentObject(objectPath);
    const code = (error as { code?: string }).code ?? 'network';
    return { status: 'failed', code };
  }
};

/** Sonucun kullanıcıya gösterilecek karşılığı. `uploaded` ve `cancelled` mesaj gerektirmez. */
export const uploadOutcomeMessage = (outcome: UploadOutcome): string | null => {
  switch (outcome.status) {
    case 'uploaded':
    case 'cancelled':
      return null;
    case 'permission_denied':
      return 'Fotoğraf izni verilmedi. Telefon ayarlarından izin verip tekrar deneyebilirsin.';
    case 'rejected':
      return null;
    case 'failed':
      return 'Belge yüklenemedi. Bağlantını kontrol edip tekrar deneyebilirsin.';
  }
};
