# src/lib

Alan bağımsız altyapı: logger, istemci kurulumları, tarih/saat, şifreleme, depolama yardımcıları.

- `logger.ts` tek merkezi log noktasıdır; `console` yalnız burada kullanılabilir.
- Sağlık verisi log, analytics, hata kaydı veya URL içine yazılmaz.
- Token ve şifreleme anahtarları yalnız SecureStore'da tutulur.
