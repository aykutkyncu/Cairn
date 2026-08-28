-- 0002_identity.sql
-- Kimlik ve çember üyeliği: profiles, circles, circle_members, invitations.
-- Yetki yardımcı fonksiyonları ve bu tabloların RLS politikaları burada tanımlanır.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  -- Avatar yalnız Storage nesne yolu tutar; imzalı URL saklanmaz.
  avatar_object_path text,
  locale text not null default 'tr' check (locale in ('tr', 'en', 'ar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision integer not null default 1
);

comment on table public.profiles is
  'Kullanıcı profili. Sağlık verisi içermez; auth.users ile bire bir eşleşir.';

-- ---------------------------------------------------------------------------
-- circles
-- ---------------------------------------------------------------------------

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  -- Bakılan kişinin adı özel nitelikli veriye işaret eder; log ve push'a yazılmaz.
  care_recipient_name text not null check (length(trim(care_recipient_name)) between 1 and 200),
  -- IANA zaman dilimi adı. Görev tekrarı ve günlük özet cihaz saatini değil bunu kullanır.
  timezone text not null default 'Europe/Istanbul',
  -- ISO 4217. Para hesabı daima integer minor unit ile yapılır.
  default_currency char(3) not null default 'TRY' check (default_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Sistem tarafından üretilen kayıtlarda null olabilir; auth.uid() yokken
  -- yanlış kullanıcı yazılmaz.
  created_by uuid references auth.users (id) on delete set null,
  revision integer not null default 1,
  deleted_at timestamptz
);

comment on column public.circles.timezone is
  'IANA zaman dilimi. Tekrar kuralı ve günlük özet bu dilime göre hesaplanır, '
  'cihazın saat dilimine göre değil.';

comment on column public.circles.created_by is
  'Sistem aktörü tarafından üretilen kayıtlarda null. auth.uid() yokken sahte '
  'kullanıcı kimliği üretilmez.';

-- Zaman diliminin gerçekten var olduğunu doğrular; 'Europe/Istnbul' gibi
-- yazım hataları veriye giremez.
create or replace function public.is_valid_timezone(tz text)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (select 1 from pg_timezone_names where name = tz);
$$;

alter table public.circles
  add constraint circles_timezone_valid check (public.is_valid_timezone(timezone));

-- ---------------------------------------------------------------------------
-- circle_members
-- ---------------------------------------------------------------------------

create table public.circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.circle_role not null default 'caregiver',
  invitation_state public.membership_state not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  revision integer not null default 1,
  deleted_at timestamptz,
  -- Bir kullanıcı bir çemberde en çok bir üyelik satırı taşır.
  constraint circle_members_unique_membership unique (circle_id, user_id)
);

create index circle_members_user_active_idx
  on public.circle_members (user_id)
  where deleted_at is null and invitation_state = 'active';

create index circle_members_circle_active_idx
  on public.circle_members (circle_id)
  where deleted_at is null and invitation_state = 'active';

-- ---------------------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  -- YALNIZ hash saklanır. Düz token veritabanına hiçbir koşulda yazılmaz;
  -- bağlantı yalnız üretim anında istemciye döner.
  token_hash bytea not null,
  role public.circle_role not null default 'caregiver',
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  -- Tek kullanımlık: aynı hash iki kez kabul edilemez.
  constraint invitations_token_hash_unique unique (token_hash),
  -- Davet ömrü en çok 7 gün.
  constraint invitations_lifetime_check check (expires_at > created_at),
  -- Kullanılmışsa kim kullandığı bilinir.
  constraint invitations_used_consistency check (
    (used_at is null and used_by is null) or (used_at is not null and used_by is not null)
  )
);

comment on column public.invitations.token_hash is
  'Davet tokenının SHA-256 hash''i. Düz token asla saklanmaz; bu yüzden '
  'veritabanı sızıntısı davet bağlantısını kullanılabilir kılmaz.';

create index invitations_circle_open_idx
  on public.invitations (circle_id)
  where used_at is null;

