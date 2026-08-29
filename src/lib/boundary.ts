import type { z } from 'zod';

import { logger } from './logger';

/**
 * Sınır doğrulaması.
 *
 * Sözleşme gereği sunucudan gelen her değer, kullanıldığı sınırda Zod ile
 * doğrulanır. Bu modül doğrulamanın TEK giriş noktasıdır; böylece "parse
 * hatası hassas içerik sızdırmadan raporlanır" kuralı tek yerde uygulanır.
 *
 * Zod'un hata nesnesi, doğrulanan değerin kendisini (`input`) ve alan
 * yollarını taşır. Sağlık verisi için bu doğrudan sızıntıdır: bir not
 * alanının içeriği hata mesajına, oradan da hata raporuna düşebilir. Bu
 * yüzden buradan dışarıya YALNIZ şema adı, işlem adı ve alan yolu çıkar —
 * değerin kendisi hiçbir koşulda çıkmaz.
 */

/** Sınır doğrulamasının sonucu. Hata durumunda hassas içerik taşımaz. */
export type BoundaryResult<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly issue: BoundaryIssue };

/** Hata raporuna ve loglara gitmesi güvenli olan tek gösterim. */
export type BoundaryIssue = {
  /** Doğrulamayı yapan şemanın adı, örn. `circle`. */
  readonly schema: string;
  /** Doğrulamanın yapıldığı işlem, örn. `list_circles`. */
  readonly operation: string;
  /** Kaç alanın doğrulamayı geçemediği. */
  readonly issueCount: number;
  /**
   * Başarısız alan yolları, örn. `["timezone", "members.0.role"]`.
   *
   * Yalnız YOL taşınır; alanın değeri taşınmaz. Dizi indeksleri sayıya
   * indirgenir, çünkü bir Zod yolu teorik olarak nesne anahtarı da olabilir.
   */
  readonly paths: readonly string[];
};

/** En fazla kaç alan yolu raporlanır. Uzun listeler tanılamaya değer katmaz. */
const MAX_REPORTED_PATHS = 10;

const formatPath = (path: readonly PropertyKey[]): string =>
  path.length === 0 ? '(kök)' : path.map((segment) => String(segment)).join('.');

/**
 * Değeri şemayla doğrular; hata durumunda hassas içerik taşımayan bir sorun
 * nesnesi döndürür.
 *
 * Fırlatmaz: sınır doğrulaması beklenen bir yol ayrımıdır, istisnai bir durum
 * değildir. Çağıran taraf sonucu açıkça ele almak zorundadır.
 *
 * @param schema Zod şeması.
 * @param schemaName Rapora yazılacak şema adı. Şema nesnesinden güvenilir
 *   biçimde okunamadığı için açıkça verilir.
 * @param operation Doğrulamanın yapıldığı işlem adı.
 * @param value Doğrulanacak değer. Bu değer HİÇBİR koşulda loglanmaz.
 */
export const parseAtBoundary = <T>(
  schema: z.ZodType<T>,
  schemaName: string,
  operation: string,
  value: unknown,
): BoundaryResult<T> => {
  const result = schema.safeParse(value);

  if (result.success) return { ok: true, data: result.data };

  const paths = result.error.issues
    .slice(0, MAX_REPORTED_PATHS)
    .map((issue) => formatPath(issue.path));

  const issue: BoundaryIssue = {
    schema: schemaName,
    operation,
    issueCount: result.error.issues.length,
    paths,
  };

  // Yalnız şema adı, işlem ve alan yolları. Zod'un mesajı bilinçli olarak
  // dışarıda bırakılır: mesaj metni doğrulanan değeri içerebilir.
  logger.warn('boundary_parse_failed', {
    schema: issue.schema,
    operation: issue.operation,
    issueCount: issue.issueCount,
    paths: issue.paths.join(','),
  });

  return { ok: false, issue };
};
