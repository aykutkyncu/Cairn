# src/features/medical

Tıbbi dosya: ilaçlar, alerjiler, teşhisler, doktorlar, ölçümler ve notlar.

> Faz 06 durumu (3/n): ilaç ve sağlık kaydı okuma/yazma, Dosya ekranı, rol
> davranışı, ilaçtan göreve açık onaylı geçiş, notlar ve randevu soruları,
> çakışma korumalı düzenleme, arama ekranı ve belge yükleme/görüntüleme
> tamamlandı. **Henüz yok:** OCR (native derleme gerektirir), kayıt ve belge
> silme, not yazarının adı (profil sorgusu yazılmadı; uydurmak yerine yalnız
> tarih gösterilir).
>
> İlaç oluşturma ve listeleme **gerçek Supabase'e karşı bir kez çalıştırıldı**
> (depo sahibi, web hedefinde). Diğer akışlar yalnız birim testleriyle
> kanıtlıdır.

## Buradaki her metin sağlık verisidir

İlaç adı, teşhis başlığı, not gövdesi ve **kullanıcının arama sorgusu** özel
nitelikli kişisel veridir. Hiçbiri log'a, analytics'e, push bildirimine, hata
kaydına veya URL'ye yazılmaz. Repository'deki log satırları yalnız işlem adını
ve Postgres hata kodunu taşır; testler bunu sabitler
(`__tests__/medical-repository.test.ts`).

## Otomatik ilaç hatırlatması yoktur

Sözleşmenin açık maddesi: bir ilaç kaydı **kendiliğinden görev üretmez**.
`medicationTaskPrefill` hiçbir şey kaydetmez; yalnız görev formunun başlangıç
başlığını hazırlar. Saat, tekrar ve kaydetme kararı kullanıcınındır.

Akış şudur:

```
ilaç kaydedildi
  → "Hatırlatma kurulmadı." (açık bilgi)
  → kullanıcı isterse → görev formu ön dolgulu açılır
  → saat/tekrar seçilir → kullanıcı kaydeder
```

Ön dolgu yalnız `title` ve `kind` taşır. Saat taşısaydı, form kullanıcı hiç
dokunmadan kaydedilebilir görünürdü — bu, otomatik hatırlatmanın kılık
değiştirmiş hali olurdu.

## Aktif ilaç kararı

`isActiveMedication`, bitiş günü **bugün ise ilacı hâlâ aktif sayar**. "Bugüne
kadar" diyen bir reçetede son günü geçmişe atmak, bakım vereni o gün ilacı
atlamaya yöneltirdi.

Karşılaştırma **çemberin** gününe göredir, cihazın değil: İstanbul'daki ve
Berlin'deki iki bakım veren aynı listeyi görmelidir.

## Serbest metin kalıba zorlanmaz

Doz ve sıklık serbest metindir. "500 mg", "yarım tablet", "gerektiğinde" hepsi
geçerlidir. Doğrulama yalnız uzunluğa bakar; içeriği bir kalıba sokmak kaydı
bakım verenin gerçekliğinden uzaklaştırırdı.

Gövde metnine **genel amaçlı temizleme uygulanmaz** (sözleşme maddesi). Metin
ham saklanır ve çıktı tarafında HTML olarak işlenmez.

## Düzenlemede sessiz son-yazan-kazan yoktur

Sözleşme sağlık metninde sessiz üzerine yazmayı yasaklar. `updateHealthRecord`
bu yüzden `revision = baseRevision` koşuluyla yazar: `baseRevision`,
kullanıcının düzenlemeye başlarken okuduğu sürümdür. Aradan başka biri
yazdıysa koşul tutmaz, hiçbir satır güncellenmez ve `conflict` döner. Ekran
bunu **kullanıcıya gösterir** ve yazdığını "gönderildi" saymaz.

`revision` ve `updated_at` istemciden gönderilmez; ikisini de sunucu
trigger'ı yazar (`0001_foundation.sql`). İstemcinin sürüm numarasına güvenmek,
çakışma denetimini istemcinin eline bırakmak olurdu.

Not kartındaki "düzenlendi" etiketi `revision > 1` demektir: okuyan kişi,
metnin ilk hali olmadığını bilmelidir.

## Sağlık verisi rota parametresine yazılmaz

