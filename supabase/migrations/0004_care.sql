-- 0004_care.sql
-- Bakım verisi: tasks, task_completions, medications, health_records, documents.
--
-- Takvim modeli kararı (Faz 05'in temeli):
--   Tekrarlı görev TEK kural satırı olarak saklanır. Occurrence'lar önceden
--   üretilmez; binlerce satır yerine DTSTART + RRULE + circle.timezone tutulur.
--   Tamamlama kaydı occurrence_id ile bağlanır; occurrence_id kanonik biçimi
--   çemberin zaman dilimindeki yerel başlangıç anıdır (ISO-8601, ofsetli).

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  kind public.task_kind not null default 'other',
  title text not null check (length(trim(title)) between 1 and 300),
  notes text,
  -- Görevin yerel başlangıç tarihi ve saati. timestamptz DEĞİL: duvar saati
  -- semantiği gerekir, çünkü DST geçişinde "sabah 08:00" sabit kalmalıdır.
  dtstart_local_date date not null,
  dtstart_local_time time not null,
  -- RFC 5545 RRULE. Kullanıcıya gösterilmez; arayüz hazır seçenekler sunar.
  -- null = tek seferlik görev.
  rrule text check (rrule is null or rrule ~ '^FREQ='),
  -- Tekrarın bittiği gün (dahil). null = süresiz.
  recurrence_until_local_date date,
  assigned_to uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  revision integer not null default 1,
  deleted_at timestamptz
);

comment on column public.tasks.dtstart_local_time is
  'Yerel duvar saati. timestamptz kullanılmaz: DST geçişinde kullanıcı '
  '"sabah 08:00" beklentisini korur, UTC ofseti değil.';

comment on column public.tasks.rrule is
  'RFC 5545 tekrar kuralı. Tek kural satırı saklanır; occurrence''lar önceden '
  'üretilmez. Kullanıcıya ham RRULE gösterilmez.';

create index tasks_circle_active_idx
  on public.tasks (circle_id, dtstart_local_date)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- task_completions
-- ---------------------------------------------------------------------------

create table public.task_completions (
  id uuid primary key default extensions.gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  -- Tekrarın hangi örneği. Kanonik biçim: çember zaman diliminde ISO-8601
  -- ofsetli yerel başlangıç anı (ör. '2026-08-28T08:00:00+03:00').
  occurrence_id text not null check (length(occurrence_id) between 1 and 40),
  kind public.completion_kind not null default 'done',
  completed_at timestamptz not null default now(),
  completed_by uuid references auth.users (id) on delete set null,
  note text,
  -- İstemci mutasyon kimliği. Çevrimdışı outbox aynı mutation_id ile yeniden
  -- dener; ikinci deneme yeni satır üretmez.
  mutation_id uuid not null,
  -- Geri alma: mevcut completion silinmez, void kaydı onu geçersizler.
  voids_completion_id uuid references public.task_completions (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint task_completions_mutation_unique unique (mutation_id),
  constraint task_completions_void_consistency check (
    (kind = 'void') = (voids_completion_id is not null)
  )
);

-- ÇEKİRDEK GARANTİ: aynı görevin aynı örneği için en çok bir geçerli tamamlama.
-- İki kişi aynı anda tamamlarsa ikincisi bu kısıta takılır ve istemci onu
-- "zaten tamamlanmış" olarak ele alır.
create unique index task_completions_single_active_idx
  on public.task_completions (task_id, occurrence_id)
  where kind <> 'void';

create index task_completions_circle_cursor_idx
  on public.task_completions (circle_id, created_at);

comment on column public.task_completions.mutation_id is
  'İstemci tarafından üretilen kalıcı mutasyon kimliği. Aynı mutation_id ile '
  'yeniden deneme idempotenttir.';

-- ---------------------------------------------------------------------------
-- medications
-- ---------------------------------------------------------------------------

create table public.medications (
  id uuid primary key default extensions.gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  dosage text,
  frequency_text text,
  started_on date,
  ended_on date,
  prescribed_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  revision integer not null default 1,
  deleted_at timestamptz,
  constraint medications_date_order check (ended_on is null or started_on is null or ended_on >= started_on)
);

comment on table public.medications is
  'İlaç kaydı. Uygulama ilaç doğruluğunu garanti etmez ve otomatik hatırlatma '
  'üretmez; görev oluşturma yalnız kullanıcının açık onayıyla yapılır.';

-- Aktif ilaç: bitiş tarihi yok veya gelecekte.
create index medications_circle_active_idx
  on public.medications (circle_id)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- health_records
-- ---------------------------------------------------------------------------

create table public.health_records (
  id uuid primary key default extensions.gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  -- Alerji, teşhis, doktor, ölçüm, not: tek tabloda tür ayrımıyla tutulur.
  record_type text not null check (
    record_type in ('allergy', 'diagnosis', 'doctor', 'measurement', 'note', 'question')
  ),
  title text not null check (length(trim(title)) between 1 and 300),
  -- Serbest metin. Sözleşme gereği burada genel metin temizleme YAPILMAZ;
  -- sağlık notunun içeriği bozulmadan saklanır.
  body text,
  recorded_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  revision integer not null default 1,
  deleted_at timestamptz
);

comment on column public.health_records.body is
  'Serbest sağlık metni. Genel amaçlı metin temizleme uygulanmaz; içerik '
  'bozulmadan saklanır. Çıktı tarafında HTML olarak işlenmez.';

create index health_records_circle_type_idx
  on public.health_records (circle_id, record_type)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default extensions.gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  -- Storage nesne yolu. Düzen: <circle_id>/<uuid>.<ext>
  -- Dosya adı olarak UUID kullanılır; orijinal ad ayrı alanda tutulur, böylece
  -- hasta adı veya teşhis dosya yoluna sızmaz.
  object_path text not null unique check (object_path ~ '^[0-9a-f-]{36}/'),
  original_filename text not null check (length(original_filename) between 1 and 400),
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  revision integer not null default 1,
  deleted_at timestamptz
);

