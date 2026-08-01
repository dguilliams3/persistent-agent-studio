import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{js,ts}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tseslint.parser,
      globals: {
        ...globals.es2021,
        // Cloudflare Workers globals
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        crypto: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        ReadableStream: 'readonly',
        WritableStream: 'readonly',
        TransformStream: 'readonly',
        structuredClone: 'readonly',
        queueMicrotask: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      // Core rules
      //
      // The BASE no-unused-vars rule stays off (tseslint.configs.recommended
      // disables it) because it cannot read TypeScript type syntax and ignores
      // the `_`-prefix convention. @typescript-eslint/no-unused-vars is the
      // TS-aware replacement. Keep this in sync with the root eslint.config.js.
      'no-console': 'off',
      'prefer-const': 'error',
      // `null: 'ignore'` permits the deliberate `x != null` idiom; every other
      // loose comparison is still an error.
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'no-case-declarations': 'error',
      'no-useless-escape': 'error'
    }
  },
  {
    ignores: ['node_modules/**', '.wrangler/**', 'dist/**', 'test-results/**']
  }
];
