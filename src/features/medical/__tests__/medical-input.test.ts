import {
  healthRecordIssueMessage,
  medicationIssueMessage,
  medicationTaskPrefill,
  validateHealthRecordInput,
  validateMedicationInput,
} from '../medical-input';
import type { MedicationInput } from '../medical-repository';

/**
 * Girdi doğrulama testleri.
 *
 * En kritik davranış `medicationTaskPrefill`e aittir: sözleşme otomatik ilaç
 * hatırlatmasını yasaklar. Fonksiyon hiçbir şey KAYDETMEZ; yalnız form
 * başlangıç değeri üretir.
 */

const CIRCLE_ID = '11111111-1111-4111-8111-111111111111';

const base: MedicationInput = {
  circleId: CIRCLE_ID,
  name: 'Metformin',
  dosage: '500 mg',
  frequencyText: 'Günde iki kez',
  startedOn: '2026-01-15',
  endedOn: null,
  prescribedBy: null,
  notes: null,
};

describe('validateMedicationInput', () => {
  it('geçerli girdide sorun bildirmez', () => {
    expect(validateMedicationInput(base)).toEqual([]);
  });

  it('boş adı yakalar', () => {
    expect(validateMedicationInput({ ...base, name: '   ' })).toContain('name_empty');
  });

  it('çok uzun adı yakalar', () => {
    expect(validateMedicationInput({ ...base, name: 'a'.repeat(201) })).toContain('name_too_long');
  });

  it('bozuk tarih biçimini yakalar', () => {
    expect(validateMedicationInput({ ...base, startedOn: '15.01.2026' })).toContain('date_invalid');
  });

  it('bitişin başlangıçtan önce olmasını yakalar', () => {
    const issues = validateMedicationInput({
      ...base,
      startedOn: '2026-03-01',
      endedOn: '2026-02-01',
    });

    expect(issues).toContain('date_order');
  });

  it('bitiş başlangıçla aynı günse sorun bildirmez', () => {
    // Tek günlük bir reçete geçerlidir.
    const issues = validateMedicationInput({
      ...base,
      startedOn: '2026-03-01',
      endedOn: '2026-03-01',
    });

    expect(issues).toEqual([]);
  });

  it('serbest metin içeriğini denetlemez, yalnız uzunluğunu', () => {
    // "yarım tablet", "gerektiğinde" gibi ifadeler geçerlidir; kalıba
    // zorlamak kaydı gerçeğe uzak hale getirirdi.
    expect(validateMedicationInput({ ...base, dosage: 'gerektiğinde yarım tablet' })).toEqual([]);
    expect(validateMedicationInput({ ...base, notes: 'a'.repeat(2001) })).toContain(
      'text_too_long',
    );
  });
});

describe('validateHealthRecordInput', () => {
  it('geçerli girdide sorun bildirmez', () => {
    expect(validateHealthRecordInput({ title: 'Penisilin', recordedOn: '2026-02-01' })).toEqual([]);
  });

  it('boş başlığı yakalar', () => {
    expect(validateHealthRecordInput({ title: '  ', recordedOn: null })).toContain('title_empty');
  });

  it('tarihsiz kaydı kabul eder', () => {
    // Alerjinin ne zaman öğrenildiği çoğu zaman bilinmez.
    expect(validateHealthRecordInput({ title: 'Penisilin', recordedOn: null })).toEqual([]);
  });
});

describe('mesajlar', () => {
  it('her ilaç sorununun kullanıcı dostu karşılığı vardır', () => {
    const issues = ['name_empty', 'name_too_long', 'date_invalid', 'date_order', 'text_too_long'];

    for (const issue of issues) {
      const message = medicationIssueMessage(issue as never);
      expect(message.length).toBeGreaterThan(0);
      // Teknik ayrıntı arayüze sızmaz.
      expect(message).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it('her kayıt sorununun kullanıcı dostu karşılığı vardır', () => {
    for (const issue of ['title_empty', 'title_too_long', 'date_invalid']) {
      expect(healthRecordIssueMessage(issue as never).length).toBeGreaterThan(0);
    }
  });
});

describe('medicationTaskPrefill', () => {
  it('ad ve dozdan görev başlığı üretir', () => {
    expect(medicationTaskPrefill({ name: 'Metformin', dosage: '500 mg' })).toEqual({
      kind: 'medication',
      title: 'Metformin · 500 mg',
    });
  });

  it('doz yoksa yalnız adı kullanır', () => {
    expect(medicationTaskPrefill({ name: 'Metformin', dosage: null }).title).toBe('Metformin');
    expect(medicationTaskPrefill({ name: 'Metformin', dosage: '  ' }).title).toBe('Metformin');
  });

  it('yalnız başlangıç değeri üretir; saat ve tekrar taşımaz', () => {
    // Otomatik hatırlatma yasaktır: saat, tekrar ve kaydetme kararı
    // kullanıcıya aittir. Fonksiyonun bunları üretmesi, formun kullanıcı
    // hiç dokunmadan kaydedilebilir görünmesi demek olurdu.
    const prefill = medicationTaskPrefill({ name: 'Metformin', dosage: null });

    expect(Object.keys(prefill).sort()).toEqual(['kind', 'title']);
  });
});
