// Cairn ESLint yapılandırması.
// Sözleşme kuralları: explicit any yasak, kullanılmayan import hata, ekranlar veri
// istemcisine doğrudan erişemez, üretim kodunda console kullanılmaz.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const tseslint = require('@typescript-eslint/eslint-plugin');
const security = require('eslint-plugin-security');
const unusedImports = require('eslint-plugin-unused-imports');

/** Ekran katmanının doğrudan içe aktaramayacağı veri/altyapı modülleri. */
const DATA_LAYER_IMPORTS = [
  {
    name: '@supabase/supabase-js',
    message:
      'Ekranlar veri istemcisine doğrudan erişemez. Supabase erişimini src/features altındaki hook/repository katmanına taşı.',
  },
  {
    name: '@/lib/supabase',
    message:
      'Ekranlar veri istemcisine doğrudan erişemez. Supabase erişimini src/features altındaki hook/repository katmanına taşı.',
  },
];

const DATA_LAYER_IMPORT_PATTERNS = [
  {
    group: ['**/lib/supabase', '**/lib/supabase/**', '@supabase/*'],
    message:
      'Ekranlar veri istemcisine doğrudan erişemez. Supabase erişimini src/features altındaki hook/repository katmanına taşı.',
  },
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'coverage/**',
      'android/**',
      'ios/**',
      'expo-env.d.ts',
      // Kasıtlı ihlal örnekleri: yalnız scripts/verify-lint-rules.mjs tarafından denetlenir.
      'tools/lint-fixtures/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    plugins: { security, 'unused-imports': unusedImports },
    rules: {
      ...security.configs.recommended.rules,
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSAnyKeyword',
          message: 'any kullanımı sözleşme gereği yasaktır.',
        },
        {
          // Doğrudan renk değeri yalnız src/ui/theme.ts içinde tanımlanır.
          selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message:
            'Doğrudan renk (hex) kullanılamaz. Rengi src/ui/theme.ts içinde semantik token olarak tanımla ve useTheme() ile kullan.',
        },
        {
          selector: String.raw`Literal[value=/^(rgb|rgba|hsl|hsla)\(/]`,
          message:
            'Doğrudan renk fonksiyonu kullanılamaz. Rengi src/ui/theme.ts içinde semantik token olarak tanımla ve useTheme() ile kullan.',
        },
      ],
    },
  },
  {
    // Mimari sınır: src/app yalnızca görsel düzenleyicidir.
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: DATA_LAYER_IMPORTS, patterns: DATA_LAYER_IMPORT_PATTERNS },
      ],
    },
  },
  {
    // Kural doğrulama fixture'ı: src/app ile aynı mimari sınır kuralına tabidir.
    files: ['tools/lint-fixtures/screen-imports-supabase.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: DATA_LAYER_IMPORTS, patterns: DATA_LAYER_IMPORT_PATTERNS },
      ],
    },
  },
  {
    // Sunum katmanı: token aramaları (theme.colors[tone] gibi) anahtarı literal union
    // olan, sabit ve kullanıcı girdisinden bağımsız erişimlerdir. detect-object-injection
    // burada yalnız yanlış pozitif üretir ve okunabilirliği bozar. Kural, sunucu ve
    // kullanıcı verisinin aktığı src/features ile src/lib altında açık kalır.
    files: ['src/ui/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
    rules: { 'security/detect-object-injection': 'off' },
  },
  {
    // Tema tokenlarının tanımlandığı tek dosya: doğrudan renk değerine burada izin verilir.
    files: ['src/ui/theme.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSAnyKeyword',
          message: 'any kullanımı sözleşme gereği yasaktır.',
        },
      ],
    },
  },
  {
    // Merkezi logger, console'a erişmesine izin verilen tek modüldür.
    files: ['src/lib/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}', 'jest.setup.ts'],
    rules: { 'security/detect-object-injection': 'off' },
  },
  {
    // Depo bakım scriptleri: çalışma zamanında değil, geliştirici makinesinde ve
    // CI'da koşarlar ve yalnız depoya ait dosyaları okurlar. Kullanıcı girdisi
    // işlemedikleri için dosya adı ve regex sertleştirme kuralları burada
    // yalnız gürültü üretir. Uygulama kodunda bu kurallar açık kalır.
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-unsafe-regex': 'off',
    },
  },
  {
    files: ['*.config.js'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { 'no-console': 'off' },
  },
  prettierConfig,
]);
