# src/features/app-shell

Uygulamanın çevresi: sağlayıcı ağacı, ağ durumu ve hata sınırının raporlama bağlantısı.

## Sağlayıcı sırası

```
ErrorBoundary
  └── ThemeProvider
        └── QueryClientProvider
              └── uygulama
```

Hata sınırı en dıştadır ki bir sağlayıcının kurulumunda oluşan hata da yakalansın. Tema
sınırın **içindedir**, böylece hata ekranı da kullanıcının seçtiği temada görünür.

## Sorgu önbelleği ve oturum

`AppProviders`, önbellek temizleyicisini `registerSessionCleaner` ile kaydeder. Bunun yönü
bilinçlidir: auth modülü sorgu katmanını tanımaz, sorgu katmanı kendini auth'a tanıtır.
Ters yön, kimlik modülünü tüm veri katmanına bağımlı hale getirirdi.

Çıkışta `clearQueryCache` önce devam eden sorguları iptal eder, sonra önbelleği boşaltır.
Yalnız `clear()` çağırmak yetmez: uçuşta olan bir yanıt, temizlenmiş önbelleğe geri
yazılabilir ve bir sonraki kullanıcı öncekinin verisini görebilirdi.

## Ağ durumu

`onlineManager` tek doğruluk kaynağıdır: arayüzün gösterdiği çevrimdışı şerit ile
sorguların davranışı aynı sinyalden beslenir. İkinci bir ağ dinleyicisi kurmak, ikisinin
ayrışabildiği bir pencere yaratırdı.

Çevrimiçi sayılmak için `isInternetReachable` açıkça `true` olmalıdır. Bağlı olmak yetmez:
portal arkasındaki Wi-Fi bağlı görünür, hiçbir isteği geçirmez. Erişilebilirlik henüz
ölçülmediyse çevrimiçi varsayılır — kullanıcıyı yanlışlıkla engellemek, isteği deneyip
gerçek hatayı görmekten kötüdür.

## Hata raporlama

**Raporlayıcı kurulu değildir.** `src/lib/error-reporting.ts` içindeki fonksiyonlar, bir
raporlayıcı eklendiğinde `beforeSend` ve `beforeBreadcrumb` kancalarına bağlanmak üzere
saf fonksiyon olarak yazılmış ve birim testleriyle sınanmıştır.

Temizlik **alan adına göre değil, izin listesine göre** yapılır. "Adı `note` olan alanı sil"
yaklaşımı, yarın eklenen `observation` alanını kaçırırdı. Varsayılan davranış "düşür"dür;
yalnız hassas olmadığı bilinen anahtarlar geçer.

Hata sınırı, yakaladığı hatanın **mesajını ve yığın izini taşımaz**. Bir render hatası çoğu
zaman render edilen değeri (bir ilaç adı, bir not) mesajın içinde taşır. Rapora yalnız
hatanın sınıfı ve en üstteki bileşenin adı gider.