Düzenleme ekranı kaydı **yalnız kimliğiyle** alır ve metni sunucudan okur.
Başlık ve gövdeyi parametreyle taşımak, sağlık verisini URL'ye yazmak olurdu —
sözleşmenin açık yasağı. Aynı nedenle arama sorgusu da rotaya değil, yalnız
bileşen durumuna yazılır.

## Arama sunucuya gider

`searchHealthRecords` sorguyu sunucuya gönderir; güvenlik RLS ve `circle_id`
koşuluyla sağlanır. "Aramanız cihazınızdan çıkmıyor" demek yanlış bir gizlilik
vaadi olurdu ve söylenmez.

Arama metnindeki `%`, `_` ve `\` kaçırılır: kaçırılmazsa kullanıcının yazdığı
düz metin PostgREST `ilike` kalıbında joker olur ve yazmadığı satırlar dönerdi.
İki harften kısa sorgu sunucuya hiç gitmez.

## Rol davranışı

`MedicalFileView` yazma yetkisi olmayan üyeye (viewer) ekleme düğmesi
çizmez. **Bu bir güvenlik sınırı değildir** — yazma yetkisi RLS'tedir; buradaki
amaç çalışmayacak bir düğme göstermemektir.

## Önbellek kalıcı değildir

Sunucu verisi TanStack Query önbelleğinde, yani bellekte yaşar; uygulama
kapanınca gider. Çevrimdışı okuma Faz 07'nin şifreli yerel deposuna aittir.
Burada uydurulmuş bir "çevrimdışı dosya" vaadi verilmez.

## Belgeler

Bucket **private**'tır (`0008_storage.sql`). Görüntüleme yalnız **60 saniyelik
imzalı URL** ile yapılır ve adres her açılışta yeniden üretilir; önbelleğe
alınmaz. İmzalı adres, elde edildikten sonra oturumdan bağımsız çalışır —
paylaşılan veya loglanan bir URL, süresi dolana dek belgeye erişim demektir.
Bu yüzden URL loglanmaz.

### Nesne yolu hasta adı taşımaz

Yol düzeni `<circle_id>/<uuid>.<ext>`. Orijinal dosya adı ayrı sütunda durur.
"tahlil-sonucu-fatma-demir.jpg" yola girseydi, hasta adı imzalı URL üzerinden
sızardı. `buildObjectPath` dosya adını parametre olarak bile almaz.

Yolun ilk parçası çember kimliğidir; Storage politikası yetkiyi oradan
doğrular.

### Yükleme sırası

```
1. kullanıcı kaynağı SEÇER (kamera / galeri)   - kendiliğinden açılmaz
2. görsel CİHAZ ÜZERİNDE küçültülür            - uzun kenar 2000 px, kalite 0.7
3. sınır denetlenir                            - tür + boyut, sunucuya gitmeden
4. Storage'a yüklenir                          - nesne adı UUID, upsert kapalı
5. üst veri yazılır                            - orijinal ad ayrı sütunda
```

5. adım başarısız olursa 4. adımdaki nesne **silinir**: kimsenin göremeyeceği
   bir dosyayı depoda bırakmak, silme akışının dışında kalan bir sağlık belgesi
   bırakmaktır.

Denetim küçültmeden **sonra** yapılır. Küçültme denenmeden reddetmek,
kullanıcının elindeki tek belgeyi kullanılamaz ilan etmek olurdu.

İstemci sınırı (4 MB) sunucu sınırının (15 MB) altındadır: sunucu sınırına
dayanmak, hatayı yükleme bittikten sonra göstermek olurdu.

**Sıkışma oranı hakkında vaat verilmez.** "Her 10 MB görsel 1 MB olur" demek
yanlış olurdu; oran görselin içeriğine bağlıdır.

### İptal ve izin reddi hata değildir

İkisi de olağan sonuçtur ve `UploadOutcome` içinde döner. Vazgeçen kullanıcıya
kırmızı bir uyarı göstermek, onu hata yapmış gibi hissettirirdi.

### OCR yoktur

Kılavuzun OCR maddesi bu adımda uygulanmadı: cihaz üstü OCR native
development build gerektirir ve iOS/Android derlemesi henüz alınmadı.
Çalıştırılamayan bir özelliği "var" göstermemek için hiç eklenmedi. Eklendiğinde
sözleşme gereği ham metin sunucuya, loga veya hata raporuna gitmeyecek ve sonuç
kullanıcı onaylayana dek taslak sayılacaktır.
