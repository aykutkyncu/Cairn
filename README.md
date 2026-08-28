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

- **Branch protection** GitHub'da etkinleştirilmemiştir; CI yeşil olmadan merge engellenmez.
- Depo henüz bir GitHub remote'una bağlı değildir; CI iş akışı ilk push'ta çalışacaktır.
- `gitleaks` yerel makinede kurulu değildir; çalışma ağacı taraması secretlint ile, git
  geçmişi taraması CI'daki `gitleaks-action` ile yapılır.
- Uygulama fiziksel cihazda veya emülatörde çalıştırılıp doğrulanmamıştır. Faz 01'in
  kitchen-sink ekranı iki temada ve en büyük sistem yazı boyutunda gözle denetlenmemiştir;
  otomatik kontrast denetimi bunun yerine geçmez.
- **pgTAP paketi henüz çalıştırılmamıştır.** Yerel makinede Docker olmadığı için
  `supabase test db` koşulamadı; CI'daki `database` işi bunu ilk push'ta
  çalıştıracaktır. Bu arada `npm run verify:schema`, migration'ları gerçek bir
  Postgres motorunda (PGlite/WASM) uygulayıp aynı davranışları 49 kontrolle
  sınıyor. Supabase'in gerçek auth ve storage davranışı yine de yalnız pgTAP
  koşusuyla kanıtlanır; buradaki auth/storage şemaları asgari taklittir.
- `src/lib/database.types.ts` henüz yoktur. Elle yazmak yerine CI'ın şemadan
  üretmesi tercih edildi; ilk CI koşusundan sonra artifact olarak indirilip
  depoya eklenmelidir.
- `npm audit` 11 orta seviye bulgu raporlamaktadır (transitive bağımlılıklar); CI kapısı
  `high` seviyesindedir, bu nedenle bu bulgular merge'ü engellemez.

## Fazlar

Geliştirme, `Cairn_Claude_Code_Uygulama_Kilavuzu.pdf` içindeki 17 fazlı sırayı izler.
Bir fazın kabul kriterleri kanıtlanmadan sonraki faza geçilmez.

| Faz                                          | Durum                                 |
| -------------------------------------------- | ------------------------------------- |
| 00 - Zemin: repo, araçlar ve kalite kapıları | Kod tarafı tamam, manuel adımlar açık |
| 01-16                                        | Başlanmadı                            |
