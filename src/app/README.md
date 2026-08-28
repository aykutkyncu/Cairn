# src/app

Expo Router'ın dosya tabanlı rota katmanı. **Yalnızca görsel düzenleyicidir.**

- Ekranlar veri istemcisini (Supabase) doğrudan içe aktaramaz; bu ESLint `no-restricted-imports` kuralıyla engellenir.
- Veri okuma/yazma `src/features` altındaki hook ve repository katmanında yaşar.
- Her ekran loading, empty, error ve offline durumunu açıkça ele alır.
- `_dev/` altındaki geliştirici rotaları üretim yapılandırmasında görünmez.
