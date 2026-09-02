# supabase/tests

pgTAP tabanlı RLS ve politika davranış testleri.

| Dosya                                   | Kapsam                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `0001_rls_isolation.test.sql`           | Çember izolasyonu, rol yetkileri, politikasız tablo yok (Faz 02)       |
| `0002_invitations_and_storage.test.sql` | Davet tokenı gizliliği, yol çözümü, tombstone, para bütünlüğü (Faz 03) |
| `0003_documents_and_search.test.sql`    | Storage politikasının uçtan uca davranışı ve dosya araması (Faz 06)    |

Kapsanması gerekenler: başka çember okuyamaz, viewer yazamaz, caregiver çemberi silemez,
owner üye yönetimi çalışır, Storage nesnesi başka çembere görünmez.

## Çalıştırma

```bash
supabase test db
```

Yerel koşu Docker gerektirir. Docker kurulu değilse bu paket her PR'da CI'daki
**"Veritabanı ve RLS testleri"** işinde koşar (`.github/workflows/ci.yml`); orada
`supabase db start` migration'ları sıfırdan uygular, ardından `supabase test db`
çalışır. Yerelde koşmamış olmak kanıtın olmadığı anlamına gelmez — CI koşusu kanıttır;
yerelde koşmadan "geçti" demek ise iddia olur.

## Yazarken

Politikanın malzemesini değil, politikanın kendisini sına. `is_circle_member()` veya
`storage_path_circle_id()` gibi yardımcıları tek tek doğrulamak, o yardımcıları
kullanan politikanın doğru yazıldığını göstermez. Gerçek sorguyu çalıştır.

Her yasaklama testinin yanına olumlu kontrol koy. "Yabancı göremiyor" iddiası, özellik
hiç çalışmadığında da geçer; asıl kanıt yetkilinin görebildiğinin aynı yerde
gösterilmesidir.