-- ---------------------------------------------------------------------------
-- Yetki yardımcı fonksiyonları
-- ---------------------------------------------------------------------------
--
-- Bu fonksiyonlar SECURITY DEFINER'dır çünkü circle_members üzerindeki RLS
-- politikaları kendilerini değerlendirirken sonsuz özyineleme oluşur.
--
-- Güvenlik sınırları:
--   * search_path public, pg_temp olarak sabitlenir (arama yolu ele geçirilemez).
--   * Fonksiyonlar YALNIZ auth.uid() için cevap verir; çağıran, başka bir
--     kullanıcının üyeliğini sorgulayamaz. Bu, RLS'yi atlatan bir okuma
--     yüzeyi açılmasını engeller.
--   * EXECUTE yetkisi PUBLIC'ten alınır, yalnız authenticated role'e verilir.
--   * Dönüş değeri boolean/enum'dur; satır verisi sızdırmaz.

create or replace function public.is_circle_member(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.circle_members m
    where m.circle_id = target_circle_id
      and m.user_id = (select auth.uid())
      and m.invitation_state = 'active'
      and m.deleted_at is null
  );
$$;

comment on function public.is_circle_member(uuid) is
  'Çağıran kullanıcının verilen çemberde aktif üye olup olmadığını döndürür. '
  'Yalnız auth.uid() için cevap verir; başka kullanıcı sorgulanamaz.';

create or replace function public.circle_role_of(target_circle_id uuid)
returns public.circle_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.circle_members m
  where m.circle_id = target_circle_id
    and m.user_id = (select auth.uid())
    and m.invitation_state = 'active'
    and m.deleted_at is null
  limit 1;
$$;

comment on function public.circle_role_of(uuid) is
  'Çağıran kullanıcının verilen çemberdeki rolünü döndürür; üye değilse null.';

-- İçerik yazabilen roller: owner ve caregiver. Viewer yalnız okur.
create or replace function public.can_write_circle(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.circle_role_of(target_circle_id) in ('owner', 'caregiver');
$$;

-- Üye yönetimi ve çember silme yalnız owner'a aittir.
create or replace function public.is_circle_owner(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.circle_role_of(target_circle_id) = 'owner';
$$;

revoke execute on function public.is_circle_member(uuid) from public;
revoke execute on function public.circle_role_of(uuid) from public;
revoke execute on function public.can_write_circle(uuid) from public;
revoke execute on function public.is_circle_owner(uuid) from public;

grant execute on function public.is_circle_member(uuid) to authenticated;
grant execute on function public.circle_role_of(uuid) to authenticated;
grant execute on function public.can_write_circle(uuid) to authenticated;
grant execute on function public.is_circle_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- FORCE kullanılır: tablo sahibi bile politikalara tabidir. Migration rolü
-- normalde RLS'yi atlar; FORCE bu boşluğu kapatır.

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- Çember arkadaşları birbirinin adını görebilmelidir (görev ataması, avatar).
create policy profiles_select_circle_peers on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.circle_members mine
      join public.circle_members theirs on theirs.circle_id = mine.circle_id
      where mine.user_id = (select auth.uid())
        and mine.invitation_state = 'active'
        and mine.deleted_at is null
        and theirs.user_id = public.profiles.id
        and theirs.invitation_state = 'active'
        and theirs.deleted_at is null
    )
  );

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter table public.circles enable row level security;
alter table public.circles force row level security;

-- NOT: SELECT politikasında `deleted_at is null` filtresi BİLİNÇLİ OLARAK YOKTUR.
-- İki nedeni var:
--   1. Çevrimdışı senkronizasyon silmeyi görebilmelidir. Silinen satır SELECT
--      politikasıyla gizlenirse cihaz silmeyi hiç öğrenemez.
--   2. `update ... set deleted_at = now() ... returning` ifadesi, RETURNING
--      nedeniyle yeni satırı SELECT politikasına karşı da denetler. Filtre
--      politikada olursa yumuşak silme "new row violates row-level security"
--      hatasıyla reddedilir.
-- Yetki zaten is_circle_member() içinde denetlenir; o fonksiyon üyeliğin aktif
-- olmasını şart koşar. Aktif kayıt filtresi sorgu katmanında uygulanır.
create policy circles_select_member on public.circles
  for select to authenticated
  using (public.is_circle_member(id));

