# src/features

Alan (domain) bazlı iş mantığı: hook'lar, repository/servis katmanı, doğrulama şemaları.

- Klasörleme türe göre değil, özelliğe göre yapılır (`tasks/`, `medications/`, `expenses/` ...).
- Sunucudan gelen her veri kullanıldığı sınırda Zod ile doğrulanır.
- Yeni iş mantığı birim testi olmadan tamamlanmış sayılmaz.