comment on column public.documents.object_path is
  'Storage nesne yolu <circle_id>/<uuid>. Orijinal dosya adı ayrı sütunda '
  'tutulur; hasta adı veya teşhis dosya yoluna yazılmaz.';

comment on table public.documents is
  'Belge üst verisi. Silme akışı: deleted_at yazılır, tombstone üretilir, '
  'Storage nesnesi ayrı bir temizlik işiyle kaldırılır (kuyruklu silme).';

create index documents_circle_active_idx
  on public.documents (circle_id)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Ortak kural: viewer yalnız SELECT; owner ve caregiver içerik yazar/günceller.
-- Her politika aktif kayıt filtresini (deleted_at is null) içerir.

alter table public.tasks enable row level security;
alter table public.tasks force row level security;

create policy tasks_select_member on public.tasks
  for select to authenticated
  using (public.is_circle_member(circle_id));

create policy tasks_insert_writer on public.tasks
  for insert to authenticated
  with check (public.can_write_circle(circle_id));

create policy tasks_update_writer on public.tasks
  for update to authenticated
  using (deleted_at is null and public.can_write_circle(circle_id))
  with check (public.can_write_circle(circle_id));

alter table public.task_completions enable row level security;
alter table public.task_completions force row level security;

create policy task_completions_select_member on public.task_completions
  for select to authenticated
  using (public.is_circle_member(circle_id));

create policy task_completions_insert_writer on public.task_completions
  for insert to authenticated
  with check (public.can_write_circle(circle_id));

-- Tamamlama kaydı güncellenmez ve silinmez: geri alma void kaydı üretir.
-- Bu, geçmişin sessizce değiştirilmesini engeller.

alter table public.medications enable row level security;
alter table public.medications force row level security;

create policy medications_select_member on public.medications
  for select to authenticated
  using (public.is_circle_member(circle_id));

create policy medications_insert_writer on public.medications
  for insert to authenticated
  with check (public.can_write_circle(circle_id));

create policy medications_update_writer on public.medications
  for update to authenticated
  using (deleted_at is null and public.can_write_circle(circle_id))
  with check (public.can_write_circle(circle_id));

alter table public.health_records enable row level security;
alter table public.health_records force row level security;

create policy health_records_select_member on public.health_records
  for select to authenticated
  using (public.is_circle_member(circle_id));

create policy health_records_insert_writer on public.health_records
  for insert to authenticated
  with check (public.can_write_circle(circle_id));

create policy health_records_update_writer on public.health_records
  for update to authenticated
  using (deleted_at is null and public.can_write_circle(circle_id))
  with check (public.can_write_circle(circle_id));

alter table public.documents enable row level security;
alter table public.documents force row level security;

create policy documents_select_member on public.documents
  for select to authenticated
  using (public.is_circle_member(circle_id));

create policy documents_insert_writer on public.documents
  for insert to authenticated
  with check (public.can_write_circle(circle_id));

create policy documents_update_writer on public.documents
  for update to authenticated
  using (deleted_at is null and public.can_write_circle(circle_id))
  with check (public.can_write_circle(circle_id));

-- ---------------------------------------------------------------------------
-- Trigger'lar
-- ---------------------------------------------------------------------------

create trigger tasks_set_revision
  before update on public.tasks
  for each row execute function public.bump_revision();

create trigger medications_set_revision
  before update on public.medications
  for each row execute function public.bump_revision();

create trigger health_records_set_revision
  before update on public.health_records
  for each row execute function public.bump_revision();

create trigger documents_set_revision
  before update on public.documents
  for each row execute function public.bump_revision();

create trigger tasks_record_tombstone
  after update on public.tasks
  for each row execute function public.record_tombstone();

create trigger medications_record_tombstone
  after update on public.medications
  for each row execute function public.record_tombstone();

create trigger health_records_record_tombstone
  after update on public.health_records
  for each row execute function public.record_tombstone();

create trigger documents_record_tombstone
  after update on public.documents
  for each row execute function public.record_tombstone();
