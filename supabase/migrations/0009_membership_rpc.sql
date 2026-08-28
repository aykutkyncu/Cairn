-- 0009_membership_rpc.sql
-- Üyelik yaşam döngüsünün atomik işlemleri: çember kurma ve davet kabulü.
--
-- NEDEN RPC:
-- Çember kurmak saf RLS ile MÜMKÜN DEĞİLDİR ve bu bilinçli bir sonuçtur.
-- Bir kullanıcı çember satırını yazsa bile, o çemberde henüz üyeliği olmadığı
-- için ne satırı geri okuyabilir (SELECT politikası üyelik ister) ne de kendini
-- owner olarak ekleyebilir (INSERT politikası owner olmayı ister). Kısır döngü.
-- Çözüm, iki yazmayı tek bir güvenli işlemde yapan SECURITY DEFINER
-- fonksiyonudur. Aynısı davet kabulü için de geçerlidir: hash eşleşmesi,
-- süre kontrolü, tüketim işareti ve üyelik oluşturma tek transaction'da olmalıdır.

-- ---------------------------------------------------------------------------
-- Sunucu tarafı kalıcı rate limit
-- ---------------------------------------------------------------------------
-- IP tabanlı sınır KULLANILMAZ: proxy başlıkları (X-Forwarded-For) istemci
-- tarafından uydurulabilir ve mobil operatör NAT'ı arkasında binlerce kullanıcı
-- aynı IP'yi paylaşır. Bunun yerine güvenilir sunucu tarafı boyutlar kullanılır:
-- kullanıcı kimliği (JWT'den), çember kimliği ve davet hash'i.

create table public.rate_limit_buckets (
  scope_kind text not null check (scope_kind in ('invite_create', 'invite_accept', 'invite_token')),
  scope_key text not null,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  primary key (scope_kind, scope_key)
);

comment on table public.rate_limit_buckets is
  'Sunucu tarafı kalıcı hız sınırı. IP yerine kullanıcı/çember/token boyutları '
  'kullanılır; proxy başlıklarına güvenilmez.';

-- Bu tabloya istemci hiçbir koşulda erişemez: RLS açık, politika yok.
-- Yalnız SECURITY DEFINER fonksiyonları tablo sahibi hakkıyla yazar.
alter table public.rate_limit_buckets enable row level security;

comment on column public.rate_limit_buckets.scope_key is
  'Boyuta göre kullanıcı kimliği, çember kimliği veya davet hash''inin metin '
  'gösterimi. Ham davet tokenı burada da saklanmaz.';

create or replace function public.enforce_rate_limit(
  target_scope_kind text,
  target_scope_key text,
  max_attempts integer,
  window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_count integer;
begin
  insert into public.rate_limit_buckets (scope_kind, scope_key, window_started_at, attempt_count)
  values (target_scope_kind, target_scope_key, now(), 1)
  on conflict (scope_kind, scope_key) do update
    set
      -- Pencere dolduysa sayaç sıfırlanır, dolmadıysa artar.
      window_started_at = case
        when public.rate_limit_buckets.window_started_at < now() - make_interval(secs => window_seconds)
          then now()
        else public.rate_limit_buckets.window_started_at
      end,
      attempt_count = case
        when public.rate_limit_buckets.window_started_at < now() - make_interval(secs => window_seconds)
          then 1
        else public.rate_limit_buckets.attempt_count + 1
      end
  returning attempt_count into current_count;

  if current_count > max_attempts then
    raise exception 'Çok fazla deneme yapıldı, lütfen daha sonra tekrar dene'
      using errcode = '53400', hint = 'rate_limited';
  end if;
end;
$$;

revoke execute on function public.enforce_rate_limit(text, text, integer, integer) from public;

-- ---------------------------------------------------------------------------
-- Çember kurma
-- ---------------------------------------------------------------------------

create or replace function public.create_circle_with_owner(
  care_recipient_name text,
  circle_timezone text default 'Europe/Istanbul',
  circle_currency char(3) default 'TRY'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := (select auth.uid());
  new_circle_id uuid;
begin
  if caller is null then
    raise exception 'Oturum gerekli' using errcode = '42501', hint = 'unauthenticated';
  end if;

  insert into public.circles (care_recipient_name, timezone, default_currency, created_by)
  values (care_recipient_name, circle_timezone, circle_currency, caller)
  returning id into new_circle_id;

  insert into public.circle_members (circle_id, user_id, role, invitation_state, created_by)
  values (new_circle_id, caller, 'owner', 'active', caller);

  return new_circle_id;
end;
$$;

revoke execute on function public.create_circle_with_owner(text, text, char) from public;
grant execute on function public.create_circle_with_owner(text, text, char) to authenticated;

comment on function public.create_circle_with_owner(text, text, char) is
  'Çemberi ve kurucusunun owner üyeliğini tek işlemde oluşturur. Saf RLS ile '
  'bu mümkün değildir: üyelik olmadan çember okunamaz, çember olmadan üyelik '
  'yazılamaz.';

-- ---------------------------------------------------------------------------
-- Davet oluşturma
-- ---------------------------------------------------------------------------
-- Ham token İSTEMCİDE üretilir (CSPRNG) ve sunucuya yalnız SHA-256 hash'i
-- gönderilir. Böylece düz token sunucu loglarına, hata raporlarına veya
-- veritabanına hiçbir aşamada düşmez. Bağlantıyı yalnız daveti oluşturan
-- cihaz bilir ve paylaşım sayfasıyla iletir.

create or replace function public.create_circle_invitation(
  target_circle_id uuid,
  invitation_token_hash bytea,
  invited_role public.circle_role default 'caregiver',
  ttl_days integer default 7
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := (select auth.uid());
  new_invitation_id uuid;
begin
  if caller is null then
    raise exception 'Oturum gerekli' using errcode = '42501', hint = 'unauthenticated';
  end if;

  if not public.can_write_circle(target_circle_id) then
    raise exception 'Bu çembere davet oluşturma yetkin yok'
      using errcode = '42501', hint = 'forbidden';
  end if;

  -- Owner rolü davetle verilemez: yetki devri ayrı ve bilinçli bir işlemdir.
  if invited_role = 'owner' then
    raise exception 'Davetle owner rolü verilemez'
      using errcode = '22023', hint = 'invalid_role';
  end if;

  if ttl_days < 1 or ttl_days > 7 then
    raise exception 'Davet ömrü 1-7 gün aralığında olmalı'
      using errcode = '22023', hint = 'invalid_ttl';
  end if;

  if octet_length(invitation_token_hash) <> 32 then
    raise exception 'Davet hash''i 32 bayt (SHA-256) olmalı'
      using errcode = '22023', hint = 'invalid_hash';
  end if;

  -- Çember başına saatte 20, kullanıcı başına saatte 10 davet.
  perform public.enforce_rate_limit('invite_create', target_circle_id::text, 20, 3600);
  perform public.enforce_rate_limit('invite_create', caller::text, 10, 3600);

  insert into public.invitations (circle_id, token_hash, role, expires_at, created_by)
  values (
    target_circle_id,
    invitation_token_hash,
    invited_role,
    now() + make_interval(days => ttl_days),
    caller
  )
  returning id into new_invitation_id;

  return new_invitation_id;
end;
$$;

revoke execute on function public.create_circle_invitation(uuid, bytea, public.circle_role, integer) from public;
grant execute on function public.create_circle_invitation(uuid, bytea, public.circle_role, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Davet kabulü (atomik)
-- ---------------------------------------------------------------------------

create or replace function public.accept_circle_invitation(invitation_token_hash bytea)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := (select auth.uid());
  claimed_circle_id uuid;
  claimed_role public.circle_role;
  probe_used_at timestamptz;
  probe_expires_at timestamptz;
begin
  if caller is null then
    raise exception 'Oturum gerekli' using errcode = '42501', hint = 'unauthenticated';
  end if;

  -- Kaba kuvvet denemesini hem kullanıcı hem token boyutunda sınırla.
  perform public.enforce_rate_limit('invite_accept', caller::text, 10, 3600);
  perform public.enforce_rate_limit('invite_token', encode(invitation_token_hash, 'hex'), 5, 3600);

  -- ÇEKİRDEK ATOMİK ADIM.
  -- Tek UPDATE ifadesi hash eşleşmesini, tüketilmemiş olmayı ve süreyi birlikte
  -- denetler ve satırı kilitler. İki eşzamanlı kabul denemesinde ikincisi bu
  -- satırda bloke olur, ilk işlem commit ettiğinde used_at dolu olduğu için
  -- WHERE koşulu artık tutmaz ve sıfır satır döner. Kontrol ile yazma arasında
  -- yarış penceresi YOKTUR.
  update public.invitations
  set used_at = now(), used_by = caller
  where token_hash = invitation_token_hash
    and used_at is null
    and expires_at > now()
  returning circle_id, role into claimed_circle_id, claimed_role;

  if claimed_circle_id is null then
    -- Neden başarısız olduğunu ayırt et. Bunu yapmak bilgi sızdırmaz: yalnız
    -- geçerli tokenı elinde tutan biri buraya kadar gelebilir.
    select i.used_at, i.expires_at into probe_used_at, probe_expires_at
    from public.invitations i
    where i.token_hash = invitation_token_hash;

    if probe_used_at is not null then
      raise exception 'Bu davet daha önce kullanılmış'
        using errcode = '23505', hint = 'invitation_already_used';
    elsif probe_expires_at is not null then
      raise exception 'Bu davetin süresi dolmuş'
        using errcode = '22023', hint = 'invitation_expired';
    else
      raise exception 'Davet geçersiz'
        using errcode = '22023', hint = 'invitation_invalid';
    end if;
  end if;

  -- Üyeliği oluştur veya yeniden etkinleştir.
  -- Zaten aktif bir üyelik varsa rolü DEĞİŞTİRME: bir owner'ın caregiver
  -- davetini kabul etmesi onu düşürmemelidir.
  insert into public.circle_members (circle_id, user_id, role, invitation_state, created_by)
  values (claimed_circle_id, caller, claimed_role, 'active', caller)
  on conflict (circle_id, user_id) do update
    set
      invitation_state = 'active',
      deleted_at = null,
      role = case
        when public.circle_members.invitation_state = 'active'
             and public.circle_members.deleted_at is null
          then public.circle_members.role
        else excluded.role
      end;

  return claimed_circle_id;
end;
$$;

revoke execute on function public.accept_circle_invitation(bytea) from public;
grant execute on function public.accept_circle_invitation(bytea) to authenticated;

comment on function public.accept_circle_invitation(bytea) is
  'Daveti tek atomik işlemde kabul eder: hash eşleşmesi, tüketim durumu, süre '
  'kontrolü, tüketim işareti ve üyelik oluşturma aynı transaction''dadır.';

-- ---------------------------------------------------------------------------
-- Doğrudan çember INSERT politikası kaldırılıyor
-- ---------------------------------------------------------------------------
-- Bu politika altında yazılan bir çember kullanılamaz durumda kalırdı: kurucu
-- ne satırı geri okuyabilir ne de kendini owner yapabilirdi. Tek geçerli yol
-- create_circle_with_owner() fonksiyonudur.

drop policy if exists circles_insert_self on public.circles;
