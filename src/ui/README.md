# src/ui

Cairn tasarım sistemi. Ekranlar bileşenlere yalnız `@/ui` barrel'ından erişir.

## Marka yönü

Dağ patikalarındaki taş işareti (cairn): sakin, sıcak, güven veren, klinik olmayan.
Palet sıcak taş/kum nötrleri ve yosun yeşili bir vurgudan oluşur.
**Turkuaz, mor degrade ve neon kullanılmaz.**

## Kurallar

- `theme.ts`, doğrudan renk değeri (hex/rgba) yazılabilen **tek** dosyadır. Diğer her yerde
  ESLint `no-restricted-syntax` kuralı bunu hata olarak yakalar; kanıtı
  `npm run verify:lint-rules` ile koşar.
- Renk her zaman semantik token üzerinden gelir: `surface`, `surfaceSunk`, `ink`, `inkSoft`,
  `muted`, `rule`, `accent`, `onAccent`, `success`, `warning`, `danger`, `onDanger`, `scrim`.
- Boşluk düzeni 4 pt katıdır (`spacing`), dokunma hedefi en az `MIN_TOUCH_TARGET` (44 pt).
- Tüm metin `allowFontScaling` ile büyür. Hiçbir bileşene sabit yükseklik verilmez;
  metin dinamik yazı boyutunda kırpılmaz.
- **Renk tek başına anlam taşımaz.** Her durum ayrıca metin, işaret veya
  `accessibilityState` ile anlatılır (hata metni "Hata:" ön ekiyle, seçili kutu ✓ işaretiyle,
  yükleme durumu `busy` + görünür etiketle).

## Bileşenler

`Text` `Button` `Card` `Input` `Checkbox` `Avatar` `Badge` `Sheet` `EmptyState` `ErrorState`
`Skeleton` `Divider` — tümü `ThemeProvider` altında çalışır.

`ThemeProvider` kökte (`src/app/_layout.tsx`) kuruludur ve varsayılan olarak sistem temasını
izler. `useTheme()` sağlayıcı dışında çağrılırsa sessizce varsayılana düşmez, hata fırlatır.

## Denetim ekranı

Storybook kullanılmaz. Bunun yerine `src/app/_dev/kitchen-sink.tsx` tüm varyantları uzun
Türkçe metinle gösterir ve tema değiştirme düğmeleri içerir. Rota üretim yapılandırmasında
`src/app/_dev/_layout.tsx` tarafından ana ekrana yönlendirilir.

Bilinen sınır: dosya üretim paketinden fiziksel olarak çıkarılmaz, yalnız erişilemez hale
gelir. Tam paket dışı bırakma bundler seviyesinde ayrı bir iş kalemidir.

## Kontrast

`contrast.ts` WCAG kontrast oranı hesaplar; `__tests__/theme.test.ts` her iki temada
metin/arka plan çiftlerini AA eşiğine karşı otomatik denetler. Bu, göz denetiminin yerine
geçmez — fiziksel cihazda en büyük yazı boyutuyla ayrıca bakılmalıdır.
