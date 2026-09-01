import { z } from 'zod';

/**
 * Tıbbi dosya şemaları.
 *
 * Sunucudan gelen her satır kullanıldığı sınırda doğrulanır. Şema, tabloda
 * var olan her sütunu değil, arayüzün gerçekten kullandığı alanları
 * tanımlar: taşınmayan bir alan bir gün loga veya hata raporuna düşemez.
 *
 * Buradaki her metin **özel nitelikli sağlık verisidir**: ilaç adı, teşhis
 * başlığı ve not gövdesi log'a, analytics'e, push bildirimine, hata kaydına
 * veya URL'ye yazılmaz.
 */

const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * `public.health_records.record_type` denetimi.
 *
 * Alerji, teşhis, doktor, ölçüm, not ve randevu sorusu tek tabloda tür
 * ayrımıyla durur; şema bunu aynen yansıtır.
 */
export const healthRecordTypeSchema = z.enum([
  'allergy',
  'diagnosis',
  'doctor',
  'measurement',
  'note',
  'question',
]);
export type HealthRecordType = z.infer<typeof healthRecordTypeSchema>;

export const medicationRowSchema = z.object({
  id: z.string().uuid(),
  circle_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  dosage: z.string().nullable(),
  frequency_text: z.string().nullable(),
  started_on: localDateSchema.nullable(),
  ended_on: localDateSchema.nullable(),
  prescribed_by: z.string().nullable(),
  notes: z.string().nullable(),
});

export type MedicationRow = z.infer<typeof medicationRowSchema>;
export const medicationListSchema = z.array(medicationRowSchema);

export const healthRecordRowSchema = z.object({
  id: z.string().uuid(),
  circle_id: z.string().uuid(),
  record_type: healthRecordTypeSchema,
  title: z.string().min(1).max(300),
  body: z.string().nullable(),
  recorded_on: localDateSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().uuid().nullable(),
  revision: z.number().int().positive(),
});

export type HealthRecordRow = z.infer<typeof healthRecordRowSchema>;
export const healthRecordListSchema = z.array(healthRecordRowSchema);

/** Arayüzün kullandığı ilaç biçimi. Sunucu sütun adları buraya sızmaz. */
export type Medication = {
  readonly id: string;
  readonly circleId: string;
  /** İlaç adı sağlık verisidir; log ve push'a yazılmaz. */
  readonly name: string;
  readonly dosage: string | null;
  readonly frequencyText: string | null;
  readonly startedOn: string | null;
  readonly endedOn: string | null;
  readonly prescribedBy: string | null;
  readonly notes: string | null;
};

export const toMedication = (row: MedicationRow): Medication => ({
  id: row.id,
  circleId: row.circle_id,
  name: row.name,
  dosage: row.dosage,
  frequencyText: row.frequency_text,
  startedOn: row.started_on,
  endedOn: row.ended_on,
  prescribedBy: row.prescribed_by,
  notes: row.notes,
});

/** Arayüzün kullandığı sağlık kaydı biçimi. */
export type HealthRecord = {
  readonly id: string;
  readonly circleId: string;
  readonly type: HealthRecordType;
  /** Başlık sağlık verisidir; log ve push'a yazılmaz. */
  readonly title: string;
  readonly body: string | null;
  readonly recordedOn: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string | null;
  /** Kaçıncı sürüm olduğu. Not geçmişi bu sayıyla anlatılır. */
  readonly revision: number;
};

export const toHealthRecord = (row: HealthRecordRow): HealthRecord => ({
  id: row.id,
  circleId: row.circle_id,
  type: row.record_type,
  title: row.title,
  body: row.body,
  recordedOn: row.recorded_on,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by,
  revision: row.revision,
});

/**
 * İlacın bugün itibarıyla aktif olup olmadığı.
 *
 * Bitiş günü **bugün ise ilaç hâlâ aktiftir**: "bugüne kadar" diyen bir
 * reçetede son günü geçmişe atmak, bakım vereni o gün ilacı atlamaya
 * yöneltirdi.
 *
 * @param today Çemberin saat dilimindeki bugün (`YYYY-MM-DD`). Cihazın günü
 *   değil: iki bakım veren farklı zaman dilimlerindeyse aynı listeyi
 *   görmelidir.
 */
export const isActiveMedication = (medication: Medication, today: string): boolean =>
  medication.endedOn === null || medication.endedOn >= today;

/** Türkçe tür adı. Arayüz metinleri ham sütun değeri göstermez. */
export const healthRecordTypeLabel = (type: HealthRecordType): string => {
  switch (type) {
    case 'allergy':
      return 'Alerji';
    case 'diagnosis':
      return 'Teşhis';
    case 'doctor':
      return 'Doktor';
    case 'measurement':
      return 'Ölçüm';
    case 'note':
      return 'Not';
    case 'question':
      return 'Randevu sorusu';
  }
};
