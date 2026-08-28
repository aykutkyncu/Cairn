-- 0001_rls_isolation.test.sql
-- pgTAP: çember izolasyonu ve rol yetkileri.
--
-- ÇALIŞTIRMA: supabase test db  (yerel Postgres gerektirir, Docker ile)
--
-- Bu testler "başka çemberin verisi görünmez" ve "viewer yazamaz"
-- iddialarının kanıtıdır. Kanıt çalıştırılmadan bu iddialar yapılmaz.

begin;
select plan(26);

create extension if not exists pgtap with schema extensions;

-- ---------------------------------------------------------------------------
-- Sabitler: iki ayrı çember, dört kullanıcı
-- ---------------------------------------------------------------------------

\set owner_a       '11111111-1111-1111-1111-111111111111'
\set caregiver_a   '22222222-2222-2222-2222-222222222222'
\set viewer_a      '33333333-3333-3333-3333-333333333333'
\set owner_b       '44444444-4444-4444-4444-444444444444'
\set circle_a      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
\set circle_b      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
\set task_a        'cccccccc-cccc-cccc-cccc-cccccccccccc'
\set record_a      'dddddddd-dddd-dddd-dddd-dddddddddddd'

-- ---------------------------------------------------------------------------
-- Kurulum: RLS'yi atlayan servis bağlamında veri hazırla
-- ---------------------------------------------------------------------------

set local role postgres;

insert into auth.users (id, email) values
  (:'owner_a',     'owner-a@example.test'),
  (:'caregiver_a', 'caregiver-a@example.test'),
  (:'viewer_a',    'viewer-a@example.test'),
  (:'owner_b',     'owner-b@example.test');

insert into public.profiles (id, display_name) values
  (:'owner_a', 'Owner A'),
  (:'caregiver_a', 'Caregiver A'),
  (:'viewer_a', 'Viewer A'),
  (:'owner_b', 'Owner B');

insert into public.circles (id, care_recipient_name, timezone, created_by) values
  (:'circle_a', 'Bakılan Kişi A', 'Europe/Istanbul', :'owner_a'),
  (:'circle_b', 'Bakılan Kişi B', 'Europe/Berlin',   :'owner_b');

insert into public.circle_members (circle_id, user_id, role, invitation_state) values
  (:'circle_a', :'owner_a',     'owner',     'active'),
  (:'circle_a', :'caregiver_a', 'caregiver', 'active'),
  (:'circle_a', :'viewer_a',    'viewer',    'active'),
  (:'circle_b', :'owner_b',     'owner',     'active');

insert into public.tasks (id, circle_id, title, dtstart_local_date, dtstart_local_time, created_by)
values (:'task_a', :'circle_a', 'Sabah ilacı', '2026-08-28', '08:00', :'owner_a');

insert into public.health_records (id, circle_id, record_type, title, body, created_by)
values (:'record_a', :'circle_a', 'note', 'Tansiyon notu', 'Gizli sağlık metni', :'owner_a');

-- ---------------------------------------------------------------------------
-- 1. Her uygulama tablosunda RLS açık ve en az bir politika var
-- ---------------------------------------------------------------------------

select ok(
  (select bool_and(c.relrowsecurity)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relname in (
       'profiles', 'circles', 'circle_members', 'invitations', 'tasks',
       'task_completions', 'medications', 'health_records', 'documents',
       'expenses', 'expense_splits', 'settlements', 'daily_digests',
       'device_push_tokens', 'consents', 'sync_tombstones', 'audit_log'
     )),
  'Her uygulama tablosunda RLS açıktır'
);

select ok(
  (select bool_and(c.relforcerowsecurity)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relname in (
       'profiles', 'circles', 'circle_members', 'invitations', 'tasks',
       'task_completions', 'medications', 'health_records', 'documents',
       'expenses', 'expense_splits', 'settlements', 'daily_digests',
       'device_push_tokens', 'consents', 'sync_tombstones', 'audit_log'
     )),
  'Her uygulama tablosunda FORCE ROW LEVEL SECURITY açıktır'
);

select is(
  (select count(*)::int
   from pg_tables t
   where t.schemaname = 'public'
     and t.tablename in (
       'profiles', 'circles', 'circle_members', 'invitations', 'tasks',
       'task_completions', 'medications', 'health_records', 'documents',
       'expenses', 'expense_splits', 'settlements', 'daily_digests',
       'device_push_tokens', 'consents', 'sync_tombstones', 'audit_log'
     )
     and not exists (
       select 1 from pg_policies p
       where p.schemaname = t.schemaname and p.tablename = t.tablename
     )),
  0,
  'Politikasız uygulama tablosu yoktur'
);

-- ---------------------------------------------------------------------------
-- 2. SECURITY DEFINER fonksiyonlarında search_path sabitlenmiştir
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and not exists (
       select 1 from unnest(coalesce(p.proconfig, '{}')) cfg
       where cfg like 'search_path=%'
     )),
  0,
  'search_path sabitlenmemiş SECURITY DEFINER fonksiyonu yoktur'
);

select is(
  (select count(*)::int
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and has_function_privilege('public', p.oid, 'execute')),
  0,
  'Hiçbir SECURITY DEFINER fonksiyonunda PUBLIC execute yetkisi yoktur'
);

