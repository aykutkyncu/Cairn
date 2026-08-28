/**
 * Şema ve RLS doğrulaması — Docker gerektirmez.
 *
 * PGlite (PostgreSQL'in WASM derlemesi) üzerinde Supabase'in sağladığı asgari
 * ortamı kurar, migration'ları sırayla uygular ve RLS davranışını gerçek bir
 * Postgres motorunda sınar.
 *
 * NE DOĞRULAR:
 *   - Migration'lar sözdizimsel olarak geçerli ve doğru sırada mı
 *   - Her tabloda RLS + FORCE açık ve en az bir politika var mı
 *   - SECURITY DEFINER fonksiyonlarında search_path sabit, PUBLIC execute yok mu
 *   - Başka çemberin verisi görünüyor mu
 *   - viewer yazabiliyor mu, caregiver üye yönetebiliyor mu
 *   - Yetki yükseltme (kendini owner yapma) mümkün mü
 *   - Tamamlama tekilliği, tombstone üretimi, davet tekilliği
 *
 * NE DOĞRULAMAZ:
 *   - Supabase'in gerçek auth, storage ve realtime davranışı. Buradaki auth ve
 *     storage şemaları asgari TAKLİTTİR. Nihai kanıt, CI'daki `database` işinde
 *     gerçek Supabase yığınına karşı koşan pgTAP paketidir.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

const MIGRATIONS_DIR = 'supabase/migrations';

/**
 * Supabase'in hazır sağladığı, migration'ların var saydığı asgari ortam.
 * Gerçek Supabase'de bunlar platform tarafından kurulur.
 */
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

