import {
  PRESET_RRULES,
  describeRecurrence,
  occurrencesInRange,
  parseRRule,
  type TaskSchedule,
} from '../recurrence';
import { toLocalDateString } from '../timezone';

/**
 * Tekrar motoru testleri.
 *
 * Faz 05 kabul kriteri: "Günde üç kez tekrarlayan ilaç görevi TEK kural
 * satırıdır." Occurrence'lar burada hesaplanır, veritabanına önceden
 * yazılmaz.
 */

const schedule = (overrides: Partial<TaskSchedule> = {}): TaskSchedule => ({
  dtstartLocalDate: '2026-08-28',
  dtstartLocalTime: '08:00',
  rrule: null,
  untilLocalDate: null,
  ...overrides,
});

const days = (from: string, to: string, task: TaskSchedule): string[] =>
  occurrencesInRange(task, from, to).map(toLocalDateString);

describe('parseRRule', () => {
  it('günlük kuralı çözümler', () => {
    expect(parseRRule('FREQ=DAILY')).toEqual({
      freq: 'DAILY',
      interval: 1,
      byDay: [],
      count: null,
    });
  });

  it('hafta içi kuralını çözümler', () => {
    expect(parseRRule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')).toMatchObject({
      freq: 'WEEKLY',
      byDay: ['MO', 'TU', 'WE', 'TH', 'FR'],
    });
  });

  it('aralık ve sayaç alanlarını okur', () => {
    expect(parseRRule('FREQ=DAILY;INTERVAL=3;COUNT=5')).toMatchObject({ interval: 3, count: 5 });
  });

  it('desteklenmeyen frekansı reddeder', () => {
    // Aylık/yıllık tekrar arayüzde sunulmuyor; yarım anlaşılmış kural
    // uygulamak yanlış günde ilaç göstermek demektir.
    expect(parseRRule('FREQ=MONTHLY')).toBeNull();
    expect(parseRRule('FREQ=YEARLY')).toBeNull();
  });

  it('UNTIL alanını reddeder', () => {
    // Bitiş günü ayrı sütunda tutulur; kural zaman dilimi taşımaz.
    expect(parseRRule('FREQ=DAILY;UNTIL=20261231T000000Z')).toBeNull();
  });

  it('günlük kuralda BYDAY’i reddeder', () => {
    expect(parseRRule('FREQ=DAILY;BYDAY=MO')).toBeNull();
  });

  it('geçersiz gün kodunu ve aralığı reddeder', () => {
    expect(parseRRule('FREQ=WEEKLY;BYDAY=XX')).toBeNull();
    expect(parseRRule('FREQ=DAILY;INTERVAL=0')).toBeNull();
    expect(parseRRule('FREQ=DAILY;INTERVAL=-2')).toBeNull();
  });

  it('bozuk metni reddeder', () => {
    expect(parseRRule('anlamsız')).toBeNull();
    expect(parseRRule('')).toBeNull();
  });
});

describe('describeRecurrence', () => {
  it('hazır seçenekleri Türkçe anlatır ve ham RRULE göstermez', () => {
    expect(describeRecurrence(null)).toBe('Tekrar etmez');
    expect(describeRecurrence(PRESET_RRULES.daily as string)).toBe('Her gün');
    expect(describeRecurrence(PRESET_RRULES.weekdays as string)).toBe('Hafta içi her gün');
    expect(describeRecurrence(PRESET_RRULES.weekly as string)).toBe('Haftada bir');
    expect(describeRecurrence('FREQ=DAILY;INTERVAL=3')).toBe('3 günde bir');
  });

  it('anlaşılmayan kuralı özel tekrar olarak anlatır', () => {
    expect(describeRecurrence('FREQ=MONTHLY')).toBe('Özel tekrar');
  });
});

