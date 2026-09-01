import type { MedicationInput } from './medical-repository';

/**
 * Tıbbi dosya girdi doğrulaması.
 *
 * Bu bir güvenlik sınırı DEĞİLDİR: gerçek doğrulama veritabanı kısıtlarında
 * ve RLS'tedir. Buradaki kontrol, kullanıcıya ağ gecikmesi beklemeden
 * anlaşılır bir uyarı göstermek içindir.
 *
 * Doz, sıklık ve not alanlarının İÇERİĞİ denetlenmez. "500 mg", "yarım
 * tablet", "gerektiğinde" hepsi geçerlidir; bakım verenin yazdığı ifadeyi
 * bir kalıba zorlamak, kaydı gerçeğe uzak hale getirirdi.
 */

export type MedicationIssue =
  'name_empty' | 'name_too_long' | 'date_invalid' | 'date_order' | 'text_too_long';

export type HealthRecordIssue = 'title_empty' | 'title_too_long' | 'date_invalid';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `medications.name` sütun sınırı. */
const NAME_MAX = 200;
/** `health_records.title` sütun sınırı. */
const TITLE_MAX = 300;
/** Serbest metin alanları için makul bir üst sınır. */
const FREE_TEXT_MAX = 2000;

const isValidOptionalDate = (value: string | null): boolean =>
  value === null || DATE_PATTERN.test(value);

export const validateMedicationInput = (input: MedicationInput): readonly MedicationIssue[] => {
  const issues: MedicationIssue[] = [];
  const name = input.name.trim();

  if (name.length === 0) issues.push('name_empty');
  if (name.length > NAME_MAX) issues.push('name_too_long');

  if (!isValidOptionalDate(input.startedOn) || !isValidOptionalDate(input.endedOn)) {
    issues.push('date_invalid');
  } else if (
    input.startedOn !== null &&
    input.endedOn !== null &&
    input.endedOn < input.startedOn
  ) {
    // Veritabanında da bir kısıt var (`medications_date_order`); buradaki
    // kontrol kullanıcıya sunucuya gitmeden söyler.
    issues.push('date_order');
  }

  const freeTexts = [input.dosage, input.frequencyText, input.prescribedBy, input.notes];
  if (freeTexts.some((text) => text !== null && text.length > FREE_TEXT_MAX)) {
    issues.push('text_too_long');
  }

  return issues;
};

export const medicationIssueMessage = (issue: MedicationIssue): string => {
  switch (issue) {
    case 'name_empty':
      return 'İlacın bir adı olmalı.';
    case 'name_too_long':
      return 'İlaç adı çok uzun.';
    case 'date_invalid':
      return 'Tarihi YYYY-AA-GG biçiminde gir, örneğin 2026-09-01.';
    case 'date_order':
      return 'Bitiş tarihi başlangıçtan önce olamaz.';
    case 'text_too_long':
      return 'Girdiğin metin çok uzun.';
  }
};

export const validateHealthRecordInput = (input: {
  readonly title: string;
  readonly recordedOn: string | null;
}): readonly HealthRecordIssue[] => {
  const issues: HealthRecordIssue[] = [];
  const title = input.title.trim();

  if (title.length === 0) issues.push('title_empty');
  if (title.length > TITLE_MAX) issues.push('title_too_long');
  if (!isValidOptionalDate(input.recordedOn)) issues.push('date_invalid');

  return issues;
};

export const healthRecordIssueMessage = (issue: HealthRecordIssue): string => {
  switch (issue) {
    case 'title_empty':
      return 'Kaydın bir başlığı olmalı.';
    case 'title_too_long':
      return 'Başlık çok uzun.';
    case 'date_invalid':
      return 'Tarihi YYYY-AA-GG biçiminde gir, örneğin 2026-09-01.';
  }
};

/**
 * İlaçtan görev oluşturucu için ön dolgu üretir.
 *
 * Sözleşme: **otomatik ilaç hatırlatması yaratılmaz.** Bu fonksiyon hiçbir
 * şey kaydetmez; yalnız kullanıcı "bunun için hatırlatma kur" dediğinde
 * görev formunun başlangıç değerlerini hazırlar. Kaydetme kararı, tekrar
 * seçimi ve saat kullanıcıya aittir.
 */
export const medicationTaskPrefill = (
  medication: Pick<MedicationInput, 'name' | 'dosage'>,
): { readonly kind: 'medication'; readonly title: string } => {
  const name = medication.name.trim();
  const dosage = medication.dosage?.trim() ?? '';

  return {
    kind: 'medication',
    title: dosage.length > 0 ? `${name} · ${dosage}` : name,
  };
};
