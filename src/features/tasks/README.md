# src/features/tasks

Bakım takvimi: görevler, tekrar kuralları ve tamamlama kayıtları.

> Faz 05 durumu: zaman dilimi hesapları, occurrence kimliği, tekrar motoru,
> gün planı, Bugün ekranı, görev oluşturma, tamamlama akışı ve çevrimdışı
> kuyruk tamamlandı. Henüz yok: takvim (ay) görünümü, görev düzenleme/silme,
> atama arayüzü ve genel senkron motoru (Faz 07).

## Duvar saati, mutlak an değil

Görev saatleri `dtstart_local_date` + `dtstart_local_time` olarak saklanır —
`timestamptz` **değil**. "Sabah 08:00 ilaç" DST geçişinde de sabah 08:00'dir; UTC ofseti
değişir, bakım verenin beklentisi değişmez.

Hesaplar **cihazın** değil **çemberin** saat dilimini kullanır. İstanbul'daki ve
Berlin'deki iki bakım veren aynı günü aynı gün altında görmelidir; aksi halde biri
"bugünün" görevini yarın altında görür.

## DST kuralları (açıkça tanımlı, test edilmiş)

| Durum                                                | Karar                                    |
| ---------------------------------------------------- | ---------------------------------------- |
| İleri atlama — duvar saati o gün **yok** (ör. 02:30) | Atlamadan sonraki ilk gerçek ana çekilir |
| Geri atlama — duvar saati **iki kez** yaşanır        | **İlk** geçiş kabul edilir               |

İleri atlamada görevi düşürmek, bakım verene o gün ilacı hiç göstermemek olurdu. Geri
atlamada ikinci geçişi de kabul etmek, günde bir kez tekrarlayan bir ilacı o gün iki kez
düşürürdü. İkisi de `__tests__/timezone.test.ts` içinde sabitlenmiştir.

## Occurrence kimliği

Kanonik biçim: çemberin zaman dilimindeki yerel başlangıç anı, ISO-8601 ofsetli —
`2026-08-28T08:00:00+03:00`. Bu, `supabase/migrations/0004_care.sql` içindeki sözleşmenin
aynısıdır.

Neden düz UTC değil: kimlik hem tekil hem de bir insanın bakıp "hangi gün, hangi saat"
diyebileceği kadar okunur olmalıdır. Düz UTC, DST geçişinde iki farklı duvar saatini aynı
görünüme sokabilir; ofset onları ayırır.

Neden dakika çözünürlüğü: saniye taşımak, aynı örneğin iki farklı kimlikle kaydedilme
riskini getirir. Veritabanındaki `(task_id, occurrence_id)` tekilliği ancak her cihazın
**birebir aynı** kimliği üretmesiyle çalışır — eşzamanlı tamamlamanın tek kayıt üretmesi
buna bağlıdır.

## Tekrar motoru

RFC 5545'in tamamı değil, ürünün gerçekten sunduğu dar bir alt küme uygulanır:
`FREQ=DAILY`, `FREQ=WEEKLY` (+`BYDAY`), `INTERVAL` ve `COUNT`.

Genel amaçlı bir RRULE motoru taşımak, hiç gösterilmeyen davranışları da bakmak zorunda
kalmak demektir. **Desteklenmeyen bir kural, kuralı olmayan görev gibi ele alınır: yalnız
başlangıç günü üretilir.** Az üretmek, yanlış gün üretmekten yeğdir — bakım vereni olmayan
bir göreve yönlendirmek, olan bir görevi göstermemekten daha kötüdür.

`UNTIL` bilinçli olarak desteklenmez: bitiş günü `recurrence_until_local_date` sütununda
tutulur, böylece kuralın kendisi zaman dilimi taşımak zorunda kalmaz.

Occurrence'lar **önceden üretilmez**. Veritabanında tek kural satırı vardır;
`occurrencesInRange` istenen aralık için hesaplar ve `maxResults` ile sınırlanır.

### "Günde üç kez ilaç" nasıl temsil edilir

