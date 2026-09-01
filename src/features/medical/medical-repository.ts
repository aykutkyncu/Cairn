import { parseAtBoundary } from '@/lib/boundary';
import { logger } from '@/lib/logger';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

import {
  healthRecordListSchema,
  medicationListSchema,
  toHealthRecord,
  toMedication,
  type HealthRecord,
  type HealthRecordType,
  type Medication,
} from './medical-schema';

/**
 * Tıbbi dosya veri erişimi.
 *
 * Katman sırası: ekran → hook → repository → Supabase. Ekranlar bu modülü de
 * doğrudan çağırmaz.
 *
 * Filtreler güvenlik için değildir; güvenlik RLS'tedir. `circle_id` koşulu
 * yalnız ilgisiz çemberleri listeden çıkarır — bir üye olmadığın çemberin
 * satırını sunucu zaten döndürmez.
 *
 * Hiçbir log satırı ilaç adı, teşhis başlığı veya not gövdesi taşımaz;
 * yalnız işlem adı ve Postgres hata kodu yazılır.
 */

export type MedicalErrorCode =
  'not_configured' | 'unauthenticated' | 'forbidden' | 'invalid_response' | 'conflict' | 'network';

/** Repository hatası. Serbest metin taşımaz; mesaj kodun kendisidir. */
export class MedicalError extends Error {
  readonly code: MedicalErrorCode;

  constructor(code: MedicalErrorCode) {
    super(code);
    this.name = 'MedicalError';
    this.code = code;
  }
}

/** Postgres yetersiz yetki kodu. RLS reddi buraya düşer. */
const INSUFFICIENT_PRIVILEGE = '42501';

const toMedicalError = (error: { readonly code?: string } | null): MedicalError => {
  if (error?.code === INSUFFICIENT_PRIVILEGE) return new MedicalError('forbidden');
  return new MedicalError('network');
};

const MEDICATION_COLUMNS =
  'id, circle_id, name, dosage, frequency_text, started_on, ended_on, prescribed_by, notes';

const HEALTH_RECORD_COLUMNS =
  'id, circle_id, record_type, title, body, recorded_on, created_at, updated_at, created_by, revision';

/** Çemberin ilaç kayıtlarını getirir (aktif/geçmiş ayrımı arayüzde yapılır). */
export const listMedications = async (circleId: string): Promise<readonly Medication[]> => {
  if (!isSupabaseConfigured) throw new MedicalError('not_configured');

  let response: { data: unknown; error: { code?: string } | null };
  try {
    response = await getSupabaseClient()
      .from('medications')
      .select(MEDICATION_COLUMNS)
      .eq('circle_id', circleId)
      .is('deleted_at', null)
      .order('name');
  } catch {
    throw new MedicalError('network');
  }

  if (response.error !== null) {
    logger.warn('list_medications_failed', { code: response.error.code ?? '' });
    throw toMedicalError(response.error);
  }

  const parsed = parseAtBoundary(
    medicationListSchema,
    'medication_list',
    'list_medications',
    response.data,
  );
  if (!parsed.ok) throw new MedicalError('invalid_response');

  return parsed.data.map(toMedication);
};

/**
 * Çemberin sağlık kayıtlarını getirir.
 *
 * @param types Getirilecek türler. Boş bırakılmaz: her ekran yalnız kendi
 *   türünü ister, böylece bir alerji ekranı yanlışlıkla notları çekmez.
 */
