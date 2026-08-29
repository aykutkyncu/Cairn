# Kurulum: GitHub, Supabase ve ilk cihaz testi

Bu belge, kodun yapamadığı adımları anlatır: hesap açma, anahtar alma, cihazda çalıştırma.
Hepsi ücretsizdir. Tek ücretli kalem Google Play geliştirici hesabıdır (25 USD, tek
seferlik) ve o **şimdi gerekmez**.

> Sıra önemlidir: GitHub → Supabase → cihaz. Supabase olmadan giriş akışı denenemez,
> GitHub olmadan pgTAP ve eşzamanlılık kanıtı üretilemez.

---

## A. GitHub deposu ve CI

Depo yerelde hazır, hiçbir uzak sunucuya bağlı değil. CI iş akışı yazılmış ama **bir kez
bile çalışmamış**.

### A1. GitHub CLI'a giriş

`gh` kurulu, giriş yapılmamış. Terminalde:

```
! gh auth login
```

Sorulara: `GitHub.com` → `HTTPS` → `Y` (git kimlik doğrulaması için) → `Login with a web
browser`. Ekranda çıkan 8 haneli kodu tarayıcıya yapıştır.

Doğrulama: `gh auth status` → "Logged in to github.com as ..." yazmalı.

### A2. Depoyu oluştur ve gönder

```
gh repo create Cairn --public --source=. --remote=origin --push
```

**Neden public:** branch protection private depolarda ücretli plan ister. Public depo, bu
projenin sıfır bütçe kısıtıyla uyumlu tek yoldur. Depoda sır yoktur — `.env` `.gitignore`
içinde ve her commit `secretlint` ile taranır.

### A3. CI'ın ilk koşusunu izle

```
gh run watch
```

Dört iş koşar: `quality`, `secrets`, `database`, `dependencies`.

**Bu koşu, yerelde kanıtlanamayan şeyleri ilk kez sınar:**

| İş                              | Ne kanıtlar                                                  |
| ------------------------------- | ------------------------------------------------------------ |
| `database` → `supabase test db` | pgTAP RLS testleri; yerelde Docker olmadığı için hiç koşmadı |
| `database` → tip üretimi        | `database.types.ts` şemadan üretilir                         |
| `secrets` → gitleaks            | Git **geçmişinde** sır var mı                                |

`database` işi başarısız olursa bana çıktıyı ver — migration'larda düzeltilecek bir şey
var demektir.

### A4. Üretilen veritabanı tiplerini depoya al

CI yeşil olduktan sonra:

```
gh run download --name database-types --dir /tmp/dbtypes
cp /tmp/dbtypes/database.types.generated.ts src/lib/database.types.ts
```

Sonra commit et. Bu dosya elle yazılmaz; şemadan üretilir ve CI sürüklenmeyi yakalar.

### A5. Branch protection (tarayıcıda)

`Settings → Branches → Add branch protection rule`:

- Branch name pattern: `main`
- ☑ Require a pull request before merging
- ☑ Require status checks to pass before merging → `quality`, `secrets`, `database`,
  `dependencies` seç
- ☑ Do not allow bypassing the above settings

**Neden önemli:** pre-commit hook'ları `--no-verify` ile atlanabilir. Gerçek kapı budur.

---

## B. Supabase projesi

Free tier kart istemez. **Bilinen sınır:** proje 1 hafta hareketsiz kalırsa duraklatılır;
panelden tek tıkla geri açılır.

### B1. Proje oluştur

