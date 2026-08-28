/**
 * Cairn merkezi logger'ı.
 *
 * Sözleşme: sağlık verisi log'a yazılmaz. Bu modül üretimde yalnız uyarı ve hata
 * seviyesini geçirir, geliştirmede tüm seviyeleri konsola yazar. Log çağrılarına
 * hasta adı, ilaç, teşhis, not içeriği veya belge adı verilmemelidir; bunun yerine
 * kimlik (id) ve olay adı gibi hassas olmayan alanlar kullanılır.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Log kaydına eklenebilecek hassas olmayan bağlam alanları. */
export type LogContext = Readonly<Record<string, string | number | boolean | null>>;

// Map kullanılır: dinamik nesne indeksi prototype kirlenmesi riskini taşır.
const LEVEL_ORDER: ReadonlyMap<LogLevel, number> = new Map<LogLevel, number>([
  ['debug', 10],
  ['info', 20],
  ['warn', 30],
  ['error', 40],
]);

const levelWeight = (level: LogLevel): number => LEVEL_ORDER.get(level) ?? 0;

/** Üretimde yalnız warn ve üstü yazılır. */
const PRODUCTION_MIN_LEVEL: LogLevel = 'warn';
const DEVELOPMENT_MIN_LEVEL: LogLevel = 'debug';

const isDevelopment = (): boolean => process.env.NODE_ENV !== 'production';

/**
 * Test koşumunda log yazılmaz.
 *
 * Gerekçe: test çıktısı bir doğrulama aracıdır. Uygulama logları arasına
 * karışan bir hata mesajı fark edilmez hale gelir. Ayrıca beklenen hata
 * yollarını sınayan testler, gerçek bir sorun varmış gibi görünen çıktı
 * üretmemelidir.
 */
const isTestRun = (): boolean => process.env.NODE_ENV === 'test';

export const shouldLog = (level: LogLevel, development: boolean): boolean => {
  const minimum = development ? DEVELOPMENT_MIN_LEVEL : PRODUCTION_MIN_LEVEL;
  return levelWeight(level) >= levelWeight(minimum);
};

const write = (level: LogLevel, event: string, context?: LogContext): void => {
  if (isTestRun()) return;
  if (!shouldLog(level, isDevelopment())) return;

  const payload = context === undefined ? { event } : { event, ...context };

  switch (level) {
    case 'error':
      console.error(payload);
      return;
    case 'warn':
      console.warn(payload);
      return;
    default:
      console.log(payload);
  }
};

export const logger = {
  debug: (event: string, context?: LogContext): void => write('debug', event, context),
  info: (event: string, context?: LogContext): void => write('info', event, context),
  warn: (event: string, context?: LogContext): void => write('warn', event, context),
  error: (event: string, context?: LogContext): void => write('error', event, context),
} as const;
