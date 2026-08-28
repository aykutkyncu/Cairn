/**
 * Doğrulama koşucuları için ortak PGlite altyapısı.
 *
 * Supabase'in platform tarafından sağladığı asgari ortamı kurar, migration'ları
 * uygular ve rol/JWT bağlamı ile sorgu çalıştırmayı kolaylaştırır.
 *
 * Buradaki auth ve storage şemaları TAKLİTTİR. Supabase'in gerçek davranışı
 * yalnız CI'daki pgTAP koşusuyla kanıtlanır.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

const MIGRATIONS_DIR = 'supabase/migrations';

/** Supabase'in hazır sağladığı, migration'ların var saydığı asgari ortam. */
const SUPABASE_SHIM = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  create schema storage;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    created_at timestamptz not null default now()
  );

  -- Supabase'in auth.uid() fonksiyonu JWT claim'lerinden 'sub' okur.
  -- Dikkat: rollback sonrası özel GUC NULL değil BOŞ STRING döner; jsonb'ye
  -- çevirmeden önce nullif ile temizlenmezse "invalid input syntax for type
  -- json" hatası alınır.
  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $shim$
    select nullif(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
      ''
    )::uuid;
  $shim$;

  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[],
    created_at timestamptz not null default now()
  );

  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner uuid,
    created_at timestamptz not null default now()
  );

  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

/** Migration'lardan sonra Supabase'in verdiği tablo yetkilerini taklit eder. */
const GRANTS = `
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant select on all tables in schema public to anon;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant select on storage.buckets to authenticated;
  grant usage on all sequences in schema public to authenticated;
`;

export const APP_TABLES = [
  'profiles',
  'circles',
  'circle_members',
  'invitations',
  'tasks',
  'task_completions',
  'medications',
  'health_records',
  'documents',
  'expenses',
  'expense_splits',
  'settlements',
  'daily_digests',
  'device_push_tokens',
  'consents',
  'sync_tombstones',
  'audit_log',
];

export const IDS = {
  ownerA: '11111111-1111-1111-1111-111111111111',
  caregiverA: '22222222-2222-2222-2222-222222222222',
  viewerA: '33333333-3333-3333-3333-333333333333',
  ownerB: '44444444-4444-4444-4444-444444444444',
  newcomer: '55555555-5555-5555-5555-555555555555',
  circleA: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  circleB: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  taskA: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  docA: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
};

/** Basit sonuç toplayıcı. */
export const createReporter = () => {
  let passed = 0;
  const failures = [];

  return {
    check(name, condition, detail = '') {
      if (condition) {
        passed += 1;
        console.log(`  ok   ${name}`);
      } else {
        failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
        console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
      }
    },
    pass(name) {
      passed += 1;
      console.log(`  ok   ${name}`);
    },
    fail(name, detail = '') {
      failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
      console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
    },
    finish(title) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`${title} — Geçen: ${passed}   Başarısız: ${failures.length}`);
      if (failures.length > 0) {
        console.log('\nBaşarısız kontroller:');
        for (const failure of failures) console.log(`  - ${failure}`);
        process.exit(1);
      }
      console.log('\nTemiz (PGlite / PostgreSQL 18).');
      console.log(
        'NOT: auth ve storage şemaları asgari taklittir; Supabase’in gerçek davranışı CI’daki pgTAP paketiyle doğrulanır.',
      );
    },
  };
};

/** Şemayı kurar ve migration'ları sırayla uygular. */
export const bootstrap = async (reporter) => {
  const db = await PGlite.create();
  await db.exec(SUPABASE_SHIM);

  console.log('Migration uygulanıyor:');
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.exec(sql);
      reporter.pass(file);
    } catch (error) {
      reporter.fail(file, error.message);
      console.error(`\n${error.message}\n`);
      await db.close();
      reporter.finish('Migration');
      process.exit(1);
    }
  }

  await db.exec(GRANTS);
  return db;
};

/** Oturum bağlamını kalıcı olarak ayarlar (transaction dışı). */
export const loginAs = async (db, userId) => {
  await db.exec('set role authenticated');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
};

/** Oturumu kapatır ve postgres rolüne döner. */
export const logout = async (db) => {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', '', false)`);
};

/**
 * Verilen kullanıcı bağlamında bir işlem çalıştırır ve sonunda geri alır.
 * Yan etkisi kalıcı olmayan denemeler için kullanılır.
 */
export const asUser = async (db, userId, run) => {
  await db.exec('begin');
  await db.exec('set local role authenticated');
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
  try {
    return await run();
  } finally {
    await db.exec('rollback');
  }
};

/** Bir sorgunun reddedildiğini ve hangi SQLSTATE ile reddedildiğini döndürür. */
export const expectRejected = async (db, userId, sql, params = []) =>
  asUser(db, userId, async () => {
    try {
      await db.query(sql, params);
      return { rejected: false, code: null, message: '' };
    } catch (error) {
      return {
        rejected: true,
        code: error?.cause?.code ?? error?.code ?? null,
        message: error.message,
      };
    }
  });

/** Temel test kullanıcıları ve iki çember. */
export const seedBaseData = async (db) => {
  await db.exec(`
    insert into auth.users (id, email) values
      ('${IDS.ownerA}', 'owner-a@example.test'),
      ('${IDS.caregiverA}', 'caregiver-a@example.test'),
      ('${IDS.viewerA}', 'viewer-a@example.test'),
      ('${IDS.ownerB}', 'owner-b@example.test'),
      ('${IDS.newcomer}', 'newcomer@example.test');

    insert into public.profiles (id, display_name) values
      ('${IDS.ownerA}', 'Owner A'), ('${IDS.caregiverA}', 'Caregiver A'),
      ('${IDS.viewerA}', 'Viewer A'), ('${IDS.ownerB}', 'Owner B'),
      ('${IDS.newcomer}', 'Yeni Kullanıcı');

    insert into public.circles (id, care_recipient_name, timezone, created_by) values
      ('${IDS.circleA}', 'Bakılan Kişi A', 'Europe/Istanbul', '${IDS.ownerA}'),
      ('${IDS.circleB}', 'Bakılan Kişi B', 'Europe/Berlin', '${IDS.ownerB}');

    insert into public.circle_members (circle_id, user_id, role, invitation_state) values
      ('${IDS.circleA}', '${IDS.ownerA}', 'owner', 'active'),
      ('${IDS.circleA}', '${IDS.caregiverA}', 'caregiver', 'active'),
      ('${IDS.circleA}', '${IDS.viewerA}', 'viewer', 'active'),
      ('${IDS.circleB}', '${IDS.ownerB}', 'owner', 'active');
  `);
};
