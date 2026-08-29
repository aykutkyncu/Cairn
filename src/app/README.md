# src/app

Expo Router'ın dosya tabanlı rota katmanı. **Yalnızca görsel düzenleyicidir.**

- Ekranlar veri istemcisini (Supabase) doğrudan içe aktaramaz; bu ESLint `no-restricted-imports` kuralıyla engellenir.
- Veri okuma/yazma `src/features` altındaki hook ve repository katmanında yaşar.
- Her ekran loading, empty, error ve offline durumunu açıkça ele alır.
- `_dev/` altındaki geliştirici rotaları üretim yapılandırmasında görünmez.

## Rota düzeni

```
index.tsx              Oturum durumuna göre yönlendirir (loading'de bekler)
(auth)/sign-in         Magic-link girişi
(onboarding)/          Çember kurma ve davet
invite/[token]         Davet kabulü (derin bağlantı)
(tabs)/                Ana sekmeler: Bugün, Takvim, Dosya, Daha fazlası
(tabs)/_circle-gate    Sekmelerin ortak loading/empty/error kapısı
_dev/                  Geliştirici rotaları; üretim yapılandırmasında görünmez
```

`index.tsx`, oturum durumu `loading` iken **yönlendirme yapmaz**: giriş ekranına atmak,
oturumu olan bir kullanıcıyı her açılışta bir an için çıkış yapmış gibi gösterirdi.

Alt çizgiyle başlayan dosyalar (`_layout.tsx`, `_circle-gate.tsx`) Expo Router tarafından
rota sayılmaz; ortak düzen ve paylaşılan parçalar için kullanılır.
