/**
 * Migration'lar üzerinde statik tutarlılık kontrolü.
 *
 * Bu bir SQL yorumlayıcısı DEĞİLDİR ve gerçek bir veritabanına uygulamanın
 * yerine geçmez. Yalnız migration sırasından kaynaklanan, CI'da veritabanı
 * ayağa kalkana kadar görülmeyen sınıf hataları yakalar:
 *
 *   1. Dengesiz dollar-quote ($$) blokları
 *   2. Henüz oluşturulmamış bir tabloya politika/trigger/alter uygulanması
 *   3. Tanımlanmamış bir yardımcı fonksiyonun politikada kullanılması
 *   4. Tanımlanmamış bir enum türünün sütunda kullanılması
 *   5. search_path sabitlenmemiş SECURITY DEFINER fonksiyonu
 *
 * Gerçek doğrulama CI'daki `database` işidir (supabase db start + test db).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = 'supabase/migrations';

/** Postgres'in kendi sağladığı, migration'da tanımlanmayan şemalar. */
const EXTERNAL_TABLES = new Set(['auth.users', 'storage.objects', 'storage.buckets']);

/** Migration dışında var olan fonksiyonlar. */
const EXTERNAL_FUNCTIONS = new Set(['auth.uid', 'now', 'coalesce', 'nullif']);

const files = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error('supabase/migrations altında .sql dosyası bulunamadı.');
  process.exit(1);
}

const knownTables = new Set(EXTERNAL_TABLES);
const knownFunctions = new Set(EXTERNAL_FUNCTIONS);
const knownTypes = new Set();
const problems = [];

/** Yorum satırlarını ve string literal'leri kabaca temizler. */
const stripNoise = (sql) => sql.replace(/--[^\n]*/g, ' ').replace(/'(?:[^']|'')*'/g, "''");

for (const file of files) {
  const path = join(MIGRATIONS_DIR, file);
  const raw = readFileSync(path, 'utf8');

  // 1. Dollar-quote dengesi
  const dollarQuotes = raw.match(/\$\$/g) ?? [];
  if (dollarQuotes.length % 2 !== 0) {
    problems.push(`${file}: dengesiz $$ bloğu (${dollarQuotes.length} adet)`);
  }

  const sql = stripNoise(raw);

  // Bu dosyada oluşturulanları, kullanımları denetlemeden ÖNCE kaydet:
  // aynı dosya içinde tablo tanımı politikadan önce gelir.
  for (const match of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)/gi)) {
    knownTables.add(match[1].toLowerCase());
  }
  for (const match of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([\w.]+)\s*\(/gi)) {
    knownFunctions.add(match[1].toLowerCase());
  }
  for (const match of sql.matchAll(/create\s+type\s+([\w.]+)\s+as\s+enum/gi)) {
    knownTypes.add(match[1].toLowerCase());
  }

  // 2. Tabloya uygulanan işlemler
  const tableUses = [
    ...sql.matchAll(/create\s+policy\s+[\w]+\s+on\s+([\w.]+)/gi),
    ...sql.matchAll(/alter\s+table\s+([\w.]+)/gi),
    ...sql.matchAll(/create\s+(?:unique\s+)?index\s+[\w]+\s+on\s+([\w.]+)/gi),
    ...sql.matchAll(/create\s+trigger\s+[\w]+\s+(?:before|after)\s+[\w\s]+?\s+on\s+([\w.]+)/gi),
    ...sql.matchAll(/references\s+([\w.]+)\s*\(/gi),
  ];

  for (const match of tableUses) {
    const table = match[1].toLowerCase();
    if (!knownTables.has(table)) {
      problems.push(`${file}: "${table}" tablosu bu noktada henüz tanımlı değil`);
    }
  }

  // 3. Politikalarda kullanılan public.* fonksiyonları
  for (const match of sql.matchAll(/\b(public\.[a-z_]+)\s*\(/gi)) {
    const fn = match[1].toLowerCase();
    // Tablo adıyla çakışanları (public.tasks gibi) atla.
    if (knownTables.has(fn) || knownTypes.has(fn)) continue;
    if (!knownFunctions.has(fn)) {
      problems.push(`${file}: "${fn}" fonksiyonu bu noktada henüz tanımlı değil`);
    }
  }

  // 4. Sütunlarda kullanılan enum türleri
  for (const match of sql.matchAll(/\b(public\.[a-z_]+)\s+not\s+null/gi)) {
    const type = match[1].toLowerCase();
    if (!knownTypes.has(type)) {
      problems.push(`${file}: "${type}" enum türü bu noktada henüz tanımlı değil`);
    }
  }

  // 5. SECURITY DEFINER + search_path
  const definerBlocks = raw.split(/create\s+or\s+replace\s+function|create\s+function/i).slice(1);
  for (const block of definerBlocks) {
    const header = block.split('$$')[0] ?? '';
    if (/security\s+definer/i.test(header) && !/set\s+search_path\s*=/i.test(header)) {
      const name = (block.match(/^\s*([\w.]+)/) ?? [])[1] ?? '(bilinmeyen)';
      problems.push(`${file}: ${name} SECURITY DEFINER fakat search_path sabitlenmemiş`);
    }
  }
}

console.log(`Denetlenen migration: ${files.length}`);
console.log(`Tanımlanan tablo: ${knownTables.size - EXTERNAL_TABLES.size}`);
console.log(`Tanımlanan fonksiyon: ${knownFunctions.size - EXTERNAL_FUNCTIONS.size}`);
console.log(`Tanımlanan enum: ${knownTypes.size}`);

if (problems.length > 0) {
  console.error('\nBulgular:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log('\nStatik kontrol temiz. NOT: bu, gerçek veritabanına uygulamanın yerine geçmez.');
