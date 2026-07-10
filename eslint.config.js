import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.es2021
      }
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
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
      'no-useless-escape': 'error',

      // React rules
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
    languageOptions: {
      globals: {
        ...globals.vitest,
        ...globals.browser,
        ...globals.es2021
      }
    }
  },
  {
    ignores: ['dist/**', 'node_modules/**', '.wrangler/**', 'runs/**', 'archive/**', 'outputs/**', 'test-results/**']
  }
];