const APP_TABLES = [
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

const IDS = {
  ownerA: '11111111-1111-1111-1111-111111111111',
  caregiverA: '22222222-2222-2222-2222-222222222222',
  viewerA: '33333333-3333-3333-3333-333333333333',
  ownerB: '44444444-4444-4444-4444-444444444444',
  circleA: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  circleB: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  taskA: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  docA: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
};

let passed = 0;
const failures = [];

const check = (name, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

/** Verilen kullanıcı kimliğiyle authenticated rolünde bir işlem çalıştırır. */
const asUser = async (db, userId, run) => {
  await db.exec('begin');
  await db.exec(`set local role authenticated`);
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
  try {
    return await run();
  } finally {
    await db.exec('rollback');
  }
};

/** Bir sorgunun beklenen SQLSTATE ile reddedildiğini doğrular. */
const expectRejected = async (db, userId, sql, params) => {
  return asUser(db, userId, async () => {
    try {
      await db.query(sql, params);
      return { rejected: false, code: null };
    } catch (error) {
      const code = error?.cause?.code ?? error?.code ?? null;
      return { rejected: true, code, message: error.message };
    }
  });
};

const main = async () => {
  const db = await PGlite.create();

  console.log('Supabase asgari ortamı kuruluyor...');
  await db.exec(SUPABASE_SHIM);

  console.log('\nMigration uygulanıyor:');
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.exec(sql);
      console.log(`  ok   ${file}`);
      passed += 1;
    } catch (error) {
      console.log(`  FAIL ${file}`);
      console.error(`\n${error.message}\n`);
      failures.push(`${file} uygulanamadı: ${error.message}`);
      await db.close();
      return report();
    }
  }

  await db.exec(GRANTS);

  // -------------------------------------------------------------------------
  console.log('\n1. RLS yapılandırması');
  // -------------------------------------------------------------------------

  const rls = await db.query(
    `select relname, relrowsecurity, relforcerowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relname = any($1)`,
    [APP_TABLES],
  );

  check(
    'Tüm uygulama tabloları mevcut',
    rls.rows.length === APP_TABLES.length,
    `${rls.rows.length}/${APP_TABLES.length}`,
  );
  check(
    'Her tabloda RLS açık',
    rls.rows.every((r) => r.relrowsecurity),
    rls.rows
      .filter((r) => !r.relrowsecurity)
      .map((r) => r.relname)
      .join(', '),
  );
  check(
    'Her tabloda FORCE ROW LEVEL SECURITY açık',
    rls.rows.every((r) => r.relforcerowsecurity),
    rls.rows
      .filter((r) => !r.relforcerowsecurity)
      .map((r) => r.relname)
      .join(', '),
  );

  const policyless = await db.query(
    `select t.tablename from pg_tables t
     where t.schemaname = 'public' and t.tablename = any($1)
       and not exists (
         select 1 from pg_policies p
         where p.schemaname = t.schemaname and p.tablename = t.tablename
       )`,
    [APP_TABLES],
  );
  check(
    'Politikasız tablo yok',
    policyless.rows.length === 0,
    policyless.rows.map((r) => r.tablename).join(', '),
  );

  // -------------------------------------------------------------------------
  console.log('\n2. SECURITY DEFINER sertleştirmesi');
  // -------------------------------------------------------------------------

  const unsafeDefiners = await db.query(
    `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not exists (
         select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%'
       )`,
  );
  check(
    'search_path sabitlenmemiş SECURITY DEFINER yok',
    unsafeDefiners.rows.length === 0,
    unsafeDefiners.rows.map((r) => r.proname).join(', '),
  );

  const publicExec = await db.query(
    `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and has_function_privilege('public', p.oid, 'execute')`,
  );
  check(
    'SECURITY DEFINER fonksiyonlarında PUBLIC execute yok',
    publicExec.rows.length === 0,
    publicExec.rows.map((r) => r.proname).join(', '),
  );

  // -------------------------------------------------------------------------
  console.log('\n3. Test verisi (servis bağlamı)');
  // -------------------------------------------------------------------------

  await db.exec(`
    insert into auth.users (id, email) values
      ('${IDS.ownerA}', 'owner-a@example.test'),
      ('${IDS.caregiverA}', 'caregiver-a@example.test'),
      ('${IDS.viewerA}', 'viewer-a@example.test'),
      ('${IDS.ownerB}', 'owner-b@example.test');

    insert into public.profiles (id, display_name) values
      ('${IDS.ownerA}', 'Owner A'), ('${IDS.caregiverA}', 'Caregiver A'),
      ('${IDS.viewerA}', 'Viewer A'), ('${IDS.ownerB}', 'Owner B');

    insert into public.circles (id, care_recipient_name, timezone, created_by) values
      ('${IDS.circleA}', 'Bakılan Kişi A', 'Europe/Istanbul', '${IDS.ownerA}'),
      ('${IDS.circleB}', 'Bakılan Kişi B', 'Europe/Berlin', '${IDS.ownerB}');

    insert into public.circle_members (circle_id, user_id, role, invitation_state) values
      ('${IDS.circleA}', '${IDS.ownerA}', 'owner', 'active'),
      ('${IDS.circleA}', '${IDS.caregiverA}', 'caregiver', 'active'),
      ('${IDS.circleA}', '${IDS.viewerA}', 'viewer', 'active'),
      ('${IDS.circleB}', '${IDS.ownerB}', 'owner', 'active');

    insert into public.tasks (id, circle_id, title, dtstart_local_date, dtstart_local_time, created_by)
    values ('${IDS.taskA}', '${IDS.circleA}', 'Sabah ilacı', '2026-08-28', '08:00', '${IDS.ownerA}');

    insert into public.health_records (circle_id, record_type, title, body, created_by)
    values ('${IDS.circleA}', 'note', 'Tansiyon notu', 'Gizli sağlık metni', '${IDS.ownerA}');
  `);
  check('Test verisi yazıldı', true);

  // -------------------------------------------------------------------------
  console.log('\n4. Çember izolasyonu (B çemberi sahibi, A çemberine bakıyor)');
  // -------------------------------------------------------------------------

  const isolation = await asUser(db, IDS.ownerB, async () => ({
    circles: (await db.query(`select id from public.circles where id = $1`, [IDS.circleA])).rows
      .length,
    tasks: (await db.query(`select id from public.tasks where circle_id = $1`, [IDS.circleA])).rows
      .length,
    health: (
      await db.query(`select id from public.health_records where circle_id = $1`, [IDS.circleA])
    ).rows.length,
    members: (
      await db.query(`select id from public.circle_members where circle_id = $1`, [IDS.circleA])
    ).rows.length,
    invitations: (
      await db.query(`select id from public.invitations where circle_id = $1`, [IDS.circleA])
    ).rows.length,
    isMember: (await db.query(`select public.is_circle_member($1) as v`, [IDS.circleA])).rows[0].v,
    role: (await db.query(`select public.circle_role_of($1) as v`, [IDS.circleA])).rows[0].v,
  }));

  check('Yabancı çember görünmüyor', isolation.circles === 0, `${isolation.circles} satır`);
  check('Yabancı çemberin görevleri görünmüyor', isolation.tasks === 0);
  check('Yabancı çemberin sağlık kayıtları görünmüyor', isolation.health === 0);
  check('Yabancı çemberin üye listesi görünmüyor', isolation.members === 0);
  check('Yabancı çemberin davetleri görünmüyor', isolation.invitations === 0);
  check('is_circle_member yabancı çember için false', isolation.isMember === false);
  check('circle_role_of yabancı çember için null', isolation.role === null);

  const foreignWrite = await expectRejected(
    db,
    IDS.ownerB,
    `insert into public.tasks (circle_id, title, dtstart_local_date, dtstart_local_time)
     values ($1, 'Yetkisiz görev', '2026-08-29', '09:00')`,
    [IDS.circleA],
  );
  check(
    'Yabancı çembere yazma reddedildi',
    foreignWrite.rejected && foreignWrite.code === '42501',
    `kod=${foreignWrite.code}`,
  );

  // -------------------------------------------------------------------------
  console.log('\n5. Viewer okur, yazamaz');
  // -------------------------------------------------------------------------

  const viewerReads = await asUser(db, IDS.viewerA, async () => ({
    tasks: (await db.query(`select id from public.tasks where circle_id = $1`, [IDS.circleA])).rows
      .length,
    canWrite: (await db.query(`select public.can_write_circle($1) as v`, [IDS.circleA])).rows[0].v,
  }));
  check('Viewer kendi çemberinin görevlerini okuyabiliyor', viewerReads.tasks === 1);
  check('can_write_circle viewer için false', viewerReads.canWrite === false);

  const viewerTask = await expectRejected(
    db,
    IDS.viewerA,
    `insert into public.tasks (circle_id, title, dtstart_local_date, dtstart_local_time)
     values ($1, 'Viewer görevi', '2026-08-29', '09:00')`,
    [IDS.circleA],
  );
  check(
    'Viewer görev ekleyemiyor',
    viewerTask.rejected && viewerTask.code === '42501',
    `kod=${viewerTask.code}`,
  );

  const viewerRecord = await expectRejected(
    db,
    IDS.viewerA,
    `insert into public.health_records (circle_id, record_type, title) values ($1, 'note', 'Viewer notu')`,
    [IDS.circleA],
  );
  check(
    'Viewer sağlık kaydı ekleyemiyor',
    viewerRecord.rejected && viewerRecord.code === '42501',
    `kod=${viewerRecord.code}`,
  );

  // -------------------------------------------------------------------------
  console.log('\n6. Caregiver içerik yazar, üye yönetemez');
  // -------------------------------------------------------------------------

  const caregiverWrite = await asUser(db, IDS.caregiverA, async () => {
    await db.query(
      `insert into public.health_records (circle_id, record_type, title, created_by)
       values ($1, 'note', 'Caregiver notu', $2)`,
      [IDS.circleA, IDS.caregiverA],
    );
    return (await db.query(`select public.is_circle_owner($1) as v`, [IDS.circleA])).rows[0].v;
  });
  check('Caregiver sağlık kaydı ekleyebiliyor', true);
  check('is_circle_owner caregiver için false', caregiverWrite === false);

  const caregiverMember = await expectRejected(
    db,
    IDS.caregiverA,
    `insert into public.circle_members (circle_id, user_id, role) values ($1, $2, 'viewer')`,
    [IDS.circleA, IDS.ownerB],
  );
  check(
    'Caregiver üye ekleyemiyor',
    caregiverMember.rejected && caregiverMember.code === '42501',
    `kod=${caregiverMember.code}`,
  );

  // -------------------------------------------------------------------------
  console.log('\n7. Yetki yükseltme engelleniyor');
  // -------------------------------------------------------------------------

  const escalation = await expectRejected(
    db,
    IDS.caregiverA,
    `update public.circle_members set role = 'owner' where circle_id = $1 and user_id = $2`,
    [IDS.circleA, IDS.caregiverA],
  );
  check(
    'Caregiver kendini owner yapamıyor',
    escalation.rejected && escalation.code === '42501',
    `kod=${escalation.code}`,
  );

  const leave = await asUser(db, IDS.caregiverA, async () => {
    const r = await db.query(
      `update public.circle_members set deleted_at = now()
       where circle_id = $1 and user_id = $2 returning id`,
      [IDS.circleA, IDS.caregiverA],
    );
    return r.rows.length;
  });
  check('Caregiver kendi üyeliğini bırakabiliyor', leave === 1);

  // -------------------------------------------------------------------------
  console.log('\n8. Owner üye yönetimi');
  // -------------------------------------------------------------------------

  const ownerManage = await asUser(db, IDS.ownerA, async () => {
    const isOwner = (await db.query(`select public.is_circle_owner($1) as v`, [IDS.circleA]))
      .rows[0].v;
    const roleChange = await db.query(
      `update public.circle_members set role = 'caregiver'
       where circle_id = $1 and user_id = $2 returning id`,
      [IDS.circleA, IDS.viewerA],
    );
    const removal = await db.query(
      `update public.circle_members set deleted_at = now(), invitation_state = 'removed'
       where circle_id = $1 and user_id = $2 returning id`,
      [IDS.circleA, IDS.viewerA],
    );
    return { isOwner, roleChanged: roleChange.rows.length, removed: removal.rows.length };
  });
  check('is_circle_owner owner için true', ownerManage.isOwner === true);
  check('Owner üye rolünü değiştirebiliyor', ownerManage.roleChanged === 1);
  check('Owner üyeyi çıkarabiliyor', ownerManage.removed === 1);

  // -------------------------------------------------------------------------
  console.log('\n9. Davet gizliliği');
  // -------------------------------------------------------------------------

  const plaintextColumns = await db.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'invitations'
       and column_name in ('token', 'plain_token', 'invite_code', 'secret')`,
  );
  check(
    'invitations tablosunda düz token sütunu yok',
    plaintextColumns.rows.length === 0,
    plaintextColumns.rows.map((r) => r.column_name).join(', '),
  );

  const tokenType = await db.query(
    `select data_type from information_schema.columns
     where table_schema = 'public' and table_name = 'invitations' and column_name = 'token_hash'`,
  );
  check(
    'token_hash bytea olarak saklanıyor',
    tokenType.rows[0]?.data_type === 'bytea',
    tokenType.rows[0]?.data_type,
  );

  await db.exec(`
    insert into public.invitations (circle_id, token_hash, expires_at, created_by)
    values ('${IDS.circleA}', decode('deadbeef', 'hex'), now() + interval '7 days', '${IDS.ownerA}');
  `);

  let duplicateRejected = false;
  let duplicateCode = null;
  try {
    await db.exec(`
      insert into public.invitations (circle_id, token_hash, expires_at, created_by)
      values ('${IDS.circleA}', decode('deadbeef', 'hex'), now() + interval '7 days', '${IDS.ownerA}');
    `);
  } catch (error) {
    duplicateRejected = true;
    duplicateCode = error?.cause?.code ?? error?.code ?? null;
  }
  check(
    'Aynı davet hash’i iki kez kaydedilemiyor',
    duplicateRejected && duplicateCode === '23505',
    `kod=${duplicateCode}`,
  );

  // -------------------------------------------------------------------------
  console.log('\n10. Storage yol çözümü ve bucket gizliliği');
  // -------------------------------------------------------------------------

  const bucket = await db.query(`select public from storage.buckets where id = 'documents'`);
  check('documents bucket’ı private', bucket.rows[0]?.public === false);

  const pathValid = await db.query(`select public.storage_path_circle_id($1) as v`, [
    `${IDS.circleA}/9f1c.jpg`,
  ]);
  check('Geçerli nesne yolu çember kimliğine çözülüyor', pathValid.rows[0].v === IDS.circleA);

  const pathInvalid = await db.query(`select public.storage_path_circle_id($1) as v`, [
    'not-a-uuid/photo.jpg',
  ]);
  check('Geçersiz nesne yolu null dönüyor', pathInvalid.rows[0].v === null);

  const pathNoFolder = await db.query(`select public.storage_path_circle_id($1) as v`, [
    'photo.jpg',
  ]);
  check('Klasörsüz nesne yolu null dönüyor', pathNoFolder.rows[0].v === null);

  // -------------------------------------------------------------------------
  console.log('\n11. Tombstone, tamamlama tekilliği, revision');
  // -------------------------------------------------------------------------

  await db.exec(`
    insert into public.documents (id, circle_id, object_path, original_filename, mime_type, byte_size, created_by)
    values ('${IDS.docA}', '${IDS.circleA}', '${IDS.circleA}/9f1c.jpg', 'recete.jpg', 'image/jpeg', 204800, '${IDS.ownerA}');
    update public.documents set deleted_at = now() where id = '${IDS.docA}';
  `);
  const tombstone = await db.query(
    `select id from public.sync_tombstones where entity_table = 'documents' and entity_id = $1`,
    [IDS.docA],
  );
  check('Yumuşak silme tombstone üretiyor', tombstone.rows.length === 1);

  const revision = await db.query(`select revision from public.documents where id = $1`, [
    IDS.docA,
  ]);
  check(
    'Güncelleme revision’ı artırıyor',
    revision.rows[0].revision === 2,
    `revision=${revision.rows[0].revision}`,
  );

  await db.exec(`
    insert into public.task_completions (circle_id, task_id, occurrence_id, mutation_id, created_by)
    values ('${IDS.circleA}', '${IDS.taskA}', '2026-08-28T08:00:00+03:00', gen_random_uuid(), '${IDS.ownerA}');
  `);

  let dupCompletion = false;
  let dupCompletionCode = null;
  try {
    await db.exec(`
      insert into public.task_completions (circle_id, task_id, occurrence_id, mutation_id)
      values ('${IDS.circleA}', '${IDS.taskA}', '2026-08-28T08:00:00+03:00', gen_random_uuid());
    `);
  } catch (error) {
    dupCompletion = true;
    dupCompletionCode = error?.cause?.code ?? error?.code ?? null;
  }
  check(
    'Aynı occurrence ikinci kez tamamlanamıyor',
    dupCompletion && dupCompletionCode === '23505',
    `kod=${dupCompletionCode}`,
  );

  // -------------------------------------------------------------------------
  console.log('\n12. Denetim kaydı ve para bütünlüğü');
  // -------------------------------------------------------------------------

  const audit = await db.query(
    `select count(*)::int as n from public.audit_log where circle_id = $1`,
    [IDS.circleA],
  );
  check('Yazma işlemleri denetim kaydı üretiyor', audit.rows[0].n > 0, `${audit.rows[0].n} olay`);

  const auditValues = await db.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'audit_log'
       and column_name in ('old_value', 'new_value', 'row_data', 'payload')`,
  );
  check('Denetim kaydı satır içeriği saklamıyor', auditValues.rows.length === 0);

  const expenseId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  await db.exec(`
    insert into public.expenses (id, circle_id, amount_minor, currency, spent_on, category, paid_by, created_by)
    values ('${expenseId}', '${IDS.circleA}', 10000, 'TRY', '2026-08-28', 'ilaç', '${IDS.ownerA}', '${IDS.ownerA}');
    insert into public.expense_splits (expense_id, circle_id, member_user_id, share_minor) values
      ('${expenseId}', '${IDS.circleA}', '${IDS.ownerA}', 3334),
      ('${expenseId}', '${IDS.circleA}', '${IDS.caregiverA}', 3333),
      ('${expenseId}', '${IDS.circleA}', '${IDS.viewerA}', 3333);
  `);
  const balanced = await db.query(`select public.expense_split_is_balanced($1) as v`, [expenseId]);
  check('100 TL üç kişiye bölündüğünde kuruş kaybı yok', balanced.rows[0].v === true);

  const moneyTypes = await db.query(
    `select data_type from information_schema.columns
     where table_schema = 'public' and column_name in ('amount_minor', 'share_minor')`,
  );
  check(
    'Tüm para alanları integer türünde',
    moneyTypes.rows.every((r) => r.data_type === 'bigint'),
    moneyTypes.rows.map((r) => r.data_type).join(', '),
  );

  await db.close();
  report();
};

const report = () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Geçen: ${passed}   Başarısız: ${failures.length}`);
  if (failures.length > 0) {
    console.log('\nBaşarısız kontroller:');
    for (const failure of failures) console.log(`  - ${failure}`);
    console.log(
      '\nNOT: Bu koşucu Supabase auth/storage şemalarını TAKLİT eder. Nihai kanıt CI’daki pgTAP paketidir.',
    );
    process.exit(1);
  }
  console.log('\nŞema ve RLS doğrulaması temiz (PGlite / PostgreSQL 18).');
  console.log(
    'NOT: auth ve storage şemaları asgari taklittir; Supabase’in gerçek davranışı CI’daki pgTAP paketiyle doğrulanır.',
  );
};

try {
  await main();
} catch (error) {
  console.error(`
Beklenmeyen hata: ${error.message}`);
  if (error.query) console.error(`Sorgu: ${error.query}`);
  process.exit(1);
}
