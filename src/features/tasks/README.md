# src/features/tasks

Bakım takvimi: görevler, tekrar kuralları ve tamamlama kayıtları.

> Bu klasör Faz 05'in çekirdeğidir ve **parça parça** kuruluyor. Şu an
> tamamlanan: zaman dilimi hesapları, occurrence kimliği ve tekrar motoru.
> Henüz yok: Bugün ekranı, görev oluşturma, tamamlama akışı ve offline outbox.

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
