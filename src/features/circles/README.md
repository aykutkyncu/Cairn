# src/features/circles

Çember üyeliği, aktif çember seçimi ve roller.

## Katman sırası

```
ekran → hook (use-circles) → repository (circle-repository) → Supabase
```

Ekranlar repository'yi de doğrudan çağırmaz. Hook katmanı, önbellek anahtarını ve sorgunun
ne zaman koşacağını (oturum yokken koşmaz) tek yerde tutar.

## Aktif çember nerede yaşar

Zustand'da yalnız **bir kimlik** (`activeCircleId`) tutulur. Çemberin adı, rolü ve saat
dilimi TanStack Query önbelleğindedir. Kopyalamak, eskiyen ikinci bir doğruluk kaynağı
yaratırdı: sunucuda rolü `viewer`'a düşürülmüş bir kullanıcı, kopyadaki `caregiver`
rolüyle yazma düğmelerini görmeye devam ederdi.

Seçili kimlik listede yoksa (üyelik kaldırılmış olabilir) listedeki ilk çembere düşülür ve
bu **açıkça** yapılır. Sessizce yanlış çemberi göstermek, bakım verenin yanlış kişiye ilaç
işaretlemesine yol açabilir.

## Sunucu sütun adları arayüze sızmaz

Şema `care_recipient_name` alanını doğrular, `toCircleSummary` onu `careRecipientName`'e
çevirir. Böylece bir sütun yeniden adlandırıldığında değişiklik tek dosyada kalır.

`careRecipientName` özel nitelikli veriye işaret eder: yalnız arayüzde gösterilir; log,
analytics, push bildirimi ve hata raporuna yazılmaz.

## Rol yetkileri

| Rol         | Yazar | Davet eder |
| ----------- | ----- | ---------- |
| `owner`     | Evet  | Evet       |
| `caregiver` | Evet  | Hayır      |
| `viewer`    | Hayır | Hayır      |

Bu tablo **arayüz** kararıdır, güvenlik sınırı değildir. Gerçek yetki sunucudaki RLS
politikaları ve `0009_membership_rpc.sql` içindeki fonksiyonlardadır. İstemcideki kontrol
yalnız kullanıcıya çalışmayacak bir düğme göstermemek içindir.
