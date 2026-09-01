import { parseAtBoundary } from '@/lib/boundary';
import { logger } from '@/lib/logger';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

import { documentListSchema, toDocument, type MedicalDocument } from './document-schema';
import { MedicalError } from './medical-repository';

/**
 * Belge veri erişimi: Storage nesnesi + `documents` üst verisi.
 *
 * Bucket **private**'tır. Görüntüleme yalnız kısa ömürlü imzalı URL ile
 * yapılır; kalıcı bir genel adres hiçbir zaman üretilmez.
 *
 * Log satırları dosya adı veya belge başlığı taşımaz: bir tahlil sonucunun
 * adı da sağlık verisidir.
 */

/** Storage bucket adı (`0008_storage.sql`). */
const BUCKET = 'documents';

/**
 * İmzalı URL ömrü: 60 saniye.
 *
 * Kısa tutulur çünkü bu adres, elde edildikten sonra oturumdan bağımsız
 * çalışır: paylaşılan veya loglanan bir URL, süresi dolana dek belgeye
 * erişim demektir. Görüntüleme anında yeniden üretilir.
 */
export const SIGNED_URL_TTL_SECONDS = 60;

/** Çemberin belgelerini getirir. */
export const listDocuments = async (circleId: string): Promise<readonly MedicalDocument[]> => {
  if (!isSupabaseConfigured) throw new MedicalError('not_configured');

  let response: { data: unknown; error: { code?: string } | null };
  try {
    response = await getSupabaseClient()
      .from('documents')
      .select(
        'id, circle_id, object_path, original_filename, mime_type, byte_size, title, created_at, created_by',
      )
      .eq('circle_id', circleId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
  } catch {
    throw new MedicalError('network');
  }

  if (response.error !== null) {
    logger.warn('list_documents_failed', { code: response.error.code ?? '' });
    throw new MedicalError(response.error.code === '42501' ? 'forbidden' : 'network');
  }

  const parsed = parseAtBoundary(
    documentListSchema,
    'document_list',
    'list_documents',
    response.data,
  );
  if (!parsed.ok) throw new MedicalError('invalid_response');

  return parsed.data.map(toDocument);
};

/**
 * Dosyayı Storage'a yükler.
 *
 * `upsert` KAPALIDIR: nesne adı istemcide üretilen bir UUID'dir, çakışma
 * beklenmez. Açık olsaydı, kimliği tahmin eden bir yazma var olan bir
 * belgeyi sessizce değiştirebilirdi.
 */
export const uploadDocumentObject = async (
  objectPath: string,
  body: ArrayBuffer,
  mimeType: string,
): Promise<void> => {
  if (!isSupabaseConfigured) throw new MedicalError('not_configured');

  let error: { readonly statusCode?: string | undefined } | null;
  try {
    const result = await getSupabaseClient()
      .storage.from(BUCKET)
      .upload(objectPath, body, { contentType: mimeType, upsert: false });
    error = result.error;
  } catch {
    throw new MedicalError('network');
  }

  if (error !== null) {
    // Dosya adı değil, yalnız durum kodu loglanır.
    logger.warn('upload_document_failed', { status: error.statusCode ?? '' });
    throw new MedicalError(error.statusCode === '403' ? 'forbidden' : 'network');
  }
};

/**
 * Yüklenmiş nesneyi siler.
 *
 * Yükleme başarılı olup üst veri yazımı başarısız olduğunda çağrılır:
 * kimsenin göremeyeceği bir nesneyi depoda bırakmak, hem yeri işgal eder
 * hem de silme akışının dışında kalır.
 */
export const removeDocumentObject = async (objectPath: string): Promise<void> => {
  if (!isSupabaseConfigured) return;

  try {
    await getSupabaseClient().storage.from(BUCKET).remove([objectPath]);
  } catch {
    // Temizlik başarısızlığı kullanıcının işini engellemez; yalnız not düşülür.
    logger.warn('document_cleanup_failed');
  }
};

export type DocumentMetadataInput = {
  readonly circleId: string;
  readonly objectPath: string;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly title: string | null;
};

/** Belge üst verisini yazar. */
export const createDocumentRecord = async (
  input: DocumentMetadataInput,
): Promise<MedicalDocument> => {
  if (!isSupabaseConfigured) throw new MedicalError('not_configured');

  let response: { data: unknown; error: { code?: string } | null };
  try {
    response = await getSupabaseClient()
      .from('documents')
      .insert({
        circle_id: input.circleId,
        object_path: input.objectPath,
        original_filename: input.originalFilename,
        mime_type: input.mimeType,
        byte_size: input.byteSize,
        title: input.title,
      })
      .select(
        'id, circle_id, object_path, original_filename, mime_type, byte_size, title, created_at, created_by',
      );
  } catch {
    throw new MedicalError('network');
  }

  if (response.error !== null) {
    logger.warn('create_document_failed', { code: response.error.code ?? '' });
    throw new MedicalError(response.error.code === '42501' ? 'forbidden' : 'network');
  }

  const parsed = parseAtBoundary(
    documentListSchema,
    'document_list',
    'create_document',
    response.data,
  );
  const created = parsed.ok ? parsed.data[0] : undefined;
  if (created === undefined) throw new MedicalError('invalid_response');

  logger.info('document_created');
  return toDocument(created);
};

/**
 * Görüntüleme için kısa ömürlü imzalı URL üretir.
 *
 * URL loglanmaz: imzalı adres, süresi dolana kadar belgeye erişimin
 * kendisidir.
 */
export const signedDocumentUrl = async (objectPath: string): Promise<string> => {
  if (!isSupabaseConfigured) throw new MedicalError('not_configured');

  let data: { signedUrl?: string } | null;
  let error: unknown;
  try {
    const result = await getSupabaseClient()
      .storage.from(BUCKET)
      .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);
    data = result.data;
    error = result.error;
  } catch {
    throw new MedicalError('network');
  }

  const url = data?.signedUrl;
  if (error !== null || typeof url !== 'string' || url.length === 0) {
    logger.warn('signed_url_failed');
    throw new MedicalError('forbidden');
  }

  return url;
};
