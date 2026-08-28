# Cairn - Proje Sözleşmesi

## Ürün ve sınırlar

Cairn, bakımı paylaşan aileler için ortak operasyon uygulamasıdır. Birincil kullanıcı hasta değil, bakımı yöneten kişidir. Her ürün kararı şu soruyu geçmelidir: Bu, bakım verenin yükünü azaltıyor mu?

Uygulama tıbbi tavsiye vermez, teşhis koymaz ve ilaç doğruluğunu garanti etmez. Sağlık verisi özel nitelikli kişisel veridir. Harici AI veya analiz hizmetine sağlık verisi ancak ilgili, ayrı açık rıza ve yazılı veri akışı değerlendirmesinden sonra gönderilebilir. AI kapalı veya kullanılamaz durumdayken tüm temel akışlar çalışır.

## Teknik sözleşme

- TypeScript strict, noUncheckedIndexedAccess, noImplicitOverride ve exactOptionalPropertyTypes açık. `any`, `@ts-ignore` ve `eslint-disable` gerekçesiz kullanılamaz.
- Uyumlu paketleri `npx expo install` ile kur. Expo, React Native ve tüm paket sürümlerini package-lock ile kilitle; başlangıçta güncel kararlı Expo SDK'yı kaydet ama uygulama sırasında rastgele yükseltme yapma.
- Her Supabase tablosunda RLS açık, en az bir politika ve RLS davranış testi bulunur. İstemciye `service_role` anahtarı asla konmaz.
- Sunucudan gelen her veri, kullanıldığı sınırda Zod ile doğrulanır. Parse hataları hassas içeriği içermeden raporlanır.
- Token, şifreleme anahtarı ve küçük sırlar yalnızca SecureStore'da tutulur. Sağlık verisi log, analytics, push bildirimi, hata kaydı veya URL içine yazılmaz.
- Kullanıcı verisini HTML olarak işleme, doğrulanmamış deep link çalıştırma ve sınırsız WebView kullanma. Girdiyi bağlama uygun doğrula; sağlık notunun içeriğini bozacak genel metin temizleme yapma.
- Ekranlar veri istemcisine doğrudan erişmez. İş mantığı feature katmanında, kullanıcı arayüzü `src/app` altında, paylaşılmış tasarım `src/ui` altında yaşar.
- Her asenkron akış loading, empty, error ve offline durumunu açıkça ele alır. Çevrimdışı yazı yalnızca kalıcı outbox'a başarıyla yazıldıysa kullanıcının beklediği şekilde gösterilir.

## Veri ve güvenlik sözleşmesi

- Zaman damgaları `timestamptz`; para integer kuruş; roller PostgreSQL enum; silme işlemleri tombstone/`deleted_at` ile senkronizasyona görünür olur.
- Tekrarlı görevler kural olarak saklanır. Tamamlama kaydı `occurrence_id` ve idempotency/`mutation_id` ile tekilleştirilir.
- Offline senkronizasyonda her istemci mutasyonu kalıcı kimlik taşır. Sessiz son-yazan-kazan, sağlık metninde yasaktır. Silinen verinin geri gelmesini önleyecek tombstone senkronizasyonu vardır.
- RLS yardımcı fonksiyonları SECURITY DEFINER ise `search_path` sabitlenir, minimum yetkiyle sahiplenilir ve migration testleriyle sınanır.

## Erişilebilirlik ve kalite

- Arayüz metinleri i18n anahtarlarıdır. Varsayılan dil Türkçe. Dokunma hedefi en az 44x44 pt; erişilebilir isim/rol/hint bağlama göre eksiksizdir.
- Tema tokenları dışında doğrudan renk kullanılmaz. Metin kutuları dinamik yazı boyutuyla büyür; renk tek başına anlam taşımaz.
- Yeni iş mantığı için birim testi, yeni RLS davranışı için yetkisiz erişim testi yazılır. Pre-commit yalnızca kolaylık katmanıdır; gerçek kapı CI ve branch protection'dır.

## Claude Code çalışma biçimi

Bir faza başlamadan önce CLAUDE.md'yi, mevcut dosyaları ve açık testleri oku. Kod yazmadan önce değiştireceğin dosyaları ve açık varsayımları tek paragrafta söyle. Mevcut kullanıcı değişikliklerini silme veya geri alma. Gerçekten çalıştırmadığın testin geçtiğini iddia etme. Donanım, mağaza hesabı, gizli anahtar, hukuki karar veya insan testi gerektiğinde fazı tamamlandı diye işaretleme; eksik kanıtı açıkça yaz. Fazın kabul kriterleri sağlanmadan sonraki faza geçme.

## Doğrulanamaz vaat yasağı

'Zafiyetsiz', 'kesin ücretsiz' veya 'garantili teslim' gibi doğrulanamaz vaatler kullanılmaz. Bu kılavuz teknik ürün planıdır; KVKK/GDPR, ses kaydı ve sınır ötesi veri aktarımı için hukuki görüş yerine geçmez.
