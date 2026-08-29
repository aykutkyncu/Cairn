import {
  formatOffset,
  offsetMinutesAt,
  parseLocalDate,
  parseLocalTime,
  safeTimeZone,
  toWallClock,
  wallClockToInstant,
  type WallClock,
} from './timezone';

/**
 * Occurrence kimliği.
 *
 * Kanonik biçim: **çemberin zaman dilimindeki yerel başlangıç anı, ISO-8601
 * ofsetli** — örn. `2026-08-28T08:00:00+03:00`. Bu biçim
 * `supabase/migrations/0004_care.sql` içindeki sözleşmeyle aynıdır.
 *
 * Neden ofsetli yerel an, düz UTC değil: kimlik hem tekil olmalı hem de bir
 * insanın bakıp "hangi gün, hangi saat" diyebileceği kadar okunur olmalıdır.
 * Düz UTC, DST geçişinde iki farklı duvar saatini aynı görünüme sokabilir;
 * ofset onları ayırır.
 *
 * Neden dakika çözünürlüğü: görev saatleri dakika hassasiyetindedir. Saniye
 * taşımak, aynı örneğin iki farklı kimlikle kaydedilme riskini getirir.
 */

/** Sunucu şemasının kabul ettiği azami uzunluk (`0004_care.sql`). */
export const OCCURRENCE_ID_MAX_LENGTH = 40;

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

/** Duvar saatinden kanonik occurrence kimliği üretir. */
export const buildOccurrenceId = (clock: WallClock, timeZone: string): string => {
  const zone = safeTimeZone(timeZone);
  const instant = wallClockToInstant(clock, zone);
  // Ofset, çözülmüş ANIN ofsetidir: DST'de var olmayan bir duvar saati
  // kaydırıldıysa kimlik de kaydırılmış gerçek anı gösterir.
  const resolved = toWallClock(instant, zone);
  const offset = offsetMinutesAt(instant, zone);

  return (
    `${pad(resolved.year, 4)}-${pad(resolved.month)}-${pad(resolved.day)}` +
    `T${pad(resolved.hour)}:${pad(resolved.minute)}:00${formatOffset(offset)}`
  );
};

/** Görev satırındaki yerel tarih/saatten occurrence kimliği üretir. */
export const occurrenceIdFromLocalParts = (
  localDate: string,
  localTime: string,
  timeZone: string,
): string => {
  const date = parseLocalDate(localDate);
  const time = parseLocalTime(localTime);
  return buildOccurrenceId({ ...date, ...time }, timeZone);
};

/** Kanonik biçime uygunluğu denetler. */
export const isValidOccurrenceId = (value: string): boolean =>
  value.length <= OCCURRENCE_ID_MAX_LENGTH &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00[+-]\d{2}:\d{2}$/.test(value);

/**
 * Occurrence kimliğini mutlak ana çevirir.
 *
 * Sıralama ve gecikme hesabı için kullanılır. Kimliğin kendi ofseti taşınır;
 * çemberin bugünkü ofseti değil — geçmiş bir kayıt, o günün ofsetiyle
 * yorumlanmalıdır.
 */
export const occurrenceIdToInstant = (occurrenceId: string): Date | null =>
  isValidOccurrenceId(occurrenceId) ? new Date(occurrenceId) : null;

/** Occurrence kimliğinden yerel gün (`YYYY-MM-DD`). */
export const occurrenceLocalDate = (occurrenceId: string): string | null =>
  isValidOccurrenceId(occurrenceId) ? occurrenceId.slice(0, 10) : null;