Bir kural satırı bir saat taşır. Günde üç kez alınan bir ilaç **üç görev satırıdır**
(08:00, 14:00, 20:00) ve her biri tek kural satırıdır. Hiçbiri occurrence üretmez.

## Kullanıcı RRULE görmez

Arayüz dört hazır seçenek sunar: her gün, hafta içi, haftada bir, özel.
`describeRecurrence` kuralı Türkçe bir cümleye çevirir; ham `FREQ=...` metni hiçbir
ekranda görünmez.

## Tamamlama akışı (sırası değiştirilemez)

```
dokunuş
  → 1. kalıcı ve şifreli kuyruğa yaz   (expo-secure-store)
  → 2. yazma başarılıysa arayüzü güncelle
  → 3. bağlantı varsa sunucuya gönder
```

Kuyruğa yazma başarısızsa kullanıcıya **"kaydedildi" denmez**. Sözleşme: "Çevrimdışı yazı
yalnızca kalıcı outbox'a başarıyla yazıldıysa kullanıcının beklediği şekilde gösterilir."
Bu yüzden `enqueue` yazma bitmeden `ok: true` dönmez ve disk hatasında `write_failed`
bildirir.

Arayüz üç durumu ayırır: **işaretlenmemiş**, **gönderilecek** (kuyrukta) ve **tamam**
(sunucuda). Kuyruktaki bir kayıt "geciken" sayılmaz — kullanıcı işi yaptı, yalnız bağlantı
yok.

## İdempotanslık

Her kayıt istemcide üretilmiş kalıcı bir `mutationId` (UUID) taşır ve yeniden denemeler
**aynı kimlikle** yapılır. Sunucudaki `task_completions.mutation_id` tekilliği ikinci
denemenin yeni satır üretmesini engeller; bu yüzden "gönderdim mi bilmiyorum" durumunda
tekrar göndermek güvenlidir.

Sunucu tekil kısıt ihlali (`23505`) döndürdüğünde istemci bunu **hata değil**, "zaten
kaydedilmiş" olarak ele alır ve kaydı kuyruktan düşürür. İki durumu kapsar: aynı
`mutation_id` ile yeniden deneme, ve **başka birinin aynı örneği tamamlaması**. İkisinde de
tekrar denemek yeni bir sonuç üretmez.

## Geri alma

10 saniyelik pencerede geri alma düğmesi görünür. Geri alma **completion'ı silmez**:

- Sunucuda kayıtlı bir tamamlama → `void` kaydı üretilir (`voids_completion_id`).
- Henüz gönderilmemiş bir tamamlama → kuyruktan çıkarılır. Geçersizlenecek bir sunucu
  kaydı yoktur; `void` göndermek anlamsız olurdu.

## Kuyruğun sınırları

| Sınır          | Değer | Neden                                        |
| -------------- | ----- | -------------------------------------------- |
| `MAX_ENTRIES`  | 200   | SecureStore büyük veri için tasarlanmamıştır |
| `MAX_ATTEMPTS` | 8     | Sonsuza dek denemek pili tüketir             |

Kuyruk dolduğunda **yeni kayıt reddedilir**; en eskisi atılmaz. Kullanıcının tamamladığı
bir görevi sessizce düşürmek, ona kaydedilmemiş bir işi kaydedilmiş göstermekten daha
kötüdür — çağıran taraf reddi kullanıcıya bildirmek zorundadır.

Deneme sınırını aşan kayıt **kuyrukta kalır ama gönderilmez**: sessizce atmak kullanıcının
işini kaybetmektir. Bu kayıtlar `listStuck()` ile alınıp kullanıcıya gösterilmelidir —
**bu arayüz henüz yazılmadı.**

## Web'de kuyruk kalıcı değildir

`expo-secure-store` web'de yoktur. Bu platformda kuyruk bellekte tutulur ve uygulama
kapanınca kaybolur; `enqueue` bunu `not_persistent` ile bildirir. `localStorage`'a sağlık
verisi yazmak, mobil şifreleme vaadini sessizce web'e taşımak olurdu.