export const listHealthRecords = async (
  circleId: string,
  types: readonly HealthRecordType[],
): Promise<readonly HealthRecord[]> => {
  if (!isSupabaseConfigured) throw new MedicalError('not_configured');
  // Boş tür listesi "hepsi" demek DEĞİLDİR; çağıranın hatasıdır ve sunucuya
  // gitmeden boş sonuç döner.
  if (types.length === 0) return [];

  let response: { data: unknown; error: { code?: string } | null };
  try {
    response = await getSupabaseClient()
      .from('health_records')
      .select(HEALTH_RECORD_COLUMNS)
      .eq('circle_id', circleId)
      .in('record_type', [...types])
      .is('deleted_at', null)
      .order('recorded_on', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
  } catch {
    throw new MedicalError('network');
  }

  if (response.error !== null) {
    logger.warn('list_health_records_failed', { code: response.error.code ?? '' });
    throw toMedicalError(response.error);
  }

  const parsed = parseAtBoundary(
    healthRecordListSchema,
    'health_record_list',
    'list_health_records',
    response.data,
  );
  if (!parsed.ok) throw new MedicalError('invalid_response');

  return parsed.data.map(toHealthRecord);
};

/**
 * Sağlık kaydı araması.
 *
 * Sorgu **sunucuya gider**; güvenlik RLS ve `circle_id` koşuluyla sağlanır.
 * "Aramanız cihazınızdan çıkmıyor" gibi bir gizlilik vaadi verilmez — bu
 * doğru olmazdı.
 *
 * Arama metni `%` ve `_` içerebilir; bunlar PostgREST `ilike` kalıbında
 * joker anlamına gelir ve kaçırılır. Kaçırılmazsa kullanıcının yazdığı
 * düz metin beklenmedik satırlar döndürürdü.
 */
export const searchHealthRecords = async (
  circleId: string,
  query: string,
): Promise<readonly HealthRecord[]> => {
  if (!isSupabaseConfigured) throw new MedicalError('not_configured');

  const trimmed = query.trim();
  // Tek harflik bir sorgu neredeyse tüm dosyayı döndürür; sunucuya gitmeye
  // değmez ve kullanıcıya da yardımcı olmaz.
  if (trimmed.length < 2) return [];

  const pattern = `%${trimmed.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

  let response: { data: unknown; error: { code?: string } | null };
  try {
    response = await getSupabaseClient()
      .from('health_records')
      .select(HEALTH_RECORD_COLUMNS)
      .eq('circle_id', circleId)
      .is('deleted_at', null)
      .ilike('title', pattern)
      .order('created_at', { ascending: false })
      .limit(50);
  } catch {
    throw new MedicalError('network');
  }

  if (response.error !== null) {
    // Sorgu metni loglanmaz: kullanıcının aradığı şey de sağlık verisidir.
    logger.warn('search_health_records_failed', { code: response.error.code ?? '' });
    throw toMedicalError(response.error);
  }

  const parsed = parseAtBoundary(
    healthRecordListSchema,
    'health_record_list',
    'search_health_records',
    response.data,
  );
  if (!parsed.ok) throw new MedicalError('invalid_response');

  return parsed.data.map(toHealthRecord);
};

/** Yeni ilaç kaydı. Sunucu sütun adları çağırana sızmaz. */
export type MedicationInput = {
  readonly circleId: string;
  readonly name: string;
  readonly dosage: string | null;
  readonly frequencyText: string | null;
  readonly startedOn: string | null;
  readonly endedOn: string | null;
  readonly prescribedBy: string | null;
  readonly notes: string | null;
};

/**
 * İlaç kaydı oluşturur.
 *
 * Kayıt **hatırlatma üretmez**. Görev oluşturucu yalnız kullanıcının açık
 * onayıyla ve önceden doldurulmuş biçimde açılır; bunu çağıran arayüz yapar.
 */
export const createMedication = async (input: MedicationInput): Promise<Medication> => {
  if (!isSupabaseConfigured) throw new MedicalError('not_configured');

  let response: { data: unknown; error: { code?: string } | null };
  try {
    response = await getSupabaseClient()
      .from('medications')
      .insert({
        circle_id: input.circleId,
        name: input.name,
        dosage: input.dosage,
        frequency_text: input.frequencyText,
        started_on: input.startedOn,
        ended_on: input.endedOn,
        prescribed_by: input.prescribedBy,
        notes: input.notes,
      })
      .select(MEDICATION_COLUMNS);
  } catch {
    throw new MedicalError('network');
  }

  if (response.error !== null) {
    logger.warn('create_medication_failed', { code: response.error.code ?? '' });
    throw toMedicalError(response.error);
  }

  const parsed = parseAtBoundary(
    medicationListSchema,
    'medication_list',
    'create_medication',
    response.data,
  );
  const created = parsed.ok ? parsed.data[0] : undefined;
  if (created === undefined) throw new MedicalError('invalid_response');

  logger.info('medication_created');
  return toMedication(created);
};

/**
 * Tek bir sağlık kaydını getirir.
 *
 * Düzenleme ekranı kaydı KİMLİĞİYLE ister. Başlık ve gövdeyi rota
 * parametresiyle taşımak, sağlık verisini URL'ye yazmak olurdu — sözleşme
 * bunu yasaklar.
 */
export const getHealthRecord = async (id: string): Promise<HealthRecord | null> => {
  if (!isSupabaseConfigured) throw new MedicalError('not_configured');

  let response: { data: unknown; error: { code?: string } | null };
  try {
    response = await getSupabaseClient()
      .from('health_records')
      .select(HEALTH_RECORD_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null);
  } catch {
    throw new MedicalError('network');
  }

  if (response.error !== null) {
    logger.warn('get_health_record_failed', { code: response.error.code ?? '' });
    throw toMedicalError(response.error);
  }

  const parsed = parseAtBoundary(
    healthRecordListSchema,
    'health_record_list',
    'get_health_record',
    response.data,
  );
  if (!parsed.ok) throw new MedicalError('invalid_response');

  const row = parsed.data[0];
  // Kayıt yok: silinmiş olabilir ya da bu çemberin üyesi değilsindir. İkisi
  // de aynı sonucu verir; hangisi olduğunu söylemek bilgi sızdırırdı.
  return row === undefined ? null : toHealthRecord(row);
};

/**
 * Sağlık kaydı güncelleme girdisi.
 *
 * `baseRevision`, düzenlemeye başlarken okunan sürümdür. Sunucudaki sürüm
 * bundan farklıysa yazma REDDEDİLİR.
 */
export type HealthRecordUpdate = {
  readonly id: string;
  readonly baseRevision: number;
  readonly title: string;
  readonly body: string | null;
  readonly recordedOn: string | null;
};

/**
 * Sağlık kaydını günceller.
 *
 * Sözleşme: **sessiz son-yazan-kazan, sağlık metninde yasaktır.** Bu yüzden
 * güncelleme `revision = baseRevision` koşuluyla yapılır. Aradan başka biri
 * yazdıysa koşul tutmaz, hiçbir satır güncellenmez ve `conflict` döner —
 * çağıran taraf kullanıcıya durumu göstermek zorundadır.
 *
 * `revision` ve `updated_at` gönderilmez: ikisini de sunucu trigger'ı yazar.
 * İstemcinin gönderdiği sürüm numarasına güvenmek, çakışma denetimini
 * istemcinin eline bırakmak olurdu.
 */
export const updateHealthRecord = async (input: HealthRecordUpdate): Promise<HealthRecord> => {
  if (!isSupabaseConfigured) throw new MedicalError('not_configured');

  let response: { data: unknown; error: { code?: string } | null };
  try {
    response = await getSupabaseClient()
      .from('health_records')
      .update({
        title: input.title,
        body: input.body,
        recorded_on: input.recordedOn,
      })
      .eq('id', input.id)
      .eq('revision', input.baseRevision)
      .is('deleted_at', null)
      .select(HEALTH_RECORD_COLUMNS);
  } catch {
    throw new MedicalError('network');
  }

  if (response.error !== null) {
    logger.warn('update_health_record_failed', { code: response.error.code ?? '' });
    throw toMedicalError(response.error);
  }

  const parsed = parseAtBoundary(
    healthRecordListSchema,
    'health_record_list',
    'update_health_record',
    response.data,
  );
  if (!parsed.ok) throw new MedicalError('invalid_response');

  const updated = parsed.data[0];
  if (updated === undefined) {
    // Boş sonuç iki şeyi birden anlatabilir: kayıt silinmiş ya da BAŞKASI
    // güncellemiş. İkisinde de kullanıcının yazdığını sessizce üzerine
    // yazmak yasaktır; çakışma olarak bildirilir.
    logger.info('health_record_conflict');
    throw new MedicalError('conflict');
  }

  logger.info('health_record_updated');
  return toHealthRecord(updated);
};

/** Yeni sağlık kaydı. */
export type HealthRecordInput = {
  readonly circleId: string;
  readonly type: HealthRecordType;
  readonly title: string;
  readonly body: string | null;
  readonly recordedOn: string | null;
};

/**
 * Sağlık kaydı oluşturur.
 *
 * Gövde metnine genel amaçlı temizleme UYGULANMAZ: sözleşme, sağlık
 * notunun içeriğini bozacak temizlemeyi yasaklar. Metin ham saklanır ve
 * çıktı tarafında HTML olarak işlenmez.
 */
export const createHealthRecord = async (input: HealthRecordInput): Promise<HealthRecord> => {
  if (!isSupabaseConfigured) throw new MedicalError('not_configured');

  let response: { data: unknown; error: { code?: string } | null };
  try {
    response = await getSupabaseClient()
      .from('health_records')
      .insert({
        circle_id: input.circleId,
        record_type: input.type,
        title: input.title,
        body: input.body,
        recorded_on: input.recordedOn,
      })
      .select(HEALTH_RECORD_COLUMNS);
  } catch {
    throw new MedicalError('network');
  }

  if (response.error !== null) {
    logger.warn('create_health_record_failed', { code: response.error.code ?? '' });
    throw toMedicalError(response.error);
  }

  const parsed = parseAtBoundary(
    healthRecordListSchema,
    'health_record_list',
    'create_health_record',
    response.data,
  );
  const created = parsed.ok ? parsed.data[0] : undefined;
  if (created === undefined) throw new MedicalError('invalid_response');

  logger.info('health_record_created', { type: input.type });
  return toHealthRecord(created);
};
