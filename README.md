# Cairn

Bakımı paylaşan aileler için güvenli, erişilebilir ve offline öncelikli mobil uygulama.
Birincil kullanıcı hasta değil, bakımı yöneten kişidir.

> Cairn tıbbi tavsiye vermez, teşhis koymaz ve ilaç doğruluğunu garanti etmez.
> Proje kuralları için [CLAUDE.md](./CLAUDE.md) sözleşmesine bakın.

## Sürümler (Faz 00'da kilitlendi)

| Bileşen                       | Sürüm                 |
| ----------------------------- | --------------------- |
| Expo SDK                      | `~57.0.18`            |
| React Native                  | `0.86.3`              |
| React                         | `19.2.3`              |
| Expo Router                   | `~57.0.17`            |
| TypeScript                    | `~6.0.3`              |
| Node (geliştirme makinesi)    | `24.18.0`             |
| npm                           | `11.16.0`             |
| jest-expo / jest              | `~57.0.0` / `^29.7.0` |
| @testing-library/react-native | `^14.0.1`             |
| ESLint / Prettier             | `^9.39.5` / `^3.9.6`  |

Tüm sürümler `package-lock.json` ile kilitlidir. Yeni paket `npx expo install` ile eklenir;
uygulama sırasında rastgele SDK yükseltmesi yapılmaz.

## Kurulum

```bash
npm ci
cp .env.example .env   # gerçek değerleri kendin doldur; .env Git'e girmez
npm start
```

## Komutlar

| Komut                       | Ne yapar                                                       |
| --------------------------- | -------------------------------------------------------------- |
| `npm run lint`              | ESLint, uyarı toleransı sıfır                                  |
| `npm run format`            | Prettier biçim denetimi (`format:fix` düzeltir)                |
| `npm run typecheck`         | `tsc --noEmit`                                                 |
| `npm test`                  | Jest birim ve bileşen testleri                                 |
| `npm run test:ci`           | Jest + kapsam raporu                                           |
| `npm run verify:lint-rules` | Mimari/tip lint kurallarının gerçekten tetiklendiğini kanıtlar |
| `npm run scan:secrets`      | secretlint ile çalışma ağacı sır taraması                      |

## Klasör düzeni

```
src/app/         Expo Router rotaları - yalnız görsel düzenleyici
src/features/    Alan bazlı iş mantığı, hook ve repository katmanı
src/features/app-shell/  Sağlayıcı ağacı, ağ durumu, hata raporlama bağlantısı
src/features/circles/    Çember üyeliği, aktif çember, roller
src/features/tasks/      Bakım takvimi: tekrar motoru, gün planı, tamamlama kuyruğu
src/lib/         Alan bağımsız altyapı (logger, istemciler, yardımcılar)
src/ui/          Paylaşılan tasarım sistemi: tema tokenları + 13 erişilebilir bileşen
src/constants/   Sabitler ve yapılandırma değerleri
supabase/migrations/  Numaralı SQL migration'ları: şema, RLS, Storage, audit
supabase/tests/       pgTAP RLS davranış testleri
tools/lint-fixtures/  Kasıtlı kural ihlali örnekleri (yalnız doğrulama için)
.github/workflows/    CI kapıları
```

Her kök klasörün kendi `README.md` dosyasında amacı ve kuralları yazılıdır.

## Kalite kapıları

Yerelde `pre-commit` kancası (husky + lint-staged) staged TypeScript dosyalarında lint,
biçim ve `tsc --noEmit` çalıştırır; ayrıca staged dosyalarda secretlint koşar.
**Bu kanca `--no-verify` ile atlanabilir.** Gerçek kapı CI'dır: `.github/workflows/ci.yml`
lint, biçim, tip denetimi, lint kuralı kanıtı, birim testleri, sır taraması (secretlint +
gitleaks) ve `npm audit` çalıştırır.

