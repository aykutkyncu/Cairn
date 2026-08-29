import {
  FALLBACK_TIMEZONE,
  formatOffset,
  isSupportedTimeZone,
  offsetMinutesAt,
  safeTimeZone,
  toWallClock,
  wallClockToInstant,
} from '../timezone';

/**
 * Zaman dilimi testleri.
 *
 * Faz 05 kabul kriteri: "Aynı circle zaman dilimindeki gün iki farklı cihazda
 * aynı gün altında görünür." Bunun temeli, duvar saati ↔ mutlak an
 * dönüşümünün cihazdan bağımsız ve DST'de tanımlı olmasıdır.
 */

const wall = (year: number, month: number, day: number, hour: number, minute = 0) => ({
  year,
  month,
  day,
  hour,
  minute,
});

describe('toWallClock', () => {
  it('aynı anı iki zaman diliminde farklı duvar saati olarak gösterir', () => {
    // Arrange: 2026-08-28T05:00:00Z
    const instant = new Date('2026-08-28T05:00:00Z');

    // Act & Assert
    expect(toWallClock(instant, 'Europe/Istanbul')).toEqual(wall(2026, 8, 28, 8, 0));
    expect(toWallClock(instant, 'Europe/Berlin')).toEqual(wall(2026, 8, 28, 7, 0));
  });

  it('gün sınırında doğru günü verir', () => {
    // İstanbul'da 29 Ağustos 00:30, UTC'de hâlâ 28 Ağustos.
    const instant = new Date('2026-08-28T21:30:00Z');

    expect(toWallClock(instant, 'Europe/Istanbul')).toEqual(wall(2026, 8, 29, 0, 30));
    expect(toWallClock(instant, 'UTC')).toEqual(wall(2026, 8, 28, 21, 30));
  });

  it('gece yarısını 24 değil 0 olarak verir', () => {
    const instant = new Date('2026-08-28T21:00:00Z');

    expect(toWallClock(instant, 'Europe/Istanbul').hour).toBe(0);
  });
});

describe('offsetMinutesAt', () => {
  it('İstanbul için sabit +03:00 verir', () => {
    // Türkiye 2016'dan beri kalıcı yaz saati uygular; DST geçişi yoktur.
    expect(offsetMinutesAt(new Date('2026-01-15T12:00:00Z'), 'Europe/Istanbul')).toBe(180);
    expect(offsetMinutesAt(new Date('2026-07-15T12:00:00Z'), 'Europe/Istanbul')).toBe(180);
  });

  it('Berlin için kış ve yaz ofsetlerini ayırt eder', () => {
    expect(offsetMinutesAt(new Date('2026-01-15T12:00:00Z'), 'Europe/Berlin')).toBe(60);
    expect(offsetMinutesAt(new Date('2026-07-15T12:00:00Z'), 'Europe/Berlin')).toBe(120);
  });
});

