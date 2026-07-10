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
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'prefer-const': 'error',
      'eqeqeq': 'error',
      'no-var': 'error',
      'no-case-declarations': 'error',
      'no-useless-escape': 'error'
    }
  },
  {
    ignores: ['node_modules/**', '.wrangler/**', 'dist/**', 'test-results/**']
  }
];
