import { z } from 'zod';

/**
 * Belge şemaları ve yükleme sınırları.
 *
 * Nesne yolu `<circle_id>/<uuid>.<ext>` düzenindedir. Dosya adı olarak UUID
 * kullanılır; **orijinal ad ayrı sütunda** durur. Böylece hasta adı veya
 * teşhis ne dosya yoluna ne de imzalı URL'e sızar.
 */

/** Bucket'ın kabul ettiği türler (`0008_storage.sql` ile aynı liste). */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Sunucu tarafındaki bucket sınırı: 15 MB.
 *
 * Uygulama bunun altında kendi sınırını uygular; sunucu sınırına dayanmak,
 * kullanıcıya hatayı yükleme bittikten sonra göstermek olurdu.
 */
export const SERVER_MAX_BYTES = 15 * 1024 * 1024;

/** Yeniden boyutlandırmadan sonra kabul edilen azami boyut: 4 MB. */
export const CLIENT_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Görselin uzun kenarı bu piksele indirilir.
 *
 * Reçete ve tahlil kâğıdı okunabilir kalmalıdır; 2000 piksel, telefon
 * ekranında yakınlaştırınca metnin seçilebildiği ve dosyanın da makul
 * kaldığı bir orta yoldur. "Her 10 MB görsel 1 MB olur" gibi bir vaat
 * VERİLMEZ: sıkışma oranı görselin içeriğine bağlıdır.
 */
export const TARGET_LONG_EDGE = 2000;

/** JPEG sıkıştırma kalitesi (0-1). */
export const COMPRESSION_QUALITY = 0.7;

export const documentRowSchema = z.object({
  id: z.string().uuid(),
  circle_id: z.string().uuid(),
  object_path: z.string().min(1),
  original_filename: z.string().min(1).max(400),
  mime_type: z.string().min(1),
  byte_size: z.number().int().positive(),
  title: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string().uuid().nullable(),
});

export type DocumentRow = z.infer<typeof documentRowSchema>;
export const documentListSchema = z.array(documentRowSchema);

/** Arayüzün kullandığı belge biçimi. */
export type MedicalDocument = {
  readonly id: string;
  readonly circleId: string;
  /** Storage yolu. Kullanıcıya gösterilmez; imzalı URL üretmek için kullanılır. */
  readonly objectPath: string;
  /** Kullanıcının verdiği ad. Sağlık verisi olabilir; URL'ye yazılmaz. */
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly title: string | null;
  readonly createdAt: string;
  readonly createdBy: string | null;
};

export const toDocument = (row: DocumentRow): MedicalDocument => ({
  id: row.id,
  circleId: row.circle_id,
  objectPath: row.object_path,
  originalFilename: row.original_filename,
  mimeType: row.mime_type,
  byteSize: row.byte_size,
  title: row.title,
  createdAt: row.created_at,
  createdBy: row.created_by,
});

/** Tür kabul ediliyor mu? */
export const isAllowedMimeType = (mimeType: string): mimeType is AllowedMimeType =>
  (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);

/** MIME türünden dosya uzantısı. Yol yalnız UUID + uzantı taşır. */
export const extensionForMimeType = (mimeType: string): string => {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
};

/**
 * Storage nesne yolu üretir: `<circle_id>/<uuid>.<ext>`.
 *
 * Orijinal dosya adı buraya GİRMEZ. "tahlil-sonucu-fatma-demir.jpg" gibi bir
 * ad, imzalı URL üzerinden hasta adını sızdırırdı.
 */
export const buildObjectPath = (circleId: string, fileId: string, mimeType: string): string =>
  `${circleId}/${fileId}.${extensionForMimeType(mimeType)}`;

/** Boyutu insan okunur biçimde yazar. */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export type UploadRejection =
  | { readonly reason: 'mime_not_allowed' }
  | { readonly reason: 'too_large'; readonly byteSize: number };

/**
 * Dosya yüklenebilir mi?
 *
 * Sıkıştırmadan SONRA çağrılır: küçültme denenmeden reddetmek, kullanıcının
 * elindeki tek belgeyi kullanılamaz ilan etmek olurdu.
 */
export const checkUploadable = (file: {
  readonly mimeType: string;
  readonly byteSize: number;
}): UploadRejection | null => {
  if (!isAllowedMimeType(file.mimeType)) return { reason: 'mime_not_allowed' };
  if (file.byteSize > CLIENT_MAX_BYTES) return { reason: 'too_large', byteSize: file.byteSize };
  return null;
};

/** Reddin kullanıcıya gösterilecek karşılığı. */
export const uploadRejectionMessage = (rejection: UploadRejection): string => {
  switch (rejection.reason) {
    case 'mime_not_allowed':
      return 'Bu dosya türü yüklenemiyor. Fotoğraf veya PDF seçebilirsin.';
    case 'too_large':
      return `Dosya küçültüldükten sonra bile çok büyük (${formatBytes(rejection.byteSize)}). Sınır ${formatBytes(CLIENT_MAX_BYTES)}.`;
  }
};
