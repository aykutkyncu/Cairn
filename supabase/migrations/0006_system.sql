-- 0006_system.sql
-- Sistem tabloları: daily_digests, device_push_tokens, consents.

-- ---------------------------------------------------------------------------
-- daily_digests
-- ---------------------------------------------------------------------------
-- Günlük özet SAYI ve DURUM taşır, içerik taşımaz. İlaç adı, teşhis veya not
-- metni bu tabloya yazılmaz; kullanıcı ayrıntıya yalnız uygulama içinde ve
-- yetkisi varsa ulaşır.

create table public.daily_digests (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  -- Çemberin zaman dilimindeki gün. UTC günü değil.
  digest_local_date date not null,
  completed_task_count integer not null default 0 check (completed_task_count >= 0),
  skipped_task_count integer not null default 0 check (skipped_task_count >= 0),
  pending_task_count integer not null default 0 check (pending_task_count >= 0),
  note_count integer not null default 0 check (note_count >= 0),
  tomorrow_task_count integer not null default 0 check (tomorrow_task_count >= 0),
  -- Şablon tabanlı, hassas içerik barındırmayan özet metni.
  summary_text text,
  created_at timestamptz not null default now(),
  constraint daily_digests_unique_day unique (circle_id, digest_local_date)
);

comment on table public.daily_digests is
  'Günlük özet. Yalnız sayı/durum bilgisi ve şablon metni içerir; ilaç adı, '
  'teşhis veya not içeriği yazılmaz. 90 gün saklama politikası uygulanır.';

create index daily_digests_retention_idx on public.daily_digests (created_at);

-- 90 günden eski özetleri temizler. Zamanlanmış iş bunu çağırır.
-- Yedeklerde saklama süresi ayrıdır ve gizlilik dokümanında belirtilir.
create or replace function public.purge_expired_daily_digests(retention_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removed integer;
begin
  delete from public.daily_digests
  where created_at < now() - make_interval(days => retention_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke execute on function public.purge_expired_daily_digests(integer) from public;

comment on function public.purge_expired_daily_digests(integer) is
  'Saklama süresi dolan günlük özetleri siler. Bu, yedeklerden geri '
  'döndürülemez silme GARANTİSİ DEĞİLDİR; yedek saklama süresi ayrıca belgelenir.';

-- ---------------------------------------------------------------------------
-- device_push_tokens
-- ---------------------------------------------------------------------------

create table public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Expo push token. Kendi başına sağlık verisi değildir, fakat cihazı
  -- tanımlar; oturum kapanışında ve DeviceNotRegistered dönüşünde silinir.
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_push_tokens_unique unique (user_id, token)
);

comment on table public.device_push_tokens is
  'Cihaz push tokenları. Logout''ta silinir, DeviceNotRegistered geri '
  'dönüşünde temizlenir. Bildirim gövdesi hassas sağlık alanı içermez.';

create index device_push_tokens_active_idx
  on public.device_push_tokens (user_id)
  where disabled_at is null;

-- ---------------------------------------------------------------------------
-- consents
-- ---------------------------------------------------------------------------
-- Açık rıza kaydı. Harici AI veya analiz hizmetine sağlık verisi ancak ilgili
-- kişinin AYRI açık rızası varsa gönderilebilir; teknik kapı budur.

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Rıza çember bağlamlı olabilir (ör. bu çemberin verisi için AI işleme).
  circle_id uuid references public.circles (id) on delete cascade,
  kind public.consent_kind not null,
  granted_at timestamptz,
  revoked_at timestamptz,
  -- Rızanın hangi metne dayandığı. Metin değişirse yeni rıza gerekir.
  policy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consents_unique_scope unique (user_id, circle_id, kind, policy_version),
  constraint consents_state_check check (
    granted_at is not null or revoked_at is not null
  )
);

comment on table public.consents is
  'Açık rıza kayıtları. Rıza yoksa ilgili özellik teknik olarak kapalıdır; '
  'kullanıcıya nedeni gösterilir. Rıza metni sürümlenir.';

-- Aktif rıza: verilmiş ve geri alınmamış.
create or replace function public.has_active_consent(
  target_kind public.consent_kind,
  target_circle_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.consents c
    where c.user_id = (select auth.uid())
      and c.kind = target_kind
      and (target_circle_id is null or c.circle_id = target_circle_id)
      and c.granted_at is not null
      and c.revoked_at is null
  );
$$;

revoke execute on function public.has_active_consent(public.consent_kind, uuid) from public;
grant execute on function public.has_active_consent(public.consent_kind, uuid) to authenticated;

comment on function public.has_active_consent(public.consent_kind, uuid) is
  'Çağıran kullanıcının aktif rızası var mı. Yalnız auth.uid() için cevap verir.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.daily_digests enable row level security;
alter table public.daily_digests force row level security;

-- Özet yalnız okunur; üretimi zamanlanmış sunucu işine aittir.
create policy daily_digests_select_member on public.daily_digests
  for select to authenticated
  using (public.is_circle_member(circle_id));

alter table public.device_push_tokens enable row level security;
alter table public.device_push_tokens force row level security;

create policy device_push_tokens_select_self on public.device_push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy device_push_tokens_insert_self on public.device_push_tokens
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy device_push_tokens_update_self on public.device_push_tokens
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy device_push_tokens_delete_self on public.device_push_tokens
  for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.consents enable row level security;
alter table public.consents force row level security;

-- Rıza kişiseldir: başka üye bir kullanıcının rızasını göremez.
create policy consents_select_self on public.consents
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy consents_insert_self on public.consents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy consents_update_self on public.consents
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Trigger'lar
-- ---------------------------------------------------------------------------

create trigger device_push_tokens_set_updated_at
  before update on public.device_push_tokens
  for each row execute function public.set_updated_at();

create trigger consents_set_updated_at
  before update on public.consents
  for each row execute function public.set_updated_at();
