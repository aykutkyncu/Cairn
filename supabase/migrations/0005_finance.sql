-- 0005_finance.sql
-- Masraf paylaşımı: expenses, expense_splits, settlements.
--
-- Para kararı: tüm tutarlar integer minor unit (kuruş). Float kullanılmaz,
-- çünkü 0.1 + 0.2 <> 0.3 hatası para hesabında kabul edilemez.
--
-- Bölüşüm kararı: her masrafın katılımcı listesi ve payları SNAPSHOT olarak
-- saklanır. Çemberin varsayılan bölüşümü değişirse geçmiş masraflar değişmez.

create table public.expenses (
  id uuid primary key default extensions.gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  -- Tutar kuruş cinsinden. 100 TL -> 10000.
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  spent_on date not null,
  category text not null check (length(trim(category)) between 1 and 60),
  description text,
  paid_by uuid not null references auth.users (id) on delete restrict,
  split_method public.split_method not null default 'equal',
  receipt_document_id uuid references public.documents (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  revision integer not null default 1,
  deleted_at timestamptz
);

comment on column public.expenses.amount_minor is
  'Tutar minor unit (kuruş) cinsinden integer. Float kullanılmaz. Kur çevirme '
  'yapılmaz; farklı para birimleri ayrı gösterilir.';

create index expenses_circle_period_idx
  on public.expenses (circle_id, spent_on)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- expense_splits
-- ---------------------------------------------------------------------------

create table public.expense_splits (
  id uuid primary key default extensions.gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  circle_id uuid not null references public.circles (id) on delete cascade,
  member_user_id uuid not null references auth.users (id) on delete restrict,
  -- Bu üyenin payı, kuruş. Payların toplamı masrafın toplamına TAM eşit olmalıdır;
  -- küsurat deterministik bir kuralla (en büyük kalan + sabit üye sırası) dağıtılır.
  share_minor bigint not null check (share_minor >= 0),
  created_at timestamptz not null default now(),
  constraint expense_splits_unique_member unique (expense_id, member_user_id)
);

comment on table public.expense_splits is
  'Masraf bölüşüm snapshot''ı. Çember varsayılanı sonradan değişse bile bu '
  'satırlar değişmez; geçmiş masraf sadık kalır.';

create index expense_splits_circle_member_idx
  on public.expense_splits (circle_id, member_user_id);

-- Payların toplamı masrafın tutarına eşit mi? Uygulama katmanı bunu yazarken
-- garanti eder; bu fonksiyon pgTAP ve bakım sorguları için doğrulama sağlar.
create or replace function public.expense_split_is_balanced(target_expense_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(sum(s.share_minor), 0) = e.amount_minor
  from public.expenses e
  left join public.expense_splits s on s.expense_id = e.id
  where e.id = target_expense_id
  group by e.amount_minor;
$$;

comment on function public.expense_split_is_balanced(uuid) is
  'Bölüşüm paylarının toplamının masraf tutarına tam eşit olduğunu doğrular. '
  'Kuruş kaybı veya fazlası bu kontrolden geçemez.';

-- ---------------------------------------------------------------------------
-- settlements
-- ---------------------------------------------------------------------------

create table public.settlements (
  id uuid primary key default extensions.gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  from_user_id uuid not null references auth.users (id) on delete restrict,
  to_user_id uuid not null references auth.users (id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  settled_on date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  revision integer not null default 1,
  deleted_at timestamptz,
  constraint settlements_distinct_parties check (from_user_id <> to_user_id)
);

comment on table public.settlements is
  'İki üye arasında GERÇEKLEŞMİŞ ödemenin kaydı. Uygulama içi para transferi '
  'DEĞİLDİR; Cairn para taşımaz. Arayüz metinleri bu ayrımı açık tutar.';

create index settlements_circle_period_idx
  on public.settlements (circle_id, settled_on)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.expenses enable row level security;
alter table public.expenses force row level security;

create policy expenses_select_member on public.expenses
  for select to authenticated
  using (public.is_circle_member(circle_id));

create policy expenses_insert_writer on public.expenses
  for insert to authenticated
  with check (public.can_write_circle(circle_id));

create policy expenses_update_writer on public.expenses
  for update to authenticated
  using (deleted_at is null and public.can_write_circle(circle_id))
  with check (public.can_write_circle(circle_id));

alter table public.expense_splits enable row level security;
alter table public.expense_splits force row level security;

create policy expense_splits_select_member on public.expense_splits
  for select to authenticated
  using (public.is_circle_member(circle_id));

create policy expense_splits_insert_writer on public.expense_splits
  for insert to authenticated
  with check (public.can_write_circle(circle_id));

create policy expense_splits_delete_writer on public.expense_splits
  for delete to authenticated
  using (public.can_write_circle(circle_id));

alter table public.settlements enable row level security;
alter table public.settlements force row level security;

create policy settlements_select_member on public.settlements
  for select to authenticated
  using (public.is_circle_member(circle_id));

create policy settlements_insert_writer on public.settlements
  for insert to authenticated
  with check (public.can_write_circle(circle_id));

create policy settlements_update_writer on public.settlements
  for update to authenticated
  using (deleted_at is null and public.can_write_circle(circle_id))
  with check (public.can_write_circle(circle_id));

-- ---------------------------------------------------------------------------
-- Trigger'lar
-- ---------------------------------------------------------------------------

create trigger expenses_set_revision
  before update on public.expenses
  for each row execute function public.bump_revision();

create trigger settlements_set_revision
  before update on public.settlements
  for each row execute function public.bump_revision();

create trigger expenses_record_tombstone
  after update on public.expenses
  for each row execute function public.record_tombstone();

create trigger settlements_record_tombstone
  after update on public.settlements
  for each row execute function public.record_tombstone();
