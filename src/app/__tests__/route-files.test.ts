// Node tipleri YALNIZ bu dosyada açılır: uygulama kodunun `process` ya da
// `Buffer` gibi Node global'lerine erişmesi istenmez, bu test ise dosya
// sistemini okumak zorundadır.
/// <reference types="node" />
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `src/app` yalnız rota içerir.
 *
 * Bu test bir kusurun karşılığıdır: paylaşılan `CircleGate` bileşeni
 * `src/app/(tabs)/_circle-gate.tsx` olarak duruyordu ve "alt çizgiyle
 * başlayan dosyayı Expo Router rota saymaz" varsayımına dayanıyordu. Varsayım
 * yanlıştı: uygulama tarayıcıda açıldığında sekme çubuğunda **_circle-gate
 * adında beşinci bir sekme** göründü.
 *
 * Kural basitleştirildi: `src/app` altındaki her dosya ya bir rota, ya bir
 * düzen (`_layout`), ya da testtir. Paylaşılan bileşen feature katmanına
 * taşındı. Sözleşmedeki "ekranlar `src/app` altında, iş mantığı feature
 * katmanında" kuralı da bunu söyler.
 */

const APP_DIR = join(__dirname, '..');

/** Rota sayılmayan, Expo Router'ın kendi özel dosyaları. */
const ALLOWED_SPECIAL = new Set(['_layout.tsx', '+not-found.tsx', '+html.tsx', 'README.md']);

const collect = (dir: string, acc: string[] = []): string[] => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- yol testin kendi klasöründen türer, dış girdi yoktur
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- aynı gerekçe
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      collect(full, acc);
      continue;
    }
    acc.push(full);
  }
  return acc;
};

describe('src/app rota klasörü', () => {
  const files = collect(APP_DIR).map((full) => full.slice(APP_DIR.length + 1).replace(/\\/g, '/'));

  it('alt çizgiyle başlayan dosya barındırmaz (_layout dışında)', () => {
    const underscored = files.filter((file) => {
      const name = file.split('/').pop() ?? '';
      return name.startsWith('_') && !ALLOWED_SPECIAL.has(name);
    });

    // Bir tanesi bile sekme çubuğunda görünen bir "sekme" demektir.
    expect(underscored).toEqual([]);
  });

  it('yalnız rota dosyası ve düzen içerir', () => {
    const unexpected = files.filter((file) => {
      const name = file.split('/').pop() ?? '';
      if (ALLOWED_SPECIAL.has(name)) return false;
      return !name.endsWith('.tsx');
    });

    expect(unexpected).toEqual([]);
  });
});
