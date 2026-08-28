# src/features/auth

Kimlik doğrulama ve çember üyeliği.

## Giriş

E-posta **magic-link**. Şifre yoktur: bakım veren, hatırlaması gereken bir parola daha
istemez. Kullanıcıya gösterilen "bağlantı gönderildi" mesajı, adresin kayıtlı olup
olmadığından bağımsızdır; aksi halde hangi adreslerin sistemde olduğu sızardı.

**Google ve Apple ile giriş eklenmemiştir.** Bunlar OAuth yapılandırması, izin ekranları,
redirect allowlist'i ve fiziksel cihazda gerçek test gerektirir. Çalıştırılmamış bir akış
için düğme göstermek, olmayan bir özelliği vaat etmektir.

## Oturum depolaması

| Platform      | Depo                | Koruma                  |
| ------------- | ------------------- | ----------------------- |
| iOS / Android | `expo-secure-store` | Keychain / Keystore     |
| Web           | `localStorage`      | **Yok** — XSS'e açıktır |

Mobil şifreleme varsayımı web'e taşınmaz. Web yalnız geliştirme ve önizleme içindir;
`isSecureSessionStorage` bayrağı arayüzün bu farkı kullanıcıya gösterebilmesi içindir.

Oturum JSON'u SecureStore'un boyut sınırını aşabildiği için parçalara bölünerek yazılır.
Parçalardan biri eksikse kayıt bozuk sayılır ve oturum yokmuş gibi davranılır — kısmi bir
oturumla devam etmek, yeniden giriş istemekten daha risklidir.

## Oturum kapatma temizliği

`clearSessionArtifacts()` şunları siler:

- SecureStore anahtarları: `cairn.local-db-key`, `cairn.device-id`, `cairn.push-token`
- Kayıtlı temizleyiciler (`registerSessionCleaner`): sorgu önbelleği, yerel veritabanı,
  outbox — her biri kendi modülünden kaydolur, böylece bu modül onlara bağımlı olmaz

Bir temizleyici hata verse bile diğerleri çalışır: yarım kalmış temizlik, hiç yapılmamış
temizlikten daha kötüdür. Sunucu çıkışı başarısız olsa bile yerel temizlik yapılır —
cihazda kalan token, sunucudaki oturumdan daha büyük risktir.

**Bilinen sınır:** iOS Keychain kayıtları uygulama kaldırıldıktan sonra bile cihazda
kalabilir. Bu işletim sistemi davranışıdır. Bu yüzden yalnız _gerçek oturum kapatma_
temizliği garanti edilir; "uygulamayı silince veri gider" denmez.

## Davet tokenı

Ham token **istemcide** üretilir (`expo-crypto`, işletim sistemi CSPRNG'si — `Math.random`
değil), sunucuya yalnız **SHA-256 hash'i** gider. Böylece düz token sunucu loglarına, hata
raporlarına veya veritabanına hiçbir aşamada düşmez.

Token alfabesi `l`, `o`, `0`, `1` gibi karışması kolay karakterleri içermez: bağlantı elle
de yazılabilmelidir.

Kabul tarafında da aynı işlem yapılır: bağlantıdaki tokenın hash'i hesaplanıp sunucuya
gönderilir. Sunucu ham tokenı hiç görmez.

## Atomik işlemler

Üyelik yaşam döngüsü saf RLS ile yürütülemez; `supabase/migrations/0009_membership_rpc.sql`
içindeki SECURITY DEFINER fonksiyonlarından geçer.

**`create_circle_with_owner`** — Çember kurmak saf RLS ile mümkün değildir: kullanıcı
çember satırını yazsa bile onu geri okuyamaz (SELECT politikası üyelik ister) ve kendini
owner ekleyemez (INSERT politikası owner olmayı ister). Kısır döngü. RPC iki yazmayı tek
işlemde yapar.

**`accept_circle_invitation`** — Hash eşleşmesi, tüketim durumu, süre kontrolü, tüketim
işareti ve üyelik oluşturma **tek transaction**'dadır. Çekirdek adım tek bir `UPDATE`
ifadesidir; satırı kilitler, bu yüzden kontrol ile yazma arasında yarış penceresi yoktur.
İki eşzamanlı kabul denemesinde ikincisi sıfır satır görür ve reddedilir.

Zaten aktif bir üyelik varsa rol değiştirilmez: bir owner'ın caregiver davetini kabul
etmesi onu düşürmez.

## Hız sınırı

IP tabanlı sınır **kullanılmaz**: `X-Forwarded-For` istemci tarafından uydurulabilir ve
mobil operatör NAT'ı arkasında binlerce kullanıcı aynı IP'yi paylaşır. Bunun yerine
güvenilir sunucu tarafı boyutlar kullanılır: kullanıcı kimliği (JWT'den), çember kimliği
ve davet hash'i. `rate_limit_buckets` tablosunda RLS açık ve **hiç politika yok** — istemci
bu tabloya erişemez.

## Eksik: derin bağlantı altyapısı

Davet bağlantısı şu an yalnız `cairn://` uygulama şemasıyla çalışır. Uygulama kurulu
değilken çalışan **web fallback'i ve mağaza yönlendirmesi** için doğrulanmış bir alan adı,
Universal Links (iOS) ve App Links (Android) yapılandırması ve gerçek cihaz test planı
gerekir. Supabase bunu otomatik sağlamaz.
