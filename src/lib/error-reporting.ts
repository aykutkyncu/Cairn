/**
 * Hata raporu temizliği.
 *
 * Sentry (veya benzeri bir raporlayıcı) KURULU DEĞİLDİR: gerçek bir DSN,
 * hesap ve ücret değerlendirmesi gerektirir. Buradaki fonksiyonlar raporlayıcı
 * eklendiğinde `beforeSend` ve `beforeBreadcrumb` kancalarına doğrudan
 * bağlanmak üzere saf fonksiyon olarak yazılmıştır ve birim testleriyle
 * sınanır.
 *
 * Tasarım kararı: **alan adına göre değil, yapıya göre** temizlik yapılır.
 * "Adı `note` olan alanı sil" yaklaşımı, yarın eklenen `observation` alanını
 * kaçırır. Bunun yerine izin listesi (allowlist) uygulanır: yalnız hassas
 * OLMADIĞI bilinen anahtarlar geçer, geri kalan her şey düşer. Yeni bir alan
 * eklendiğinde varsayılan davranış "sızdır" değil, "düşür" olur.
 */

/** Raporlayıcıya gitmesine izin verilen bağlam anahtarları. */
const ALLOWED_CONTEXT_KEYS: ReadonlySet<string> = new Set([
  'event',
  'operation',
  'schema',
  'issueCount',
  'paths',
  'code',
  'status',
  'platform',
  'appVersion',
  'screen',
  'durationMs',
  'attempt',
  'failedSteps',
  'isOnline',
]);

/** İçeriği hiçbir koşulda taşınmayan istek/yanıt alanları. */
const DROPPED_EVENT_KEYS: ReadonlySet<string> = new Set([
  'request',
  'response',
  'body',
  'data',
  'extra',
  'user',
  'contexts',
]);

/** İzin verilen değerlerin ilkel tipleri. Nesne ve dizi geçmez. */
type SafeValue = string | number | boolean | null;

const isSafeValue = (value: unknown): value is SafeValue =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

/** Uzun bir dizgenin rapora gitmesine izin verilen azami uzunluğu. */
const MAX_VALUE_LENGTH = 200;

const truncate = (value: SafeValue): SafeValue =>
  typeof value === 'string' && value.length > MAX_VALUE_LENGTH
    ? `${value.slice(0, MAX_VALUE_LENGTH)}…`
    : value;

/**
 * Bir bağlam nesnesini izin listesine göre süzer.
 *
 * İzin listesinde olmayan her anahtar düşer; izin listesindeki bir anahtarın
 * değeri ilkel değilse (nesne/dizi) yine düşer — iç içe bir nesne, içinde ne
 * taşıdığı denetlenemeyecek bir yüktür.
 */
export const scrubContext = (
  context: Readonly<Record<string, unknown>>,
): Readonly<Record<string, SafeValue>> => {
  // Anahtar ve değer birlikte gezilir: dinamik indeksle okuma yapılmadığı
  // için prototip zincirinden bir değer okunması mümkün değildir.
  const safeEntries = Object.entries(context)
    .filter(([key]) => ALLOWED_CONTEXT_KEYS.has(key))
    .filter((entry): entry is [string, SafeValue] => isSafeValue(entry[1]))
    .map(([key, value]): [string, SafeValue] => [key, truncate(value)]);

  return Object.fromEntries(safeEntries);
};

/** Raporlayıcıya gönderilmeden önce temizlenmiş olay. */
export type ScrubbedEvent = {
  readonly message: string;
  readonly level: string;
  readonly tags: Readonly<Record<string, SafeValue>>;
};

/**
 * Mesaj metnindeki e-posta adresi gibi doğrudan tanımlayıcıları maskeler.
 *
 * Bu, izin listesinin YEDEĞİDİR, yerine geçmez: mesaj alanı serbest metindir
 * ve bir geliştirici oraya yanlışlıkla bir adres yazabilir.
 */
export const maskDirectIdentifiers = (text: string): string =>
  text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-posta]')
    .replace(/\+?\d[\d\s().-]{8,}\d/g, '[telefon]');

/**
 * Ham bir hata olayını raporlanabilir hale getirir.
 *
 * `beforeSend` kancasına bağlanır. İstek gövdesi, kullanıcı nesnesi ve serbest
 * `extra` alanları tamamen düşürülür; geriye yalnız olay adı, seviye ve izin
 * listesinden geçen etiketler kalır.
 */
export const scrubEvent = (event: Readonly<Record<string, unknown>>): ScrubbedEvent => {
  const rawMessage = typeof event.message === 'string' ? event.message : 'unknown_error';
  const rawLevel = typeof event.level === 'string' ? event.level : 'error';

  const tagSource =
    typeof event.tags === 'object' && event.tags !== null
      ? (event.tags as Readonly<Record<string, unknown>>)
      : {};

  return {
    message: maskDirectIdentifiers(rawMessage).slice(0, MAX_VALUE_LENGTH),
    level: rawLevel,
    tags: scrubContext(tagSource),
  };
};

/**
 * Bir breadcrumb'ın raporlanıp raporlanmayacağına karar verir.
 *
 * Ağ breadcrumb'ları düşürülür: URL yolu kaynak kimliği taşır ve sorgu
 * dizesi filtre değerlerini (hasta adı, tarih aralığı) içerebilir. Konsol
 * breadcrumb'ları da düşürülür; üretimde konsola kullanıcı verisi yazılmaz
 * ama bu varsayıma güvenilmez.
 */
export const shouldKeepBreadcrumb = (category: string): boolean =>
  category !== 'xhr' && category !== 'fetch' && category !== 'console';

/**
 * Olayda düşürülmesi gereken bir anahtarın kalıp kalmadığını denetler.
 *
 * Testler ve gözden geçirme için: temizlenmiş bir olayda bu anahtarlardan
 * hiçbiri bulunmamalıdır.
 */
export const containsDroppedKey = (event: Readonly<Record<string, unknown>>): boolean =>
  Object.keys(event).some((key) => DROPPED_EVENT_KEYS.has(key));

/** Raporlayıcı kurulu mu? Şu an her zaman false. */
export const isErrorReporterConfigured = false;