[supabase.com/dashboard](https://supabase.com/dashboard) → `New project`

| Alan              | Değer                                                |
| ----------------- | ---------------------------------------------------- |
| Name              | `cairn`                                              |
| Database Password | Güçlü bir şifre üret ve **parola yöneticine kaydet** |
| Region            | `Central EU (Frankfurt)`                             |
| Plan              | Free                                                 |

**Bölge neden Frankfurt:** sağlık verisi özel nitelikli kişisel veridir. AB içinde tutmak,
KVKK'nın yurt dışına aktarım hükümleriyle uğraşmamayı sağlar. _Bu teknik bir tercihtir,
hukuki görüş değildir._

Kurulum ~2 dakika sürer.

### B2. Anahtarları `.env` dosyasına yaz

`Project Settings → API` sayfasından iki değer al:

- **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
- **anon / public** anahtarı → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

```
cp .env.example .env
```

Sonra `.env` dosyasını doldur.

> **`service_role` anahtarını asla kopyalama.** O anahtar RLS'i tamamen atlar. `.env`
> istemci paketine gömülür; oraya konan bir `service_role` anahtarı, uygulamayı kuran
> herkese tüm veritabanını açar. Aynı sayfada duruyor olması onu güvenli yapmaz.

`anon` anahtarının paketе gömülmesi normaldir ve gizli değildir — güvenlik RLS ile sağlanır.

### B3. Şemayı uzak projeye uygula

```
npx supabase login
npx supabase link --project-ref <proje-ref>
npx supabase db push
```

`<proje-ref>`, panel URL'indeki `https://supabase.com/dashboard/project/**buradaki-kod**`
kısmıdır. `link` sırasında B1'de kaydettiğin veritabanı şifresi sorulur.

`db push` dokuz migration'ı sırayla uygular: şema, RLS politikaları, Storage kuralları,
audit ve üyelik RPC'leri.

Doğrulama: `Table Editor`'da `circles`, `circle_members`, `tasks`, `task_completions`
tablolarını gör. Her birinin yanında **"RLS enabled"** rozeti olmalı.

### B4. Kimlik doğrulama ayarları

`Authentication → URL Configuration`:

- **Site URL:** `cairn://`
- **Redirect URLs:** `cairn://auth/callback` ve `cairn://` ekle

`Authentication → Providers → Email`:

- Email provider açık
- "Confirm email" açık

Şifre alanı yoktur; giriş magic-link iledir.

> **Free tier sınırı:** Supabase'in yerleşik e-posta gönderimi saatte ~3-4 e-posta ile
> sınırlıdır ve yalnız geliştirme içindir. Pilot testte bu yeter. Gerçek kullanıcıya
> açılırken ücretsiz bir SMTP sağlayıcısı bağlanmalıdır — o noktaya geldiğimizde konuşalım.

---

## C. İlk gerçek çalıştırma

Uygulama bugüne kadar **hiçbir cihazda çalışmadı**. Bu adım, testlerin yakalayamayacağı
şeyleri ortaya çıkarır.

### C1. Başlat

```
npx expo start
```

Telefonuna **Expo Go** kur (Play Store, ücretsiz), QR kodu okut. Telefon ve bilgisayar aynı
Wi-Fi ağında olmalı.

### C2. Sırayla dene

1. **Giriş:** e-posta adresini gir → "Bağlantı gönderildi" mesajı → gelen kutusundaki
   bağlantıya **telefondan** dokun. Bağlantı uygulamayı açmalı ve giriş tamamlanmalı.

2. **Çember kur:** bakılan kişinin adı + saat dilimi → çember oluşur ve aktif olur.

3. **Davet:** davet bağlantısı üret → paylaş sayfası açılmalı. Bağlantı `cairn://invite/...`
   biçiminde olacak. _Uygulama kurulu olmayan bir cihazda bu bağlantı çalışmaz — bu bilinen
   eksiktir (bkz. README "Bilinen eksikler")._

4. **Görev:** görev ekle (ör. "Sabah ilacı", 08:00, her gün) → Bugün ekranında Sabah
   bloğunda görünmeli.

5. **Tamamlama ve geri alma:** göreve dokun → üstü çizilmeli, "Geri al" düğmesi çıkmalı →
   10 saniye içinde geri al → işaret kalkmalı. 10 saniye beklersen düğme kaybolmalı.

6. **Çevrimdışı (en kritik test):**
   - Uçak modunu aç
   - Bir görevi tamamla → **"Gönderilecek"** etiketi çıkmalı, üstte sakin bir çevrimdışı
     şerit belirmeli
   - Uygulamayı tamamen kapat (arka plandan da çıkar) ve yeniden aç
   - **İşaret hâlâ orada mı?** Olmalı — kayıt Keystore'da duruyor
   - Uçak modunu kapat → birkaç saniye içinde "Gönderilecek" etiketi **"Tamam"a** dönmeli

7. **Erişilebilirlik:** `/_dev/kitchen-sink` ekranını aç. Telefon ayarlarından yazı boyutunu
   en büyüğe al ve koyu temaya geç. Metin kutuları büyüyor mu, taşma var mı, kontrast
   yeterli mi?

### C3. Sonuçları bana bildir

Her adım için "oldu / olmadı + ne gördün". Olmayan varsa ekran görüntüsü veya hata metni
yeter. Bunlar Faz 03, 04 ve 05'in kanıtlanmamış kabul kriterlerini kapatacak.

---

## D. Google Play — henüz değil

25 USD'yi **şimdi ödeme**. Hesap açıldığı andan itibaren Google'ın kapalı test
gereksinimleri işlemeye başlar ve uygulama yayına hazır değil. Faz 16'ya geldiğimizde
söylenecek.

Ondan önce yapılacaklar (kod tarafı, bende):

- `app.json` içine `android.package` (ör. `com.cairn.app`) eklemek
- Gizlilik politikası metni ve veri güvenliği formu içeriği
- İmzalı derleme (ücretsiz: EAS free tier veya yerel Android derlemesi)

## Kapsam dışı: iOS

App Store 99 USD/yıl + macOS gerektirir. Ücretsiz kalma kararıyla **iOS yayını kapsam
dışıdır**. Kod platform bağımsız yazıldığı için ileride bu karar geri alınabilir; plan
Android + web önizleme üzerinden ilerler.