Merge engelleme yalnız GitHub **branch protection** ile olur ve bu depo ayarı henüz
etkinleştirilmemiştir; bunu repo sahibi yapmalıdır (bkz. [Bilinen eksikler](#bilinen-eksikler)).

## Güvenlik ve sırlar

- `.env` Git tarafından izlenmez; şablon `.env.example` içinde gerçek değer yoktur.
- `EXPO_PUBLIC_` önekli değişkenler istemci paketine gömülür ve gizli değildir.
- `service_role` anahtarı istemciye asla konmaz; sunucu sırları Supabase Vault veya GitHub secret'ta tutulur.
- Sağlık verisi log, analytics, push bildirimi, hata kaydı veya URL içine yazılmaz.
- Loglama yalnız `src/lib/logger.ts` üzerinden yapılır; `console` kullanımı lint ile engellenir.

## Maliyet kısıtı: sıfır bütçe

Cairn ücretli servis olmadan geliştirilir. Bugün doğrulanmış durum:

**Ücretsiz:** Expo / React Native / TypeScript ve tüm geliştirme araçları, Expo Go ile
cihazda çalıştırma, GitHub deposu, GitHub Actions (public repoda sınırsız dakika),
branch protection ruleset'leri (public repoda), Supabase free tier, secretlint, gitleaks-action.

**Karar:** Depo **public** tutulur. Gerekçesi, private repoda branch protection'ın GitHub
Free planında bulunmamasıdır. Bu güvenliği düşürmez, çünkü sözleşme gereği kodda sır yoktur:
`.env` izlenmez, `service_role` istemciye konmaz, sır taraması hem yerelde hem CI'da koşar.
Sağlık verisi kodda değil, RLS ile korunan Supabase'de durur.

**Sınırlar ve ileride ücret çıkabilecek noktalar:**

| Kalem                              | Not                                                               |
| ---------------------------------- | ----------------------------------------------------------------- |
| Supabase free tier                 | ~1 hafta hareketsizlikte proje duraklar; 500 MB DB / 1 GB storage |
| EAS Build                          | Free tier'da aylık sınırlı; alternatifi yerel Android derlemesi   |
| Google Play yayını (Faz 16)        | 25 USD tek seferlik; pilot için APK doğrudan dağıtımı ücretsizdir |
| App Store yayını (Faz 16)          | 99 USD/yıl + macOS; ücretsiz alternatifi yoktur                   |
| Alan adı (Faz 03, Universal Links) | Ücretsiz alt alan adıyla denenebilir; doğrulanmadı                |

Bu tablo bugünkü durumdur, garanti değildir. Sağlayıcı fiyatlandırması değişebilir.

## Bilinen eksikler

Faz 00 kapsamında kod tarafı tamamdır, fakat aşağıdakiler depo sahibinin manuel adımını gerektirir:

- `gitleaks` yerel makinede kurulu değildir; çalışma ağacı taraması secretlint ile, git
  geçmişi taraması CI'daki `gitleaks-action` ile yapılır.
- **Uygulama fiziksel cihazda veya emülatörde çalıştırılmamıştır.** Yalnız web hedefinde
  (`npm run web`) açılmıştır; iOS/Android derlemesi hiç alınmamıştır.
- **Magic-link akışı web'de çalışmıştır, native'de hiç denenmemiştir.** Gerçek bir e-posta
  gönderilip bağlantıya tıklanmış, dönüş adresi kusuru (`cairn://` şemasının tarayıcıda
  boş sayfa açması) bu denemede bulunup `authRedirectUrl()` ile düzeltilmiştir. Tarayıcıda
  sonrasında açık bir oturum ve kurulmuş bir çember gözlenmiştir; **giriş anının kendisi
  (bağlantıya tıklama → oturum) bir kez daha izlenmemiştir.** Native dönüş ekranı
  (`src/app/auth/callback.tsx`) yalnız birim testleriyle kanıtlıdır: iOS/Android derlemesi
  alınmadığı için `cairn://auth/callback` gerçek bir cihazda hiç açılmamıştır.
- **Gerçek eşzamanlılık sınanmamıştır.** PGlite tek bağlantılıdır; "aynı davet iki
  eşzamanlı denemede yalnız bir kez kabul edilir" kriteri, kontrolün ve yazmanın tek bir
  `UPDATE` ifadesinde (satır kilidiyle) olmasıyla tasarlanmıştır, fakat çok bağlantılı
  koşuyla kanıtlanmamıştır. CI'daki pgTAP işi de tek oturumda koşar; iki gerçek
  eşzamanlı bağlantıyla yarıştıran bir test henüz yazılmamıştır.
- **Google/Apple ile giriş yoktur.** OAuth yapılandırması, izin ekranları, redirect
  allowlist'i ve fiziksel cihaz testi olmadan eklenmemiştir.
- **Universal Links / App Links yapılandırılmamıştır.** Davet bağlantısı yalnız `cairn://`
  şemasıyla çalışır; uygulama kurulu değilken web fallback'i ve mağaza yönlendirmesi için
  doğrulanmış bir alan adı gerekir. Faz 01'in
  kitchen-sink ekranı iki temada ve en büyük sistem yazı boyutunda gözle denetlenmemiştir;
  otomatik kontrast denetimi bunun yerine geçmez.
- **pgTAP yerel makinede koşulamaz.** Docker kurulu olmadığı için `supabase test db`
  yalnız CI'daki "Veritabanı ve RLS testleri" işinde çalışır (main'de yeşildir).
  Yerelde `npm run verify:schema`, migration'ları gerçek bir Postgres motorunda
  (PGlite/WASM) uygulayıp aynı davranışları 49 kontrolle sınar; ancak Supabase'in
  gerçek auth/storage davranışı yalnız pgTAP koşusuyla kanıtlanır.
- `npm audit` 11 orta seviye bulgu raporlamaktadır (transitive bağımlılıklar); CI kapısı
  `high` seviyesindedir, bu nedenle bu bulgular merge'ü engellemez.

Faz 04 ile eklenenler:

- **Hata raporlayıcı (Sentry vb.) kurulmamıştır.** Gerçek bir DSN, hesap ve ücret
  değerlendirmesi gerektirir. `src/lib/error-reporting.ts` içindeki temizleyiciler bir
  raporlayıcı eklendiğinde `beforeSend`/`beforeBreadcrumb` kancalarına bağlanmak üzere saf
  fonksiyon olarak yazılmış ve birim testleriyle sınanmıştır. Faz 04'ün "örnek Sentry olayı
  hasta adı, ilaç, not veya request body içermez" kriteri bu testlerle kanıtlanmıştır;
  **gerçek bir Sentry olayı hiç üretilmemiştir.**
- **Çevrimdışı şerit gerçek cihazda denenmemiştir.** `toNetworkStatus` mantığı birim
  testleriyle sabitlenmiştir, fakat uçak modu, portal arkasındaki Wi-Fi ve sinyalsiz
  hücresel gibi gerçek durumlar cihazda görülmemiştir.
- **Takvim, Dosya ve Daha fazlası sekmeleri boş durumdadır.** Bugün sekmesi Faz 05 ile
  doldu; kalan sekmeler loading/empty/error/offline durumlarını ele alır, fakat içerikleri
  Faz 06 ve sonrasında gelir. Var olmayan bir özellik varmış gibi gösterilmemiştir.
- **Çember listesi gerçek sunucuya karşı çalıştırılmamıştır.** `listCircles` sorgusu ve
  Zod şeması yazılmış, fakat gerçek bir yanıtla denenmemiştir. Repository sınırı taklit
  edilmiş bir istemciyle test edilmiştir.
- Test kapsamı %81.2 (satır %82.3), 356 test / 34 paket. Kapsanmayan başlıca yerler:
  `src/lib/supabase.ts` istemci kurulumu (gerçek Supabase yapılandırması gerektirir),
  `src/app/_layout.tsx` ve `(tabs)/_layout.tsx` gibi Expo Router düzen dosyaları
  (yönlendirici çalışmadan render edilemez).
- Expo Router'ın tipli rota tanımları (`.expo/types/router.d.ts`) `npx expo start`
  çalıştırıldığında üretilir ve Git'e girmez. Yerel `npm run typecheck` bu dosya eskiyse
  var olan bir rotayı hatalı gösterebilir; en az bir kez `npx expo start` çalıştırmak
  gerekir.

Faz 05 ile eklenenler:

- **Tamamlama akışı gerçek sunucuya karşı çalıştırılmamıştır.** Kuyruk, idempotanslık ve
  `23505` (zaten kaydedilmiş) davranışı taklit edilmiş bir istemciyle test edilmiştir;
  `task_completions` tablosuna gerçek bir satır hiç yazılmamıştır.
- **"İki cihazda eşzamanlı tamamlama tek kayıt üretir" kriteri kanıtlanmamıştır.** Aynı
  `(task_id, occurrence_id)` için tekillik migration'da tanımlıdır ve istemci tarafı
  çakışmayı hata saymaz, fakat iki gerçek cihazla koşulmamıştır.
- **"Uçak modunda kalıcı kuyruk" kriteri yalnız birim testiyle kanıtlıdır.** SecureStore
  taklit edilerek yeniden açılış sınanmıştır; gerçek cihazda uçak modu denenmemiştir.
  Web'de kuyruk zaten kalıcı değildir (`not_persistent`).
- **Sıkışan kayıtlar için arayüz yoktur.** 8 denemeyi aşan kayıt kuyrukta kalır ve
  `listStuck()` ile okunabilir, fakat kullanıcıya gösterilmez.
- **Takvim (ay) görünümü, görev düzenleme/silme ve atama arayüzü yoktur.** Görev yalnız
  oluşturulabilir; düzenleme Faz 06 ve sonrasına bırakılmıştır.
- DST kararları (ileri atlamada ilk gerçek ana çekme, geri atlamada ilk geçişi kabul)
  birim testleriyle sabittir; gerçek bir DST gecesinde cihazda görülmemiştir.
- **Sekme çubuğu ikonları web'de yer tutucu görünür.** İkon seti native sembollere
  dayanır; web hedefinde küçük üçgenler çizilir. Sekme adları metin olarak yazılıdır,
  bu yüzden anlam kaybı yoktur; düzeltme native ikon/sembol işidir.

## Fazlar

Geliştirme, `Cairn_Claude_Code_Uygulama_Kilavuzu.pdf` içindeki 17 fazlı sırayı izler.
Bir fazın kabul kriterleri kanıtlanmadan sonraki faza geçilmez.

| Faz                                            | Durum                                 |
| ---------------------------------------------- | ------------------------------------- |
| 00 - Zemin: repo, araçlar ve kalite kapıları   | Kod tarafı tamam, manuel adımlar açık |
| 01 - Erişilebilir tasarım sistemi              | Kod tarafı tamam, gözle denetim açık  |
| 02 - Veri modeli, RLS ve gizlilik temeli       | Kod tarafı tamam, pgTAP koşusu açık   |
| 03 - Kimlik doğrulama ve atomik çember daveti  | Kod tarafı tamam, gerçek akış açık    |
| 04 - Uygulama iskeleti ve güvenli veri katmanı | Kod tarafı tamam, cihaz testi açık    |
| 05 - Bakım takvimi (ürünün kalbi)              | Kod tarafı tamam, cihaz testi açık    |
| 06-16                                          | Başlanmadı                            |

"Kod tarafı tamam" demek, o fazın kabul kriterlerinin **tamamı kanıtlandı** demek değildir.
Her fazın kanıtlanmamış kalan adımları yukarıdaki "Bilinen eksikler" bölümünde tek tek
yazılıdır.
