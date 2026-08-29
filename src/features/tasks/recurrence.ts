import { parseLocalDate, parseLocalTime, type WallClock } from './timezone';

/**
 * Tekrar kuralları.
 *
 * KARAR: RFC 5545'in tamamı değil, ürünün gerçekten sunduğu **dar bir alt
 * küme** uygulanır. Arayüz kullanıcıya dört seçenek gösterir (her gün, hafta
 * içi, haftada bir, özel); genel amaçlı bir RRULE motoru taşımak, hiç
 * gösterilmeyen davranışları da bakmak zorunda kalmak demektir.
 *
 * Desteklenen: `FREQ=DAILY`, `FREQ=WEEKLY` (+`BYDAY`), her ikisinde
 * `INTERVAL` ve `COUNT`. Desteklenmeyen bir kural, kuralı olmayan görev gibi
 * ele alınır: **yalnız başlangıç günü üretilir.** Sessizce yanlış bir gün
 * üretmektense az üretmek yeğdir — bakım vereni olmayan bir göreve
 * yönlendirmek, olan bir görevi göstermemekten daha kötüdür.
 *
 * Occurrence'lar önceden üretilmez; istenen aralık için hesaplanır.
 * Veritabanında tek kural satırı vardır.
 */

/** RFC 5545 gün kısaltmaları, JavaScript `getUTCDay()` sırasıyla. */
const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

/** Arayüzün sunduğu hazır tekrar seçenekleri. */
export type RecurrencePreset = 'once' | 'daily' | 'weekdays' | 'weekly' | 'custom';

/** Çözümlenmiş tekrar kuralı. */
export type RecurrenceRule = {
  readonly freq: 'DAILY' | 'WEEKLY';
  /** Kaç günde/haftada bir. En az 1. */
  readonly interval: number;
  /** Haftalık tekrarda hangi günler. Boşsa başlangıç gününün günü kullanılır. */
  readonly byDay: readonly WeekdayCode[];
  /** Azami örnek sayısı. null = sınırsız (bitiş tarihi ayrı alanda tutulur). */
  readonly count: number | null;
};

/** Hazır seçeneklerin RRULE karşılıkları. Kullanıcı bu metni hiç görmez. */
export const PRESET_RRULES: Readonly<Record<Exclude<RecurrencePreset, 'custom'>, string | null>> = {
  once: null,
  daily: 'FREQ=DAILY',
  weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  weekly: 'FREQ=WEEKLY',
};

/** Kullanıcıya gösterilecek Türkçe tekrar açıklaması. */
export const describeRecurrence = (rrule: string | null): string => {
  if (rrule === null) return 'Tekrar etmez';

  const rule = parseRRule(rrule);
  if (rule === null) return 'Özel tekrar';

  if (rule.freq === 'DAILY') {
    return rule.interval === 1 ? 'Her gün' : `${rule.interval} günde bir`;
  }

  const isWeekdays =
    rule.byDay.length === 5 &&
    ['MO', 'TU', 'WE', 'TH', 'FR'].every((day) => rule.byDay.includes(day as WeekdayCode));
  if (isWeekdays && rule.interval === 1) return 'Hafta içi her gün';

  if (rule.interval === 1 && rule.byDay.length <= 1) return 'Haftada bir';
  return 'Özel tekrar';
};

/**
 * RRULE metnini çözümler.
 *
 * Desteklenmeyen bir alan varsa `null` döner; çağıran taraf bunu "tekrar
 * yok" gibi ele alır. Yarım anlaşılmış bir kuralı uygulamak, yanlış günde
 * ilaç göstermek demektir.
 */
export const parseRRule = (rrule: string): RecurrenceRule | null => {
  const parts = new Map<string, string>();
  for (const segment of rrule.split(';')) {
    const [key, value] = segment.split('=');
    if (key === undefined || value === undefined) return null;
    parts.set(key.trim().toUpperCase(), value.trim().toUpperCase());
  }

  const freq = parts.get('FREQ');
  if (freq !== 'DAILY' && freq !== 'WEEKLY') return null;

  const rawInterval = parts.get('INTERVAL');
  const interval = rawInterval === undefined ? 1 : Number.parseInt(rawInterval, 10);
  if (!Number.isInteger(interval) || interval < 1) return null;

  const rawCount = parts.get('COUNT');
  const count = rawCount === undefined ? null : Number.parseInt(rawCount, 10);
  if (rawCount !== undefined && (!Number.isInteger(count) || (count ?? 0) < 1)) return null;

  const rawByDay = parts.get('BYDAY');
  let byDay: WeekdayCode[] = [];
  if (rawByDay !== undefined) {
    const days = rawByDay.split(',').map((day) => day.trim());
    if (!days.every((day) => WEEKDAY_CODES.includes(day as WeekdayCode))) return null;
    byDay = days as WeekdayCode[];
  }

  // BYDAY yalnız haftalık tekrarda anlamlıdır.
  if (freq === 'DAILY' && byDay.length > 0) return null;

  // UNTIL desteklenmez: bitiş günü ayrı bir sütunda (recurrence_until_local_date)
  // tutulur, böylece kuralın kendisi zaman dilimi taşımak zorunda kalmaz.
  if (parts.has('UNTIL')) return null;

  return { freq, interval, byDay, count };
};

