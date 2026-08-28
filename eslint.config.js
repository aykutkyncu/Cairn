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
    // Merkezi logger, console'a erişmesine izin verilen tek modüldür.
    files: ['src/lib/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}', 'jest.setup.ts'],
    rules: { 'security/detect-object-injection': 'off' },
  },
  {
    files: ['scripts/**/*.{js,mjs}'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['*.config.js'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { 'no-console': 'off' },
  },
  prettierConfig,
]);
