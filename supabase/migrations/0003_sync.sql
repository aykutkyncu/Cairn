-- 0003_sync.sql
-- Senkronizasyon altyapısı: tombstone tablosu.
--
-- Neden ayrı bir tablo: silinen kayıt fiziksel olarak kaldırılırsa çevrimdışı
-- cihaz onu bir sonraki sync'te "sunucuda yok, demek ki benim yerelim daha yeni"
-- diye yorumlayıp geri gönderebilir. Tombstone, silmeyi cihazlara açıkça bildirir.

create table public.sync_tombstones (
  id bigint generated always as identity primary key,
  circle_id uuid not null references public.circles (id) on delete cascade,
  -- Silinen kaydın tablosu. Enum yerine text: yeni tablo eklemek migration
  -- gerektirmesin, fakat yalnız bilinen tablolar yazılsın diye kontrol var.
  entity_table text not null check (
    entity_table in (
      'circle_members',
      'tasks',
      'task_completions',
      'medications',
      'health_records',
      'documents',
      'expenses',
      'settlements'
    )
  ),
  entity_id uuid not null,
  deleted_at timestamptz not null default now(),
  constraint sync_tombstones_entity_unique unique (entity_table, entity_id)
);

comment on table public.sync_tombstones is
  'Silinen kayıtların cihazlara bildirilmesi için tombstone kaydı. Tombstone '
  'tüm cihazlara indiği doğrulanmadan fiziksel silme yapılmaz.';

-- Artımlı sync bu indeksi kullanır: son sync zamanından sonrakiler.
create index sync_tombstones_circle_cursor_idx
  on public.sync_tombstones (circle_id, deleted_at, id);

alter table public.sync_tombstones enable row level security;
alter table public.sync_tombstones force row level security;

-- Tombstone yalnız okunur. Yazma trigger üzerinden, kullanıcı adına değil
-- tablo sahibi hakkıyla yapılır.
create policy sync_tombstones_select_member on public.sync_tombstones
  for select to authenticated
  using (public.is_circle_member(circle_id));

-- ---------------------------------------------------------------------------
-- Tombstone trigger fonksiyonu
-- ---------------------------------------------------------------------------
-- Bilinçli olarak sync_tombstones tablosundan SONRA tanımlanır: fonksiyon
-- gövdesi oluşturulurken doğrulanmasa da, yazdığı tabloyla aynı migration'da
-- durması sıra hatalarını görünür kılar.

-- Yumuşak silmede tombstone üretir. Fiziksel silme yapılmaz; tombstone
-- cihazlara indikten sonra temizlik ayrı bir bakım işidir.
create or replace function public.record_tombstone()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    insert into public.sync_tombstones (circle_id, entity_table, entity_id, deleted_at)
    values (new.circle_id, tg_table_name, new.id, new.deleted_at)
    on conflict (entity_table, entity_id) do update
      set deleted_at = excluded.deleted_at;
  end if;
  return new;
end;
$$;

comment on function public.record_tombstone() is
  'deleted_at ilk kez dolduğunda sync_tombstones kaydı üretir; silinen verinin '
  'senkronizasyonda geri gelmesini engeller.';
