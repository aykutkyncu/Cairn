import {
  OCCURRENCE_ID_MAX_LENGTH,
  buildOccurrenceId,
  isValidOccurrenceId,
  occurrenceIdFromLocalParts,
  occurrenceIdToInstant,
  occurrenceLocalDate,
} from '../occurrence';

/**
 * Occurrence kimliği testleri.
 *
 * Faz 05 kabul kriterleri:
 * - "Aynı circle zaman dilimindeki gün iki farklı cihazda aynı gün altında
 *   görünür": kimlik cihazdan değil çemberden türer.
 * - "Eşzamanlı tamamlama tek kabul edilmiş completion üretir": aynı örnek
 *   için üretilen kimlik her cihazda BİREBİR aynı olmalıdır, yoksa
 *   veritabanındaki (task_id, occurrence_id) tekilliği devreye girmez.
 */

const clock = (year: number, month: number, day: number, hour: number, minute = 0) => ({
  year,
  month,
  day,
  hour,
  minute,
});

describe('buildOccurrenceId', () => {
  it('kanonik ISO-8601 ofsetli biçimi üretir', () => {
    expect(buildOccurrenceId(clock(2026, 8, 28, 8, 0), 'Europe/Istanbul')).toBe(
      '2026-08-28T08:00:00+03:00',
    );
  });

  it('çemberin zaman dilimini kullanır, cihazınkini değil', () => {
    // Aynı duvar saati, iki farklı çember zaman dilimi: farklı kimlikler.
    expect(buildOccurrenceId(clock(2026, 8, 28, 8, 0), 'Europe/Berlin')).toBe(
      '2026-08-28T08:00:00+02:00',
    );
  });

  it('aynı örnek için her çağrıda birebir aynı kimliği üretir', () => {
    // Eşzamanlı tamamlamada veritabanı tekilliğinin çalışması buna bağlıdır.
    const first = buildOccurrenceId(clock(2026, 8, 28, 8, 0), 'Europe/Istanbul');
    const second = buildOccurrenceId(clock(2026, 8, 28, 8, 0), 'Europe/Istanbul');

    expect(first).toBe(second);
  });

  it('kış ve yaz saatinde farklı ofset yazar', () => {
    expect(buildOccurrenceId(clock(2026, 1, 15, 8, 0), 'Europe/Berlin')).toBe(
      '2026-01-15T08:00:00+01:00',
    );
    expect(buildOccurrenceId(clock(2026, 7, 15, 8, 0), 'Europe/Berlin')).toBe(
      '2026-07-15T08:00:00+02:00',
    );
  });

  it('DST ileri atlamasında kaydırılan gerçek anı gösterir', () => {
    // Berlin'de 29 Mart 2026 02:30 yaşanmaz; kimlik uydurma bir saat taşımaz.
    const id = buildOccurrenceId(clock(2026, 3, 29, 2, 30), 'Europe/Berlin');

    expect(isValidOccurrenceId(id)).toBe(true);
    expect(id.startsWith('2026-03-29T03:')).toBe(true);
  });

  it('geri atlamada ilk geçişin ofsetini yazar', () => {
    // 25 Ekim 2026 02:30 iki kez yaşanır; ilk geçiş yaz saatiyledir.
    expect(buildOccurrenceId(clock(2026, 10, 25, 2, 30), 'Europe/Berlin')).toBe(
      '2026-10-25T02:30:00+02:00',
    );
  });

  it('yarım saatlik ofsetli zaman dilimlerini destekler', () => {
    expect(buildOccurrenceId(clock(2026, 8, 28, 8, 0), 'Asia/Kolkata')).toBe(
      '2026-08-28T08:00:00+05:30',
    );
  });

  it('negatif ofsetli zaman dilimlerini destekler', () => {
    expect(buildOccurrenceId(clock(2026, 8, 28, 8, 0), 'America/New_York')).toBe(
      '2026-08-28T08:00:00-04:00',
    );
  });

  it('şemanın kabul ettiği uzunluğu aşmaz', () => {
    const id = buildOccurrenceId(clock(2026, 12, 31, 23, 59), 'Asia/Kolkata');

    expect(id.length).toBeLessThanOrEqual(OCCURRENCE_ID_MAX_LENGTH);
  });
});

describe('occurrenceIdFromLocalParts', () => {
  it('görev satırındaki yerel tarih ve saatten kimlik üretir', () => {
    expect(occurrenceIdFromLocalParts('2026-08-28', '08:00', 'Europe/Istanbul')).toBe(
      '2026-08-28T08:00:00+03:00',
    );
  });

  it('saniye taşıyan saat biçimini de kabul eder', () => {
    // Postgres `time` sütunu 'HH:MM:SS' döndürür.
    expect(occurrenceIdFromLocalParts('2026-08-28', '08:00:00', 'Europe/Istanbul')).toBe(
      '2026-08-28T08:00:00+03:00',
    );
  });
});

describe('isValidOccurrenceId', () => {
  it('kanonik kimliği kabul eder', () => {
    expect(isValidOccurrenceId('2026-08-28T08:00:00+03:00')).toBe(true);
    expect(isValidOccurrenceId('2026-08-28T08:00:00-05:00')).toBe(true);
  });

  it('biçime uymayan değerleri reddeder', () => {
    expect(isValidOccurrenceId('2026-08-28')).toBe(false);
    expect(isValidOccurrenceId('2026-08-28T08:00:00Z')).toBe(false);
    expect(isValidOccurrenceId('2026-08-28T08:00:30+03:00')).toBe(false);
    expect(isValidOccurrenceId('')).toBe(false);
  });
});

describe('occurrenceIdToInstant', () => {
  it('kimliği mutlak ana çevirir', () => {
    expect(occurrenceIdToInstant('2026-08-28T08:00:00+03:00')?.toISOString()).toBe(
      '2026-08-28T05:00:00.000Z',
    );
  });

  it('farklı ofsetlerdeki aynı duvar saati farklı anlara düşer', () => {
    const istanbul = occurrenceIdToInstant('2026-08-28T08:00:00+03:00');
    const berlin = occurrenceIdToInstant('2026-08-28T08:00:00+02:00');

    expect(istanbul?.getTime()).toBeLessThan(berlin?.getTime() ?? 0);
  });

  it('geçersiz kimlikte null döndürür', () => {
    expect(occurrenceIdToInstant('bozuk')).toBeNull();
  });
});

describe('occurrenceLocalDate', () => {
  it('kimlikten yerel günü çıkarır', () => {
    expect(occurrenceLocalDate('2026-08-28T08:00:00+03:00')).toBe('2026-08-28');
  });

  it('geçersiz kimlikte null döndürür', () => {
    expect(occurrenceLocalDate('bozuk')).toBeNull();
  });
});
