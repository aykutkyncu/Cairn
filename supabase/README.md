# supabase

Cairn'in veritabanı şeması, RLS politikaları ve pgTAP testleri.

## ER kararları

**Çember (circle) her şeyin sahibidir.** Neredeyse tüm tablolarda `circle_id`
bulunur ve tüm yetkilendirme bu sütun üzerinden yapılır. Bu, RLS politikalarını
tek bir soruya indirger: "çağıran bu çemberde ne yapabilir?"

**Zaman dilimi çemberin özelliğidir, cihazın değil.** `circles.timezone` bir IANA
adıdır ve varlığı `pg_timezone_names` ile doğrulanır. İstanbul'daki ve Berlin'deki
iki bakım vereni aynı günü aynı gün olarak görmelidir; bu ancak ortak bir
referans zaman dilimiyle mümkündür.

**Görev tekrarı kural olarak saklanır.** `tasks` tablosunda `dtstart_local_date`,
`dtstart_local_time` ve `rrule` bulunur; occurrence'lar önceden üretilmez.
Başlangıç saati `timestamptz` değil `time`'dır: DST geçişinde kullanıcı "sabah
08:00" beklentisini korur, UTC ofsetini değil.

**Tamamlama silinmez.** `task_completions` üzerinde UPDATE ve DELETE politikası
yoktur. Geri alma, `kind = 'void'` ve `voids_completion_id` ile yeni bir kayıt
üretir. Geçmiş sessizce değiştirilemez.

**Aynı örnek bir kez tamamlanır.** `(task_id, occurrence_id)` üzerinde
`kind <> 'void'` koşullu benzersiz indeks vardır. İki kişi aynı anda tamamlarsa
ikincisi 23505 alır ve istemci bunu "zaten tamamlanmış" olarak ele alır.
İstemci ayrıca `mutation_id` taşır: çevrimdışı outbox aynı kimlikle yeniden
denediğinde ikinci satır oluşmaz.

**Silme fiziksel değildir.** Silinebilen kaynaklarda `deleted_at` vardır ve bir
trigger `sync_tombstones` kaydı üretir. Tombstone olmadan çevrimdışı bir cihaz
silinmiş kaydı "sunucuda yok, benim yerelim daha yeni" diye geri gönderebilirdi.

**Para integer kuruştur.** `amount_minor bigint`. Float hiçbir yerde
kullanılmaz. Kur çevrimi yapılmaz; farklı para birimleri ayrı gösterilir.
Bölüşüm payları masrafın anındaki snapshot'ıdır ve çember varsayılanı sonradan
değişse bile değişmez.

**Sistem aktörü null'dur.** Zamanlanmış işlerin ürettiği kayıtlarda `created_by`
null bırakılır. `auth.uid()` yokken sahte bir kullanıcı kimliği üretilmez.

## Yetkilendirme modeli

| Rol         | Okur | İçerik yazar | Üye yönetir | Çemberi siler |
| ----------- | ---- | ------------ | ----------- | ------------- |
| `viewer`    | ✓    | ✗            | ✗           | ✗             |
| `caregiver` | ✓    | ✓            | ✗           | ✗             |
| `owner`     | ✓    | ✓            | ✓           | ✓             |

Yardımcı fonksiyonlar: `is_circle_member`, `circle_role_of`, `can_write_circle`,
`is_circle_owner`.

Bunlar **SECURITY DEFINER**'dır, çünkü `circle_members` üzerindeki RLS
politikaları kendilerini değerlendirirken sonsuz özyineleme oluşur. Riski
sınırlayan dört önlem:

1. `search_path` `public, pg_temp` olarak sabitlenir.
2. Fonksiyonlar **yalnız `auth.uid()` için** cevap verir. Çağıran, başka bir
   kullanıcının üyeliğini sorgulayamaz; bu, RLS'yi atlatan bir okuma yüzeyi
   açılmasını engeller.
3. `EXECUTE` yetkisi `PUBLIC`'ten alınır, yalnız `authenticated`'a verilir.
4. Dönüş değeri boolean/enum'dur; satır verisi sızdırmaz.

Her tabloda `FORCE ROW LEVEL SECURITY` açıktır. Bu bilinçlidir: migration rolü
ve tablo sahibi normalde RLS'yi atlar, `FORCE` bu boşluğu kapatır.

### Yetki yükseltme koruması

`circle_members_leave_self` politikası bir kullanıcının kendi üyelik satırını
güncellemesine izin verir (çemberi bırakabilmesi için). RLS `WITH CHECK` ifadesi
`OLD` satırını göremediği için tek başına "rolünü değiştirmesin" diyemez —
kullanıcı kendini `owner` yapabilirdi. Bu yüzden
`guard_membership_role_change()` trigger'ı rol değişikliğini ve üyeliğin başka
çembere taşınmasını engeller.

## Denetim kaydının bilinen sınırları

`audit_log` yalnız INSERT/UPDATE/DELETE olaylarını kaydeder.

- **SQL trigger'ları SELECT'i yakalayamaz.** "Kim hangi sağlık kaydını
  görüntüledi" sorusu bu tabloyla cevaplanamaz. Görüntüleme denetimi gerekirse
  ileride kontrollü bir erişim katmanı (RPC veya Edge Function üzerinden okuma)
  olarak ayrıca ele alınmalıdır.
- **Satır içeriği saklanmaz**, yalnız değişen sütun adları. Sağlık verisinin
  denetim kaydına kopyalanması, veriyi tek yerde korumayı imkânsız kılardı.

## Storage

`documents` bucket'ı **private**'tır; imzasız erişim yoktur. Nesne yolu düzeni
`<circle_id>/<uuid>.<ext>`. `storage.objects` politikaları yolun ilk parçasını
çember kimliği olarak çözer ve üyeliği doğrular; yol geçersizse `null` döner ve
null yetki vermez.

Orijinal dosya adı `documents.original_filename` sütununda tutulur. Böylece
hasta adı veya teşhis dosya yoluna ve imzalı URL'e sızmaz.

Belge silme sırası bilinçlidir: önce `deleted_at` yazılır (tombstone üretilir,
cihazlar öğrenir), Storage nesnesi **sonra** ayrı bir temizlik işiyle kaldırılır.
Ters sırada cihazda kırık referans kalırdı.

## Testleri çalıştırma

pgTAP testleri yerel bir Postgres gerektirir; Supabase CLI bunu Docker ile
ayağa kaldırır.

```bash
npm run db:start     # supabase db start   (Docker gerekir)
npm run db:test      # supabase test db
npm run db:reset     # şemayı sıfırdan uygula
npm run db:types     # database.types.ts üret
```

**Docker kurulu değilse** bu testler yerelde koşmaz. CI'daki `database` işi
(`.github/workflows/ci.yml`) aynı testleri GitHub runner'ında çalıştırır; public
repoda Actions dakikası sınırsız olduğu için bu ücretsizdir.

## Free tier ve duraklama

Supabase free tier projeleri yeterince uzun süre hareketsiz kalırsa duraklatılır.
`.github/workflows/supabase-keepalive.yml` düzenli aralıkla zararsız bir anon
okuma isteği göndererek bunu **denemek** için vardır.

Bu bir garanti değildir. Sağlayıcı politikası değişebilir. İş akışı yalnız
public/anon anahtar kullanır; `service_role` hiçbir GitHub secret'ına konmaz.
Etkinleştirmek için repo değişkeni `SUPABASE_KEEPALIVE_ENABLED=true` ve
`SUPABASE_URL` / `SUPABASE_ANON_KEY` secret'ları tanımlanmalıdır.