/** `YYYY-MM-DD` gününü UTC gün numarasına çevirir (takvim aritmetiği için). */
const toDayNumber = (date: { year: number; month: number; day: number }): number =>
  Math.floor(Date.UTC(date.year, date.month - 1, date.day) / 86_400_000);

const fromDayNumber = (dayNumber: number): { year: number; month: number; day: number } => {
  const date = new Date(dayNumber * 86_400_000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
};

const weekdayOf = (dayNumber: number): WeekdayCode =>
  WEEKDAY_CODES[new Date(dayNumber * 86_400_000).getUTCDay()] ?? 'SU';

/**
 * RFC 5545 haftası PAZARTESİ başlar. Gün kodları bu sıraya göre indekslenir,
 * böylece hafta başına eklenen gün sayısı doğrudan koddan çıkar.
 */
const MONDAY_BASED_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

const mondayBasedIndex = (code: WeekdayCode): number => MONDAY_BASED_CODES.indexOf(code);

/** Verilen günün içinde bulunduğu pazartesi-başlangıçlı haftanın ilk günü. */
const startOfWeek = (dayNumber: number): number =>
  dayNumber - mondayBasedIndex(weekdayOf(dayNumber));

/** Bir görevin tekrar tanımı. Sunucu satırının istemci karşılığıdır. */
export type TaskSchedule = {
  /** `YYYY-MM-DD`. */
  readonly dtstartLocalDate: string;
  /** `HH:MM` veya `HH:MM:SS`. */
  readonly dtstartLocalTime: string;
  /** RFC 5545 RRULE veya tekrar yoksa null. */
  readonly rrule: string | null;
  /** Tekrarın bittiği gün (dahil), `YYYY-MM-DD`. null = süresiz. */
  readonly untilLocalDate: string | null;
};

/**
 * Verilen gün aralığındaki occurrence'ların duvar saatlerini üretir.
 *
 * Aralık sınırları **dahildir** ve çemberin yerel günleridir. Occurrence'lar
 * önceden üretilip saklanmaz; her görüntülemede bu fonksiyon hesaplar.
 *
 * @param schedule Görevin tekrar tanımı.
 * @param rangeStartLocalDate Aralığın ilk günü, `YYYY-MM-DD`.
 * @param rangeEndLocalDate Aralığın son günü (dahil), `YYYY-MM-DD`.
 * @param maxResults Güvenlik sınırı: bozuk bir kural sonsuz döngü kuramaz.
 */
export const occurrencesInRange = (
  schedule: TaskSchedule,
  rangeStartLocalDate: string,
  rangeEndLocalDate: string,
  maxResults = 400,
): readonly WallClock[] => {
  const time = parseLocalTime(schedule.dtstartLocalTime);
  const startDay = toDayNumber(parseLocalDate(schedule.dtstartLocalDate));
  const rangeStart = toDayNumber(parseLocalDate(rangeStartLocalDate));
  const rangeEnd = toDayNumber(parseLocalDate(rangeEndLocalDate));

  if (rangeEnd < rangeStart) return [];

  const untilDay =
    schedule.untilLocalDate === null ? null : toDayNumber(parseLocalDate(schedule.untilLocalDate));

  const at = (dayNumber: number): WallClock => ({
    ...fromDayNumber(dayNumber),
    hour: time.hour,
    minute: time.minute,
  });

  const rule = schedule.rrule === null ? null : parseRRule(schedule.rrule);

  // Tekrar yok veya kural anlaşılmadı: yalnız başlangıç günü.
  if (rule === null) {
    return startDay >= rangeStart && startDay <= rangeEnd ? [at(startDay)] : [];
  }

  const results: WallClock[] = [];
  let emitted = 0;

  const stride = rule.freq === 'DAILY' ? rule.interval : 7 * rule.interval;
  const activeDays: readonly WeekdayCode[] =
    rule.freq === 'WEEKLY' && rule.byDay.length > 0 ? rule.byDay : [weekdayOf(startDay)];

  // Haftalık tekrarda hafta başı, başlangıç gününün haftasıdır: "her salı"
  // kuralı, başlangıç haftasının salısından itibaren işler.
  const weekStart = startOfWeek(startDay);

  for (let cursor = 0; ; cursor += 1) {
    if (cursor > 10_000) break;

    const periodDays: number[] =
      rule.freq === 'DAILY'
        ? [startDay + cursor * stride]
        : activeDays
            .map((code) => weekStart + cursor * stride + mondayBasedIndex(code))
            .sort((a, b) => a - b);

    let allPastRange = true;

    for (const day of periodDays) {
      if (day < startDay) continue;
      if (untilDay !== null && day > untilDay) continue;
      if (rule.count !== null && emitted >= rule.count) break;

      emitted += 1;
      if (day > rangeEnd) continue;

      allPastRange = false;
      if (day >= rangeStart) results.push(at(day));
    }

    if (rule.count !== null && emitted >= rule.count) break;
    if (untilDay !== null && periodDays.every((day) => day > untilDay)) break;
    if (results.length >= maxResults) break;
    // Dönemin tamamı aralığın ötesine geçtiyse durulur.
    if (allPastRange && periodDays.some((day) => day > rangeEnd)) break;
  }

  return results.slice(0, maxResults);
};
