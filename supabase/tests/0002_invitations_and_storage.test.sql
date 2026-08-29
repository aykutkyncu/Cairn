-- 0002_invitations_and_storage.test.sql
-- pgTAP: davet tokenı gizliliği, Storage izolasyonu, tombstone ve para bütünlüğü.
--
-- ÇALIŞTIRMA: supabase test db  (yerel Postgres gerektirir, Docker ile)

begin;
select plan(17);


\set owner_a     '11111111-1111-1111-1111-111111111111'
\set owner_b     '44444444-4444-4444-4444-444444444444'
\set circle_a    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
\set circle_b    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
\set doc_a       'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'

set local role postgres;

insert into auth.users (id, email) values
  (:'owner_a', 'owner-a@example.test'),
  (:'owner_b', 'owner-b@example.test');

insert into public.profiles (id, display_name) values
  (:'owner_a', 'Owner A'),
  (:'owner_b', 'Owner B');

insert into public.circles (id, care_recipient_name, created_by) values
  (:'circle_a', 'Bakılan Kişi A', :'owner_a'),
  (:'circle_b', 'Bakılan Kişi B', :'owner_b');

insert into public.circle_members (circle_id, user_id, role, invitation_state) values
  (:'circle_a', :'owner_a', 'owner', 'active'),
  (:'circle_b', :'owner_b', 'owner', 'active');

-- ---------------------------------------------------------------------------
-- 1. Davet tablosunda düz token saklanacak sütun yoktur
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'invitations'
     and column_name in ('token', 'plain_token', 'invite_code', 'secret')),
  0,
  'invitations tablosunda düz token sütunu yoktur'
);

select has_column('public', 'invitations', 'token_hash', 'invitations yalnız token_hash tutar');
select has_column('public', 'invitations', 'expires_at', 'invitations son kullanma tarihi tutar');
select has_column('public', 'invitations', 'used_at', 'invitations tüketim durumu tutar');

select col_type_is(
  'public', 'invitations', 'token_hash', 'bytea',
  'token_hash ham bayt olarak saklanır (metin değil)'
);

-- Aynı hash iki kez yazılamaz: tek kullanımlık davetin veritabanı garantisi.
insert into public.invitations (circle_id, token_hash, expires_at, created_by)
values (:'circle_a', decode('deadbeef', 'hex'), now() + interval '7 days', :'owner_a');

select throws_ok(
  format(
    'insert into public.invitations (circle_id, token_hash, expires_at, created_by) values (%L, decode(%L, %L), now() + interval ''7 days'', %L)',
    :'circle_a', 'deadbeef', 'hex', :'owner_a'
  ),
  '23505',
  null,
  'Aynı davet hash''i iki kez kaydedilemez'
);

-- ---------------------------------------------------------------------------
-- 2. Davet satırı başka çember üyesine görünmez
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select is(
  (select count(*)::int from public.invitations where circle_id = :'circle_a'),
  0,
  'Yabancı kullanıcı başka çemberin davetini göremez'
);

-- ---------------------------------------------------------------------------
-- 3. Storage: nesne yolu çözümü ve izolasyon
-- ---------------------------------------------------------------------------

select is(
  public.storage_path_circle_id('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/9f1c.jpg'),
  :'circle_a'::uuid,
  'Nesne yolunun ilk parçası çember kimliği olarak çözülür'
);

select is(
  public.storage_path_circle_id('not-a-uuid/photo.jpg'),
  null::uuid,
  'Geçersiz nesne yolu null döner ve yetki vermez'
);

select is(
  public.storage_path_circle_id('photo.jpg'),
  null::uuid,
  'Klasörsüz nesne yolu null döner'
);

select ok(
  not (select public.is_circle_member(public.storage_path_circle_id(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/9f1c.jpg'
  ))),
  'B çemberinin sahibi A çemberinin Storage nesnesine erişemez'
);

