-- 0003_documents_and_search.test.sql
-- pgTAP: Faz 06 kabul kriterlerinin kanıtı — belge erişimi ve dosya araması.
--
-- ÇALIŞTIRMA: supabase test db  (yerel Postgres gerektirir, Docker ile)
--             Docker kurulu değilse CI'daki "Veritabanı ve RLS testleri" işi koşar.
--
-- 0002 paketi Storage politikasının MALZEMELERİNİ sınar:
-- storage_path_circle_id() yolu doğru çözüyor mu, is_circle_member() yabancıya
-- false mu dönüyor. Bunlar politikanın kendisi değildir. Politika yanlış
-- yazılmış olsaydı — örneğin bucket_id koşulu unutulmuş, ya da using yerine
-- yalnız with check verilmiş — o testlerin hepsi yine geçerdi.
--
-- Bu paket storage.objects üzerinde GERÇEK sorgu çalıştırır: satır görünüyor mu,
-- yazma reddediliyor mu. Kabul kriteri "başka çember yolu erişilemez" ancak
-- böyle kanıtlanır.

begin;
select plan(8);


-- ---------------------------------------------------------------------------
-- Sabitler: iki çember, üç kullanıcı (0001 paketiyle aynı kimlikler)
-- ---------------------------------------------------------------------------

\set owner_a       '11111111-1111-1111-1111-111111111111'
\set viewer_a      '33333333-3333-3333-3333-333333333333'
\set owner_b       '44444444-4444-4444-4444-444444444444'
\set circle_a      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
\set circle_b      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
\set doc_a         'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
\set allergy_a     'dddddddd-dddd-dddd-dddd-dddddddddddd'

-- Nesne yolu düzeni <circle_id>/<uuid>.<ext>. Dosya adı UUID'dir: hasta adı
-- yola girmez, çünkü yol imzalı URL'in içinde görünür.
\set object_a      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/9f1c0001-0000-0000-0000-000000000001.jpg'
\set object_b      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/9f1c0002-0000-0000-0000-000000000002.jpg'
-- Çember öneki olmayan nesne: politikanın null durumunda yetki VERMEDİĞİNİ
-- göstermek için. Bu satır kimseye görünmemelidir.
\set object_orphan 'kokusuz-nesne.jpg'


-- ---------------------------------------------------------------------------
-- Kurulum: RLS'yi atlayan servis bağlamında veri hazırla
-- ---------------------------------------------------------------------------

set local role postgres;

insert into auth.users (id, email) values
  (:'owner_a',  'owner-a@example.test'),
  (:'viewer_a', 'viewer-a@example.test'),
  (:'owner_b',  'owner-b@example.test');

insert into public.profiles (id, display_name) values
  (:'owner_a',  'Owner A'),
  (:'viewer_a', 'Viewer A'),
  (:'owner_b',  'Owner B');

insert into public.circles (id, care_recipient_name, created_by) values
  (:'circle_a', 'Bakılan Kişi A', :'owner_a'),
  (:'circle_b', 'Bakılan Kişi B', :'owner_b');

insert into public.circle_members (circle_id, user_id, role, invitation_state) values
  (:'circle_a', :'owner_a',  'owner',  'active'),
  (:'circle_a', :'viewer_a', 'viewer', 'active'),
  (:'circle_b', :'owner_b',  'owner',  'active');

-- Belge üst verisi: Storage nesnesinin uygulama tarafındaki karşılığı.
insert into public.documents (id, circle_id, object_path, original_filename, mime_type, byte_size, created_by)
values (
  :'doc_a', :'circle_a', :'object_a',
  'recete.jpg', 'image/jpeg', 204800, :'owner_a'
);

-- Arama için: kullanıcının "penisilin" yazınca bulmayı beklediği kayıt.
insert into public.health_records (id, circle_id, record_type, title, body, created_by)
values (:'allergy_a', :'circle_a', 'allergy', 'Penisilin alerjisi', 'Döküntü yapıyor', :'owner_a');

-- Storage nesneleri. Yalnız politikaların baktığı sütunlar yazılır
-- (bucket_id, name); geri kalanı varsayılanlarla gelir.
insert into storage.objects (bucket_id, name) values
  ('documents', :'object_a'),
  ('documents', :'object_b'),
  ('documents', :'object_orphan');


-- ---------------------------------------------------------------------------
-- 1. Storage okuma: çember sınırı
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'documents' and name = :'object_a'),
  0,
  'B çemberinin sahibi A çemberinin Storage nesnesini sorguyla göremez'
);

-- Yukarıdaki 0 tek başına yeterli kanıt değil: politika HERKESİ engelliyor
-- olsaydı da 0 dönerdi ve belge özelliği hiç çalışmıyor olurdu. Bucket'ta üç
-- nesne var (A'nın, B'nin, öneksiz olan); B tam olarak birini — kendisininkini
-- — görmelidir.
select is(
  (select count(*)::int from storage.objects where bucket_id = 'documents'),
  1,
  'B çemberinin sahibi bucket''ta yalnız kendi nesnesini görür'
);

set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'documents' and name = :'object_orphan'),
  0,
  'Çember öneki olmayan nesne üyeye de görünmez (null yetki vermez)'
);


-- ---------------------------------------------------------------------------
-- 2. Storage yazma: rol ve çember sınırı
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

-- Yabancı, A çemberinin yoluna yükleyemez. Bu reddedilmeseydi başka bir
-- çemberin klasörüne belge bırakmak mümkün olurdu.
select throws_ok(
  'insert into storage.objects (bucket_id, name) values (''documents'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/9f1c0003-0000-0000-0000-000000000003.jpg'')',
  '42501',
  null,
  'A çemberi dışından A çemberinin Storage yoluna yükleme reddedilir'
);

set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

-- Viewer okuyabilir ama yazamaz: can_write_circle yalnız owner/caregiver'a izin verir.
select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'documents' and name = :'object_a'),
  1,
  'Viewer kendi çemberinin belgesini okuyabilir'
);

select throws_ok(
  'insert into storage.objects (bucket_id, name) values (''documents'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/9f1c0004-0000-0000-0000-000000000004.jpg'')',
  '42501',
  null,
  'Viewer kendi çemberine bile belge yükleyemez'
);


-- ---------------------------------------------------------------------------
-- 3. Belge üst verisi ve arama: çember sınırı
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

-- Nesnenin kendisi korunsa bile üst veri sızarsa orijinal dosya adı ve
-- yükleme tarihi görünürdü; ikisi de sağlık verisidir.
select is(
  (select count(*)::int from public.documents where circle_id = :'circle_a'),
  0,
  'B çemberinin sahibi A çemberinin belge üst verisini göremez'
);

-- Arama ekranının kurduğu sorgunun aynısı: circle_id eşitliği + başlıkta ilike.
-- Filtre güvenlik değildir; güvenlik RLS'tedir. Yabancı, A'nın circle_id'sini
-- bilse ve elle sorsa bile sonuç boş dönmelidir.
select is(
  (select count(*)::int from public.health_records
    where circle_id = :'circle_a' and title ilike '%penisilin%'),
  0,
  'Dosya araması yabancı çemberde sonuç vermez'
);

select * from finish();
rollback;