describe('occurrencesInRange', () => {
  it('tekrarsız görevi yalnız başlangıç gününde üretir', () => {
    expect(days('2026-08-01', '2026-09-30', schedule())).toEqual(['2026-08-28']);
  });

  it('tekrarsız görev aralık dışındaysa hiç üretmez', () => {
    expect(days('2026-09-01', '2026-09-30', schedule())).toEqual([]);
  });

  it('günlük tekrarı aralık boyunca üretir', () => {
    const result = days('2026-08-28', '2026-08-31', schedule({ rrule: 'FREQ=DAILY' }));

    expect(result).toEqual(['2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31']);
  });

  it('başlangıçtan önceki günleri üretmez', () => {
    const result = days('2026-08-20', '2026-08-29', schedule({ rrule: 'FREQ=DAILY' }));

    expect(result).toEqual(['2026-08-28', '2026-08-29']);
  });

  it('gün atlamalı tekrarı doğru hesaplar', () => {
    const result = days('2026-08-28', '2026-09-06', schedule({ rrule: 'FREQ=DAILY;INTERVAL=3' }));

    expect(result).toEqual(['2026-08-28', '2026-08-31', '2026-09-03', '2026-09-06']);
  });

  it('hafta içi kuralında hafta sonunu atlar', () => {
    // 2026-08-28 bir cuma; 29-30 hafta sonu.
    const result = days(
      '2026-08-28',
      '2026-09-04',
      schedule({ rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' }),
    );

    expect(result).toEqual([
      '2026-08-28',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
    ]);
  });

  it('haftalık tekrarı başlangıç gününün gününde üretir', () => {
    // BYDAY verilmezse başlangıç günü (cuma) kullanılır.
    const result = days('2026-08-28', '2026-09-25', schedule({ rrule: 'FREQ=WEEKLY' }));

    expect(result).toEqual(['2026-08-28', '2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25']);
  });

  it('iki haftada bir kuralını doğru hesaplar', () => {
    const result = days('2026-08-28', '2026-10-09', schedule({ rrule: 'FREQ=WEEKLY;INTERVAL=2' }));

    expect(result).toEqual(['2026-08-28', '2026-09-11', '2026-09-25', '2026-10-09']);
  });

  it('pazar gününü haftanın sonuna yerleştirir', () => {
    // RFC 5545 haftası pazartesi başlar: SU, aynı haftanın son günüdür.
    const result = days(
      '2026-08-24',
      '2026-08-30',
      schedule({
        dtstartLocalDate: '2026-08-24',
        rrule: 'FREQ=WEEKLY;BYDAY=SU,MO',
      }),
    );

    expect(result).toEqual(['2026-08-24', '2026-08-30']);
  });

  it('bitiş gününden sonrasını üretmez', () => {
    const result = days(
      '2026-08-28',
      '2026-09-30',
      schedule({ rrule: 'FREQ=DAILY', untilLocalDate: '2026-08-30' }),
    );

    expect(result).toEqual(['2026-08-28', '2026-08-29', '2026-08-30']);
  });

  it('COUNT sınırına uyar', () => {
    const result = days('2026-08-28', '2026-09-30', schedule({ rrule: 'FREQ=DAILY;COUNT=3' }));

    expect(result).toEqual(['2026-08-28', '2026-08-29', '2026-08-30']);
  });

  it('COUNT’u aralık dışındaki örnekleri de sayarak uygular', () => {
    // Sayaç görüntülenen aralığa değil, kuralın kendisine aittir.
    const result = days('2026-08-30', '2026-09-30', schedule({ rrule: 'FREQ=DAILY;COUNT=3' }));

    expect(result).toEqual(['2026-08-30']);
  });

  it('desteklenmeyen kuralı tekrarsız görev gibi ele alır', () => {
    // Az üretmek, yanlış gün üretmekten yeğdir.
    const result = days('2026-08-01', '2026-12-31', schedule({ rrule: 'FREQ=MONTHLY' }));

    expect(result).toEqual(['2026-08-28']);
  });

  it('ters aralıkta hiç üretmez', () => {
    expect(days('2026-09-30', '2026-08-01', schedule({ rrule: 'FREQ=DAILY' }))).toEqual([]);
  });

  it('saat bilgisini her örneğe taşır', () => {
    const result = occurrencesInRange(
      schedule({ dtstartLocalTime: '21:45', rrule: 'FREQ=DAILY' }),
      '2026-08-28',
      '2026-08-29',
    );

    expect(result.every((clock) => clock.hour === 21 && clock.minute === 45)).toBe(true);
  });

  it('sınırsız kuralda azami sonuç sayısını aşmaz', () => {
    // Bozuk veya çok geniş bir aralık uygulamayı kilitlemez.
    const result = occurrencesInRange(
      schedule({ rrule: 'FREQ=DAILY' }),
      '2026-08-28',
      '2036-08-28',
      50,
    );

    expect(result).toHaveLength(50);
  });

  it('günde üç kez ilaç senaryosu üç ayrı kural satırıyla temsil edilir', () => {
    // Şema kararı: bir kural satırı bir saat taşır. "Günde üç kez", üç görev
    // satırıdır; her biri TEK kural satırıdır ve occurrence üretmez.
    const morning = schedule({ dtstartLocalTime: '08:00', rrule: 'FREQ=DAILY' });
    const noon = schedule({ dtstartLocalTime: '14:00', rrule: 'FREQ=DAILY' });
    const evening = schedule({ dtstartLocalTime: '20:00', rrule: 'FREQ=DAILY' });

    for (const task of [morning, noon, evening]) {
      expect(days('2026-08-28', '2026-08-30', task)).toHaveLength(3);
    }
  });
});
