-- 0007_audit.sql
-- Denetim kaydı.
--
-- BİLİNEN SINIR: SQL trigger'ları SELECT'i yakalayamaz. Bu tablo yalnız
-- INSERT/UPDATE/DELETE olaylarını kaydeder. "Kim hangi sağlık kaydını
-- GÖRÜNTÜLEDİ" sorusu trigger ile cevaplanamaz; görüntüleme denetimi gerekirse
-- ileride kontrollü bir erişim katmanı (RPC veya Edge Function üzerinden okuma)
-- olarak ayrıca ele alınmalıdır. Bu dosya o boşluğu kapatıyormuş gibi davranmaz.
--
-- İKİNCİ SINIR: audit_log satır İÇERİĞİNİ saklamaz. Yalnız hangi tabloda,
-- hangi kayıtta, ne tür bir değişiklik olduğunu ve hangi sütunların değiştiğini
-- tutar. Sağlık verisinin denetim kaydına kopyalanması, veriyi tek yerde
-- korumayı imkânsız kılardı.

create table public.audit_log (
  id bigint generated always as identity primary key,
  circle_id uuid references public.circles (id) on delete set null,
  entity_table text not null,
  entity_id uuid not null,
  action public.audit_action not null,
  -- Değişen sütun adları. Değerler YAZILMAZ.
  changed_columns text[] not null default '{}',
  -- Sistem tarafından üretilen değişikliklerde null: auth.uid() yokken sahte
  -- kullanıcı kimliği üretilmez.
  actor_user_id uuid references auth.users (id) on delete set null,
  occurred_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Yazma denetimi. Satır içeriği saklanmaz, yalnız değişen sütun adları. '
  'SELECT olayları trigger ile yakalanamaz; bu tablo görüntüleme denetimi vermez.';

comment on column public.audit_log.actor_user_id is
  'Sistem aktörü tarafından üretilen değişikliklerde null.';

create index audit_log_circle_time_idx on public.audit_log (circle_id, occurred_at desc);
create index audit_log_entity_idx on public.audit_log (entity_table, entity_id);

-- ---------------------------------------------------------------------------
-- Denetim trigger fonksiyonu
-- ---------------------------------------------------------------------------

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_circle_id uuid;
  target_entity_id uuid;
  changed text[] := '{}';
  audit_action_value public.audit_action;
  old_row jsonb;
  new_row jsonb;
  column_name text;
begin
  if tg_op = 'DELETE' then
    audit_action_value := 'delete';
    old_row := to_jsonb(old);
    target_entity_id := (old_row ->> 'id')::uuid;
    target_circle_id := nullif(old_row ->> 'circle_id', '')::uuid;
  elsif tg_op = 'UPDATE' then
    audit_action_value := 'update';
    old_row := to_jsonb(old);
    new_row := to_jsonb(new);
    target_entity_id := (new_row ->> 'id')::uuid;
    target_circle_id := nullif(new_row ->> 'circle_id', '')::uuid;
    for column_name in select jsonb_object_keys(new_row) loop
      if (new_row -> column_name) is distinct from (old_row -> column_name) then
        changed := array_append(changed, column_name);
      end if;
    end loop;
  else
    audit_action_value := 'insert';
    new_row := to_jsonb(new);
    target_entity_id := (new_row ->> 'id')::uuid;
    target_circle_id := nullif(new_row ->> 'circle_id', '')::uuid;
  end if;

  insert into public.audit_log (
    circle_id, entity_table, entity_id, action, changed_columns, actor_user_id
  )
  values (
    target_circle_id,
    tg_table_name,
    target_entity_id,
    audit_action_value,
    changed,
    (select auth.uid())
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.write_audit_log() from public;

comment on function public.write_audit_log() is
  'Yazma olaylarını audit_log''a kaydeder. Yalnız değişen sütun ADLARINI yazar; '
  'satır değerleri denetim kaydına kopyalanmaz.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

-- Denetim kaydını yalnız çember sahibi okur. Değiştirilemez ve silinemez:
-- INSERT/UPDATE/DELETE için politika tanımlanmaz, bu yüzden istemci yazamaz.
create policy audit_log_select_owner on public.audit_log
  for select to authenticated
  using (circle_id is not null and public.is_circle_owner(circle_id));

-- ---------------------------------------------------------------------------
-- Denetim trigger'larının bağlanması
-- ---------------------------------------------------------------------------

create trigger circles_audit
  after insert or update or delete on public.circles
  for each row execute function public.write_audit_log();

create trigger circle_members_audit
  after insert or update or delete on public.circle_members
  for each row execute function public.write_audit_log();

create trigger tasks_audit
  after insert or update or delete on public.tasks
  for each row execute function public.write_audit_log();

create trigger task_completions_audit
  after insert or update or delete on public.task_completions
  for each row execute function public.write_audit_log();

create trigger medications_audit
  after insert or update or delete on public.medications
  for each row execute function public.write_audit_log();

create trigger health_records_audit
  after insert or update or delete on public.health_records
  for each row execute function public.write_audit_log();

create trigger documents_audit
  after insert or update or delete on public.documents
  for each row execute function public.write_audit_log();

create trigger expenses_audit
  after insert or update or delete on public.expenses
  for each row execute function public.write_audit_log();

create trigger settlements_audit
  after insert or update or delete on public.settlements
  for each row execute function public.write_audit_log();