select is(
  (select b.public from storage.buckets b where b.id = 'documents'),
  false,
  'documents bucket''ı private''tır'
);

-- 0008_storage.sql, storage.objects üzerinde RLS'i AÇMAZ: tablonun sahibi
-- supabase_storage_admin'dir ve migration rolü onu değiştiremez (42501).
-- Supabase'in RLS'i açık getirdiği varsayımı sessiz bırakılmaz; burada
-- doğrulanır. Bu kontrol düşerse politikalarımız hiçbir şey korumuyor demektir.
select ok(
  (select c.relrowsecurity
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'objects'),
  'storage.objects üzerinde RLS açıktır'
);

-- ---------------------------------------------------------------------------
-- 4. Tombstone: yumuşak silme senkronizasyona görünür olur
-- ---------------------------------------------------------------------------

set local role postgres;

insert into public.documents (id, circle_id, object_path, original_filename, mime_type, byte_size, created_by)
values (
  :'doc_a', :'circle_a',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/9f1c.jpg',
  'recete.jpg', 'image/jpeg', 204800, :'owner_a'
);

update public.documents set deleted_at = now() where id = :'doc_a';

select is(
  (select count(*)::int from public.sync_tombstones
   where entity_table = 'documents' and entity_id = :'doc_a'),
  1,
  'Yumuşak silme tombstone kaydı üretir'
);

-- ---------------------------------------------------------------------------
-- 5. Tamamlama tekilliği ve idempotency
-- ---------------------------------------------------------------------------

\set task_a 'cccccccc-cccc-cccc-cccc-cccccccccccc'

insert into public.tasks (id, circle_id, title, dtstart_local_date, dtstart_local_time, created_by)
values (:'task_a', :'circle_a', 'Sabah ilacı', '2026-08-28', '08:00', :'owner_a');

insert into public.task_completions (circle_id, task_id, occurrence_id, mutation_id, created_by)
values (:'circle_a', :'task_a', '2026-08-28T08:00:00+03:00', gen_random_uuid(), :'owner_a');

-- İki kişi aynı örneği aynı anda tamamlarsa yalnız biri kabul edilir.
select throws_ok(
  format(
    'insert into public.task_completions (circle_id, task_id, occurrence_id, mutation_id) values (%L, %L, %L, gen_random_uuid())',
    :'circle_a', :'task_a', '2026-08-28T08:00:00+03:00'
  ),
  '23505',
  null,
  'Aynı occurrence için ikinci tamamlama reddedilir'
);

-- ---------------------------------------------------------------------------
-- 6. Para bütünlüğü: kuruş kaybı olmaz
-- ---------------------------------------------------------------------------

\set expense_a 'ffffffff-ffff-ffff-ffff-ffffffffffff'

insert into public.expenses (id, circle_id, amount_minor, currency, spent_on, category, paid_by, created_by)
values (:'expense_a', :'circle_a', 10000, 'TRY', '2026-08-28', 'ilaç', :'owner_a', :'owner_a');

-- 100 TL üç kişiye: 3334 + 3333 + 3333 = 10000. Kuruş kaybı yok.
insert into public.expense_splits (expense_id, circle_id, member_user_id, share_minor) values
  (:'expense_a', :'circle_a', :'owner_a', 3334),
  (:'expense_a', :'circle_a', :'owner_b', 3333);

select is(
  public.expense_split_is_balanced(:'expense_a'),
  false,
  'Eksik bölüşüm dengesiz olarak raporlanır'
);

insert into public.expense_splits (expense_id, circle_id, member_user_id, share_minor)
select :'expense_a', :'circle_a', id, 3333 from auth.users where email = 'owner-a@example.test'
on conflict do nothing;

select is(
  (select sum(share_minor)::bigint from public.expense_splits where expense_id = :'expense_a'),
  6667::bigint,
  'Bölüşüm payları integer kuruş olarak toplanır'
);

select * from finish();
rollback;