-- Yeni çember kuran kişi kendini created_by olarak yazar; owner üyeliği
-- uygulama katmanında aynı işlemde eklenir.
create policy circles_insert_self on public.circles
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy circles_update_owner on public.circles
  for update to authenticated
  using (deleted_at is null and public.is_circle_owner(id))
  with check (public.is_circle_owner(id));

alter table public.circle_members enable row level security;
alter table public.circle_members force row level security;

-- Aktif kayıt filtresi için yukarıdaki circles_select_member notuna bakınız.
create policy circle_members_select_member on public.circle_members
  for select to authenticated
  using (public.is_circle_member(circle_id));

-- Üye ekleme yalnız owner'a aittir. Davetle katılma atomik RPC üzerinden
-- yapılır (Faz 03) ve bu politikadan geçmez.
create policy circle_members_insert_owner on public.circle_members
  for insert to authenticated
  with check (public.is_circle_owner(circle_id));

create policy circle_members_update_owner on public.circle_members
  for update to authenticated
  using (public.is_circle_owner(circle_id))
  with check (public.is_circle_owner(circle_id));

-- Kullanıcı kendi üyeliğini bırakabilir. Rolünü DEĞİŞTİREMEZ: WITH CHECK
-- ifadesi OLD satırını göremediği için bu, aşağıdaki trigger ile zorlanır.
create policy circle_members_leave_self on public.circle_members
  for update to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null)
  with check (user_id = (select auth.uid()));

-- Yetki yükseltme koruması.
-- Bu trigger olmadan circle_members_leave_self politikası bir üyenin kendi
-- rolünü 'owner' yapmasına izin verirdi: WITH CHECK yalnız NEW satırını görür,
-- rolün değişip değişmediğini anlayamaz.
create or replace function public.guard_membership_role_change()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role and not public.is_circle_owner(old.circle_id) then
    raise exception 'Üye rolünü yalnız çember sahibi değiştirebilir'
      using errcode = '42501';
  end if;

  if new.circle_id is distinct from old.circle_id then
    raise exception 'Üyelik başka çembere taşınamaz'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_membership_role_change() is
  'Rol yükseltmeyi ve üyeliğin başka çembere taşınmasını engeller. RLS WITH '
  'CHECK ifadesi OLD satırını göremediği için bu kontrol trigger seviyesindedir.';

create trigger circle_members_guard_role_change
  before update on public.circle_members
  for each row execute function public.guard_membership_role_change();

-- invitations: istemci hiçbir koşulda SELECT yapamaz.
-- Davetin varlığı ve durumu yalnız Faz 03'teki atomik kabul RPC'si üzerinden
-- öğrenilir. Bu, token_hash'in çevrimdışı denenmesini engeller.
alter table public.invitations enable row level security;
alter table public.invitations force row level security;

create policy invitations_insert_writer on public.invitations
  for insert to authenticated
  with check (public.can_write_circle(circle_id) and created_by = (select auth.uid()));

-- Davet üreten kişi kendi ürettiği davetin durumunu görebilir; token_hash
-- sütunu uygulama katmanında hiçbir sorguya dahil edilmez.
create policy invitations_select_own_created on public.invitations
  for select to authenticated
  using (created_by = (select auth.uid()) and public.is_circle_member(circle_id));

-- Daveti iptal etmek: yalnız üreten kişi veya çember sahibi.
create policy invitations_delete_owner on public.invitations
  for delete to authenticated
  using (public.is_circle_owner(circle_id) or created_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Trigger'lar
-- ---------------------------------------------------------------------------

create trigger profiles_set_revision
  before update on public.profiles
  for each row execute function public.bump_revision();

create trigger circles_set_revision
  before update on public.circles
  for each row execute function public.bump_revision();

create trigger circle_members_set_revision
  before update on public.circle_members
  for each row execute function public.bump_revision();
