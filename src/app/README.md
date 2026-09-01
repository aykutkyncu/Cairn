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
auth/callback          Magic-link dönüşü (native'de PKCE kodunu oturuma çevirir)
_dev/                  Geliştirici rotaları; üretim yapılandırmasında görünmez
```

`index.tsx`, oturum durumu `loading` iken **yönlendirme yapmaz**: giriş ekranına atmak,
oturumu olan bir kullanıcıyı her açılışta bir an için çıkış yapmış gibi gösterirdi.

**Bu klasörde rota olmayan dosya bulunmaz.** Paylaşılan `CircleGate` bileşeni bir süre
`(tabs)/_circle-gate.tsx` olarak burada durdu; "alt çizgiyle başlayan dosyayı Expo Router
rota saymaz" varsayımına dayanıyordu. Varsayım yanlıştı: uygulama tarayıcıda açıldığında
sekme çubuğunda **`_circle-gate` adında beşinci bir sekme** göründü. Bileşen
`src/features/circles/circle-gate.tsx` içine taşındı ve kural
`src/app/__tests__/route-files.test.ts` ile sabitlendi.

`_layout.tsx` Expo Router'ın kendi düzen dosyasıdır ve rota üretmez; `_dev/` ise bilinçli
olarak rotadır, kendi düzeninde `__DEV__` dışında köke yönlendirir.
