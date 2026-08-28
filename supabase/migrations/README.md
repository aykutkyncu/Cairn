# supabase/migrations

Numaralı, ileri yönlü SQL migration'ları (Faz 02).

- Her tabloda RLS açık ve en az bir politika bulunur.
- SECURITY DEFINER fonksiyonlarında `search_path` `public, pg_temp` olarak sabitlenir.
- Silme işlemleri tombstone/`deleted_at` ile senkronizasyona görünür kalır.
