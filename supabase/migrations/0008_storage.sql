-- 0008_storage.sql
-- Belge deposu: private bucket ve üyelik denetimli storage.objects politikaları.
--
-- Nesne yolu düzeni: <circle_id>/<uuid>.<ext>
-- Yolun ilk parçası çember kimliğidir; politika yetkiyi buradan doğrular.
-- Orijinal dosya adı documents.original_filename sütununda tutulur, böylece
-- hasta adı veya teşhis dosya yoluna ve imzalı URL'e sızmaz.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  -- private: imzasız erişim yok. İmzalı URL kısa ömürlüdür (uygulama katmanı).
  false,
  -- 15 MB. Yükleme öncesi cihaz üzerinde yeniden boyutlandırma yapılır.
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

-- Nesne yolunun ilk klasörü geçerli bir çember kimliği mi ve çağıran o çemberde
-- yetkili mi? storage.foldername(name) yol parçalarını dizi olarak döndürür.
create or replace function public.storage_path_circle_id(object_name text)
returns uuid
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
  first_segment text;
begin
  first_segment := split_part(object_name, '/', 1);
  if first_segment !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return null;
  end if;
  return first_segment::uuid;
exception
  when others then
    return null;
end;
$$;

comment on function public.storage_path_circle_id(text) is
  'Storage nesne yolunun ilk parçasını çember kimliği olarak çözer. Geçersiz '
  'biçimde null döner; null yetki vermez.';

alter table storage.objects enable row level security;

-- Okuma: yalnız çember üyesi. Nesne yolu geçersizse (null) erişim reddedilir.
create policy documents_read_circle_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and public.storage_path_circle_id(name) is not null
    and public.is_circle_member(public.storage_path_circle_id(name))
  );

-- Yükleme: yalnız yazma yetkisi olan roller (owner, caregiver). Viewer yükleyemez.
create policy documents_insert_circle_writer on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.storage_path_circle_id(name) is not null
    and public.can_write_circle(public.storage_path_circle_id(name))
  );

create policy documents_update_circle_writer on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and public.storage_path_circle_id(name) is not null
    and public.can_write_circle(public.storage_path_circle_id(name))
  )
  with check (
    bucket_id = 'documents'
    and public.storage_path_circle_id(name) is not null
    and public.can_write_circle(public.storage_path_circle_id(name))
  );

-- Silme: yazma yetkisi olan roller. Belge silme akışı:
--   1. documents.deleted_at yazılır -> tombstone üretilir (cihazlar öğrenir)
--   2. Storage nesnesi ayrı bir temizlik işiyle kaldırılır
-- Sıra bilinçlidir: nesne önce silinirse cihazda kırık referans kalır.
create policy documents_delete_circle_writer on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.storage_path_circle_id(name) is not null
    and public.can_write_circle(public.storage_path_circle_id(name))
  );