describe('wallClockToInstant', () => {
  it('duvar saatini mutlak ana çevirir', () => {
    const instant = wallClockToInstant(wall(2026, 8, 28, 8, 0), 'Europe/Istanbul');

    expect(instant.toISOString()).toBe('2026-08-28T05:00:00.000Z');
  });

  it('gidiş-dönüş dönüşümü duvar saatini korur', () => {
    // Duvar saati semantiğinin çekirdeği: ne gidişte ne dönüşte kayma olmaz.
    for (const zone of ['Europe/Istanbul', 'Europe/Berlin', 'UTC', 'America/New_York']) {
      const original = wall(2026, 3, 15, 8, 30);
      const roundTrip = toWallClock(wallClockToInstant(original, zone), zone);

      expect(roundTrip).toEqual(original);
    }
  });

  it('DST ileri atlamasında sabah 08:00 duvar saatini korur', () => {
    // Berlin 29 Mart 2026'da saatleri ileri alır. Sabah 08:00 görevi hâlâ
    // sabah 08:00'dir; yalnız UTC karşılığı bir saat kayar.
    const before = wallClockToInstant(wall(2026, 3, 28, 8, 0), 'Europe/Berlin');
    const after = wallClockToInstant(wall(2026, 3, 29, 8, 0), 'Europe/Berlin');

    expect(before.toISOString()).toBe('2026-03-28T07:00:00.000Z');
    expect(after.toISOString()).toBe('2026-03-29T06:00:00.000Z');
    expect(toWallClock(after, 'Europe/Berlin').hour).toBe(8);
  });

  it('ileri atlamada var olmayan saati atlamadan sonraki ilk ana çeker', () => {
    // Berlin'de 29 Mart 2026 02:30 YAŞANMAZ: saat 02:00'dan 03:00'a sıçrar.
    // Görev kaybolmaz; o günün ilk mümkün anına çekilir.
    const instant = wallClockToInstant(wall(2026, 3, 29, 2, 30), 'Europe/Berlin');
    const clock = toWallClock(instant, 'Europe/Berlin');

    expect(clock.day).toBe(29);
    expect(clock.hour).toBeGreaterThanOrEqual(3);
  });

  it('geri atlamada tekrarlanan saatin İLK geçişini seçer', () => {
    // Berlin'de 25 Ekim 2026 02:30 iki kez yaşanır (yaz ve kış ofsetiyle).
    // Günde bir kez tekrarlayan bir ilaç o gün iki kez düşmemelidir.
    const instant = wallClockToInstant(wall(2026, 10, 25, 2, 30), 'Europe/Berlin');

    // İlk geçiş yaz saatiyle (+02:00) yaşanır: 00:30Z.
    expect(instant.toISOString()).toBe('2026-10-25T00:30:00.000Z');
    expect(toWallClock(instant, 'Europe/Berlin')).toEqual(wall(2026, 10, 25, 2, 30));
  });

  it('DST geçiş gününde bile günde bir kez tekrarlayan görev tek ana düşer', () => {
    // Aynı duvar saati iki kez sorulsa da sonuç aynı andır: idempotent.
    const first = wallClockToInstant(wall(2026, 10, 25, 2, 30), 'Europe/Berlin');
    const second = wallClockToInstant(wall(2026, 10, 25, 2, 30), 'Europe/Berlin');

    expect(first.getTime()).toBe(second.getTime());
  });
});

describe('zaman dilimi doğrulaması', () => {
  it('bilinen zaman dilimlerini kabul eder', () => {
    expect(isSupportedTimeZone('Europe/Istanbul')).toBe(true);
    expect(isSupportedTimeZone('America/New_York')).toBe(true);
  });

  it('uydurma zaman dilimini reddeder', () => {
    expect(isSupportedTimeZone('Mars/Olympus')).toBe(false);
  });

  it('tanınmayan zaman dilimini güvenli varsayılana düşürür', () => {
    // Sunucudan bozuk bir değer gelse bile uygulama çökmez.
    expect(safeTimeZone('Mars/Olympus')).toBe(FALLBACK_TIMEZONE);
    expect(safeTimeZone('Europe/Berlin')).toBe('Europe/Berlin');
  });

  it('tanınmayan zaman diliminde de duvar saati üretebilir', () => {
    expect(() => toWallClock(new Date(), 'Mars/Olympus')).not.toThrow();
  });
});

describe('formatOffset', () => {
  it('pozitif ve negatif ofsetleri ISO biçiminde yazar', () => {
    expect(formatOffset(180)).toBe('+03:00');
    expect(formatOffset(60)).toBe('+01:00');
    expect(formatOffset(0)).toBe('+00:00');
    expect(formatOffset(-300)).toBe('-05:00');
  });

  it('yarım saatlik ofsetleri doğru yazar', () => {
    // Örn. Asia/Kolkata (+05:30) ve Australia/Adelaide (+09:30).
    expect(formatOffset(330)).toBe('+05:30');
    expect(formatOffset(-210)).toBe('-03:30');
  });
});
