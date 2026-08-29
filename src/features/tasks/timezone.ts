/**
 * Çember saat dilimi hesapları.
 *
 * TEMEL KARAR: görev saatleri **duvar saati** olarak saklanır (yerel tarih +
 * yerel saat), mutlak an olarak değil. "Sabah 08:00 ilaç" DST geçişinde de
 * sabah 08:00'dir; UTC ofseti değişir, kullanıcının beklentisi değişmez.
 *
 * Ayrıca hesaplar **cihazın** değil **çemberin** saat dilimini kullanır.
 * İstanbul'daki ve Berlin'deki iki bakım veren aynı günü aynı gün olarak
 * görmelidir; aksi halde biri "bugünün" görevini yarın altında görür.
 *
 * Uygulama `Intl.DateTimeFormat` üzerine kuruludur: IANA veritabanını
 * çalışma zamanı taşır, uygulamanın kendi DST tablosunu tutması gerekmez.
 */

/** Yerel duvar saati: zaman dilimi bilgisi TAŞIMAZ. */
export type WallClock = {
  readonly year: number;
  /** 1-12. */
  readonly month: number;
  /** 1-31. */
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
};

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

/** `YYYY-MM-DD` biçiminde yerel tarih. */
export const toLocalDateString = (clock: WallClock): string =>
  `${pad(clock.year, 4)}-${pad(clock.month)}-${pad(clock.day)}`;

/** `HH:MM` biçiminde yerel saat. */
export const toLocalTimeString = (clock: WallClock): string =>
  `${pad(clock.hour)}:${pad(clock.minute)}`;

/** `YYYY-MM-DD` metnini gün bileşenlerine ayırır. */
export const parseLocalDate = (value: string): { year: number; month: number; day: number } => {
  const parts = value.split('-');
  return {
    year: Number.parseInt(parts[0] ?? '', 10),
    month: Number.parseInt(parts[1] ?? '', 10),
    day: Number.parseInt(parts[2] ?? '', 10),
  };
};

/** `HH:MM` veya `HH:MM:SS` metnini saat bileşenlerine ayırır. */
export const parseLocalTime = (value: string): { hour: number; minute: number } => {
  const parts = value.split(':');
  return {
    hour: Number.parseInt(parts[0] ?? '', 10),
    minute: Number.parseInt(parts[1] ?? '', 10),
  };
};

const OFFSET_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

const offsetFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = OFFSET_FORMATTERS.get(timeZone);
  if (cached !== undefined) return cached;

  const created = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  OFFSET_FORMATTERS.set(timeZone, created);
  return created;
};

/** Bilinmeyen bir zaman dilimi adında düşülecek güvenli varsayılan. */
export const FALLBACK_TIMEZONE = 'Europe/Istanbul';

/** Zaman dilimi adının çalışma zamanınca tanınıp tanınmadığını denetler. */
export const isSupportedTimeZone = (timeZone: string): boolean => {
  try {
    offsetFormatter(timeZone).format(new Date());
    return true;
  } catch {
    return false;
  }
};

/** Tanınmayan zaman dilimini güvenli varsayılana düşürür. */
export const safeTimeZone = (timeZone: string): string =>
  isSupportedTimeZone(timeZone) ? timeZone : FALLBACK_TIMEZONE;

/** Bir mutlak anın, verilen zaman dilimindeki duvar saati karşılığı. */
export const toWallClock = (instant: Date, timeZone: string): WallClock => {
  const parts = offsetFormatter(safeTimeZone(timeZone)).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    return found === undefined ? 0 : Number.parseInt(found.value, 10);
  };

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour') % 24,
    minute: read('minute'),
  };
};

/** Zaman diliminin belirtilen andaki UTC ofseti (dakika). */
export const offsetMinutesAt = (instant: Date, timeZone: string): number => {
  const clock = toWallClock(instant, timeZone);
  const asUtc = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute);
  // Saniye ve altı bilinçli olarak yok sayılır: görev saatleri dakika
  // çözünürlüğündedir ve IANA ofsetleri dakikanın katıdır.
  const instantMinutes = Math.floor(instant.getTime() / 60_000) * 60_000;
  return Math.round((asUtc - instantMinutes) / 60_000);
};

/**
 * Duvar saatini mutlak ana çevirir.
 *
 * **DST kuralları burada tanımlanır:**
 *
 * - *İleri atlama* (saat 03:00'a sıçrar, 03:00-04:00 arası yoktur): var
 *   olmayan duvar saati, atlamadan SONRAKİ ilk gerçek ana çekilir. Görev
 *   kaybolmaz; kullanıcı onu o günün ilk mümkün saatinde görür.
 * - *Geri atlama* (saat iki kez yaşanır): İLK geçiş kabul edilir. Böylece
 *   günde bir kez tekrarlayan bir ilaç, o gün iki kez düşmez.
 *
 * Bu kararlar test edilmiştir; sessiz bir varsayım değildir.
 */
export const wallClockToInstant = (clock: WallClock, timeZone: string): Date => {
  const zone = safeTimeZone(timeZone);
  const naiveUtc = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute);

  // Geçişin İKİ yanındaki ofsetler de denenir. Yalnız hedef anın kendi
  // ofsetiyle hesaplamak, geri atlamada erken adayı hiç üretmez: o aday
  // geçişten ÖNCEKİ ofsetle bulunur.
  const dayMs = 86_400_000;
  const offsetCandidates = new Set([
    offsetMinutesAt(new Date(naiveUtc), zone),
    offsetMinutesAt(new Date(naiveUtc - dayMs), zone),
    offsetMinutesAt(new Date(naiveUtc + dayMs), zone),
  ]);

  const guesses = [...offsetCandidates].map((offset) => new Date(naiveUtc - offset * 60_000));

  // Geri atlamada birden çok aday geçerlidir; erken olan seçilir (ilk geçiş).
  const candidates = guesses
    .filter((candidate) => {
      const round = toWallClock(candidate, zone);
      return (
        round.year === clock.year &&
        round.month === clock.month &&
        round.day === clock.day &&
        round.hour === clock.hour &&
        round.minute === clock.minute
      );
    })
    .sort((a, b) => a.getTime() - b.getTime());

  const first = candidates[0];
  if (first !== undefined) return first;

  // Hiçbir aday tutmuyorsa duvar saati o gün YOKTUR (ileri atlama).
  // Atlamadan sonraki ilk gerçek ana çekilir.
  return new Date(Math.max(...guesses.map((guess) => guess.getTime())));
};

/** `+03:00` biçiminde ofset metni. */
export const formatOffset = (offsetMinutes: number): string => {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
};
