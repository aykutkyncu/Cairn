import {
  healthRecordListSchema,
  healthRecordTypeLabel,
  isActiveMedication,
  medicationListSchema,
  toHealthRecord,
  toMedication,
  type Medication,
} from '../medical-schema';

/**
 * Tıbbi dosya şema testleri.
 *
 * Sınanan davranışlar:
 * - Sunucu satırı arayüz biçimine sütun adları sızmadan çevrilir.
 * - Bilinmeyen kayıt türü kabul edilmez.
 * - "Aktif ilaç" kararı bitiş günü BUGÜN iken hâlâ aktiftir.
 */

const CIRCLE_ID = '11111111-1111-4111-8111-111111111111';
const MEDICATION_ID = '22222222-2222-4222-8222-222222222222';
const RECORD_ID = '33333333-3333-4333-8333-333333333333';

const medicationRow = {
  id: MEDICATION_ID,
  circle_id: CIRCLE_ID,
  name: 'Metformin',
  dosage: '500 mg',
  frequency_text: 'Günde iki kez',
  started_on: '2026-01-15',
  ended_on: null,
  prescribed_by: 'Dr. Yılmaz',
  notes: 'Yemekten sonra',
};

const recordRow = {
  id: RECORD_ID,
  circle_id: CIRCLE_ID,
  record_type: 'allergy',
  title: 'Penisilin',
  body: 'Döküntü yapıyor',
  recorded_on: '2026-02-01',
  created_at: '2026-02-01T10:00:00+00:00',
  updated_at: '2026-02-01T10:00:00+00:00',
  created_by: null,
  revision: 1,
};

describe('medicationListSchema', () => {
  it('geçerli satırı kabul eder', () => {
    expect(medicationListSchema.safeParse([medicationRow]).success).toBe(true);
  });

  it('adı boş olan satırı kabul etmez', () => {
    // Veritabanında da bir kısıt var; sınır doğrulaması onu tekrarlar.
    expect(medicationListSchema.safeParse([{ ...medicationRow, name: '' }]).success).toBe(false);
  });

  it('bozuk tarih biçimini kabul etmez', () => {
    expect(
      medicationListSchema.safeParse([{ ...medicationRow, started_on: '15.01.2026' }]).success,
    ).toBe(false);
  });
});

describe('healthRecordListSchema', () => {
  it('geçerli satırı kabul eder', () => {
    expect(healthRecordListSchema.safeParse([recordRow]).success).toBe(true);
  });

  it('bilinmeyen kayıt türünü kabul etmez', () => {
    // Sunucuya yeni bir tür eklendiyse arayüz onu sessizce "not" gibi
    // göstermemelidir; sınırda durur.
    expect(
      healthRecordListSchema.safeParse([{ ...recordRow, record_type: 'genetic' }]).success,
    ).toBe(false);
  });
});

describe('toMedication', () => {
  it('sunucu sütun adlarını arayüze taşımaz', () => {
    const parsed = medicationListSchema.parse([medicationRow]);
    const medication = toMedication(parsed[0]!);

    expect(medication).toEqual({
      id: MEDICATION_ID,
      circleId: CIRCLE_ID,
      name: 'Metformin',
      dosage: '500 mg',
      frequencyText: 'Günde iki kez',
      startedOn: '2026-01-15',
      endedOn: null,
      prescribedBy: 'Dr. Yılmaz',
      notes: 'Yemekten sonra',
    });
    expect(Object.keys(medication)).not.toContain('circle_id');
  });
});

describe('toHealthRecord', () => {
  it('kaydı arayüz biçimine çevirir', () => {
    const parsed = healthRecordListSchema.parse([recordRow]);
    const record = toHealthRecord(parsed[0]!);

    expect(record.type).toBe('allergy');
    expect(record.title).toBe('Penisilin');
    expect(record.revision).toBe(1);
    expect(Object.keys(record)).not.toContain('record_type');
  });
});

describe('isActiveMedication', () => {
  const base: Medication = {
    id: MEDICATION_ID,
    circleId: CIRCLE_ID,
    name: 'Metformin',
    dosage: null,
    frequencyText: null,
    startedOn: '2026-01-01',
    endedOn: null,
    prescribedBy: null,
    notes: null,
  };

  it('bitiş günü olmayan ilaç aktiftir', () => {
    expect(isActiveMedication(base, '2026-09-01')).toBe(true);
  });

  it('bitiş günü BUGÜN olan ilaç hâlâ aktiftir', () => {
    // Son günü geçmişe atmak, bakım vereni o gün ilacı atlamaya yöneltirdi.
    expect(isActiveMedication({ ...base, endedOn: '2026-09-01' }, '2026-09-01')).toBe(true);
  });

  it('bitiş günü geçmiş ilaç aktif değildir', () => {
    expect(isActiveMedication({ ...base, endedOn: '2026-08-31' }, '2026-09-01')).toBe(false);
  });
});

describe('healthRecordTypeLabel', () => {
  it('her tür için Türkçe ad döndürür', () => {
    expect(healthRecordTypeLabel('allergy')).toBe('Alerji');
    expect(healthRecordTypeLabel('diagnosis')).toBe('Teşhis');
    expect(healthRecordTypeLabel('doctor')).toBe('Doktor');
    expect(healthRecordTypeLabel('measurement')).toBe('Ölçüm');
    expect(healthRecordTypeLabel('note')).toBe('Not');
    expect(healthRecordTypeLabel('question')).toBe('Randevu sorusu');
  });
});