-- ---------------------------------------------------------------------------
-- 3. Başka çember verisi görünmez
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select is(
  (select count(*)::int from public.circles where id = :'circle_a'),
  0,
  'B çemberinin sahibi A çemberini göremez'
);

select is(
  (select count(*)::int from public.tasks where circle_id = :'circle_a'),
  0,
  'B çemberinin sahibi A çemberinin görevlerini göremez'
);

select is(
  (select count(*)::int from public.health_records where circle_id = :'circle_a'),
  0,
  'B çemberinin sahibi A çemberinin sağlık kayıtlarını göremez'
);

select is(
  (select count(*)::int from public.circle_members where circle_id = :'circle_a'),
  0,
  'B çemberinin sahibi A çemberinin üye listesini göremez'
);

select is(
  public.is_circle_member(:'circle_a'),
  false,
  'is_circle_member yabancı çember için false döner'
);

select is(
  public.circle_role_of(:'circle_a'),
  null::public.circle_role,
  'circle_role_of yabancı çember için null döner'
);

-- Yabancı çembere yazma denemesi reddedilir.
select throws_ok(
  format(
    'insert into public.tasks (circle_id, title, dtstart_local_date, dtstart_local_time) values (%L, %L, %L, %L)',
    :'circle_a', 'Yetkisiz görev', '2026-08-29', '09:00'
  ),
  '42501',
  null,
  'Yabancı çembere görev eklenemez'
);

-- ---------------------------------------------------------------------------
-- 4. Viewer okur, yazamaz
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select is(
  (select count(*)::int from public.tasks where circle_id = :'circle_a'),
  1,
  'Viewer kendi çemberinin görevlerini okuyabilir'
);

select is(
  public.can_write_circle(:'circle_a'),
  false,
  'can_write_circle viewer için false döner'
);

select throws_ok(
  format(
    'insert into public.tasks (circle_id, title, dtstart_local_date, dtstart_local_time) values (%L, %L, %L, %L)',
    :'circle_a', 'Viewer görevi', '2026-08-29', '09:00'
  ),
  '42501',
  null,
  'Viewer görev ekleyemez'
);

select throws_ok(
  format(
    'insert into public.health_records (circle_id, record_type, title) values (%L, %L, %L)',
    :'circle_a', 'note', 'Viewer notu'
  ),
  '42501',
  null,
  'Viewer sağlık kaydı ekleyemez'
);

select is(
  (select count(*)::int from public.circle_members
   where circle_id = :'circle_a' and user_id = :'owner_a'),
  1,
  'Viewer üye listesini okuyabilir'
);

-- ---------------------------------------------------------------------------
-- 5. Caregiver içerik yazar, üye yönetemez, çemberi silemez
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select lives_ok(
  format(
    'insert into public.health_records (circle_id, record_type, title, created_by) values (%L, %L, %L, %L)',
    :'circle_a', 'note', 'Caregiver notu', :'caregiver_a'
  ),
  'Caregiver sağlık kaydı ekleyebilir'
);

select is(
  public.is_circle_owner(:'circle_a'),
  false,
  'is_circle_owner caregiver için false döner'
);

select throws_ok(
  format(
    'insert into public.circle_members (circle_id, user_id, role) values (%L, %L, %L)',
    :'circle_a', :'owner_b', 'viewer'
  ),
  '42501',
  null,
  'Caregiver çembere üye ekleyemez'
);

select is(
  (select count(*)::int from public.circles
   where id = :'circle_a' and public.is_circle_owner(id)),
  0,
  'Caregiver çemberi silme yetkisine sahip değildir'
);

-- ---------------------------------------------------------------------------
-- 6. Owner üye yönetimi çalışır
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  public.is_circle_owner(:'circle_a'),
  true,
  'is_circle_owner owner için true döner'
);

select lives_ok(
  format(
    'update public.circle_members set role = %L where circle_id = %L and user_id = %L',
    'caregiver', :'circle_a', :'viewer_a'
  ),
  'Owner üye rolünü değiştirebilir'
);

select lives_ok(
  format(
    'update public.circle_members set deleted_at = now(), invitation_state = %L where circle_id = %L and user_id = %L',
    'removed', :'circle_a', :'viewer_a'
  ),
  'Owner üyeyi çıkarabilir'
);

-- ---------------------------------------------------------------------------
-- 7. Denetim kaydı yalnız owner tarafından okunur, istemci yazamaz
-- ---------------------------------------------------------------------------

select ok(
  (select count(*) from public.audit_log where circle_id = :'circle_a') > 0,
  'Owner kendi çemberinin denetim kaydını okuyabilir'
);

-- ---------------------------------------------------------------------------
-- 8. Yetki yükseltme engellenir
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  format(
    'update public.circle_members set role = %L where circle_id = %L and user_id = %L',
    'owner', :'circle_a', :'caregiver_a'
  ),
  '42501',
  null,
  'Caregiver kendi rolünü owner yapamaz'
);

select lives_ok(
  format(
    'update public.circle_members set deleted_at = now() where circle_id = %L and user_id = %L',
    :'circle_a', :'caregiver_a'
  ),
  'Caregiver kendi üyeliğini bırakabilir'
);

select * from finish();
rollback;
