/**
 * Sözleşme kurallarının gerçekten uygulandığını kanıtlar.
 *
 * Kasıtlı ihlal içeren fixture dosyalarını ESLint ile denetler ve beklenen kural
 * kimliklerinin hata seviyesinde tetiklendiğini doğrular. Kural sessizce
 * kaldırılırsa bu script (ve CI) başarısız olur.
 */
import { ESLint } from 'eslint';

const EXPECTATIONS = [
  {
    file: 'tools/lint-fixtures/explicit-any.ts',
    ruleId: '@typescript-eslint/no-explicit-any',
    reason: 'explicit any kullanan dosya lint hatası vermelidir',
  },
  {
    file: 'tools/lint-fixtures/screen-imports-supabase.tsx',
    ruleId: 'no-restricted-imports',
    reason: 'src/app kuralına tabi dosya Supabase istemcisini doğrudan içe aktaramaz',
  },
  {
    file: 'tools/lint-fixtures/direct-color.ts',
    ruleId: 'no-restricted-syntax',
    reason: 'src/ui/theme.ts dışında doğrudan renk (hex/rgba) kullanılamaz',
    minimumCount: 2,
  },
];

const eslint = new ESLint({ ignore: false });
const failures = [];

for (const expectation of EXPECTATIONS) {
  const [result] = await eslint.lintFiles([expectation.file]);
  const matched = (result?.messages ?? []).filter(
    (message) => message.ruleId === expectation.ruleId && message.severity === 2,
  );

  const required = expectation.minimumCount ?? 1;
  if (matched.length < required) {
    failures.push(
      `BEKLENEN HATA YOK: ${expectation.file} -> ${expectation.ruleId} (${expectation.reason})`,
    );
    continue;
  }

  console.log(`OK  ${expectation.file} -> ${expectation.ruleId} (${matched.length} hata)`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log('Tüm mimari/tip lint kuralları beklendiği gibi tetiklendi.');
