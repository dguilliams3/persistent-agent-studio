/**
 * Vite + Vitest Configuration
 *
 * @module vite.config
 * @description Combined Vite build and Vitest test configuration
 *
 * This configuration enables:
 * - React plugin for JSX transformation
 * - Vitest for testing with jsdom environment
 * - Global test APIs (describe, it, expect, vi)
 * - React Testing Library matchers
 * - Coverage via V8
 *
 * @upstream Called by: vite CLI, vitest CLI
 * @downstream Calls: @vitejs/plugin-react, vitest internals
 *
 * @usage
 * npm run dev         # Start dev server
 * npm run build       # Production build
 * npm run test        # Run tests in watch mode
 * npm run test:run    # Single test run
 * npm run test:coverage # With coverage report
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

function formatBuildDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function getBuildId() {
  try {
    const sha = execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (!sha) return 'dev';
    return `${sha}-${formatBuildDate()}`;
  } catch {
    return 'dev';
  }
}

const BUILD_ID = getBuildId();

function serviceWorkerVersionPlugin() {
  return {
    name: 'service-worker-version-stamp',
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist/sw.js');
      if (!fs.existsSync(swPath)) return;

      const source = fs.readFileSync(swPath, 'utf8');
      const stamped = source.replace(/__CACHE_VERSION__/g, `clio-${BUILD_ID}`);
      fs.writeFileSync(swPath, stamped, 'utf8');
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorkerVersionPlugin()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },

  resolve: {
    // Array form: regex entries generically map @persistence subpath imports to
    // package sources so the ROOT runner (vitest/vite) resolves the same specifiers
    // that per-package runners resolve via package.json exports. Order matters:
    // explicit src-form first, then generic subpaths, then bare package names.
    alias: [
      // '@persistence/<pkg>/src/<rest>' → 'packages/<pkg>/src/<rest>' (apps/web uses ui/src/... directly)
      {
        find: /^@persistence\/([a-z]+)\/src\/(.+)$/,
        replacement: `${path.resolve(__dirname, 'packages').replace(/\\/g, '/')}/$1/src/$2`,
      },
      // '@persistence/<pkg>/<subpath>' → 'packages/<pkg>/src/<subpath>' (dir → index.ts via normal resolution)
      {
        find: /^@persistence\/([a-z]+)\/(.+)$/,
        replacement: `${path.resolve(__dirname, 'packages').replace(/\\/g, '/')}/$1/src/$2`,
      },
      // Bare package names → package entrypoints
      { find: '@persistence/ui', replacement: path.resolve(__dirname, 'packages/ui/src/index.ts') },
      { find: '@persistence/db', replacement: path.resolve(__dirname, 'packages/db/src/index.ts') },
      { find: '@persistence/media', replacement: path.resolve(__dirname, 'packages/media/src/index.ts') },
      { find: '@persistence/memory', replacement: path.resolve(__dirname, 'packages/memory/src/index.ts') },
      { find: '@persistence/core', replacement: path.resolve(__dirname, 'packages/core/src/index.ts') },
      { find: '@persistence/llm', replacement: path.resolve(__dirname, 'packages/llm/src/index.ts') },
      { find: '@persistence/services', replacement: path.resolve(__dirname, 'packages/services/src/index.ts') },
      { find: '@persistence/runtime', replacement: path.resolve(__dirname, 'packages/runtime/src/index.ts') },
      { find: '@persistence/tools', replacement: path.resolve(__dirname, 'packages/tools/src/index.ts') },
    ],
  },

  test: {
    // Use jsdom for DOM APIs in tests
    environment: 'jsdom',

    // Enable global test APIs (describe, it, expect, vi)
    globals: true,

    // Setup file runs before each test file
    setupFiles: ['./tests/setup.js'],

    // Test file patterns
    include: [
      'apps/web/**/*.test.{js,jsx,ts,tsx}',
      'apps/web/**/__tests__/**/*.{js,jsx,ts,tsx}',
      'platforms/cloudflare/src/**/*.test.{js,ts}',
      'platforms/cloudflare/src/**/__tests__/**/*.{js,ts}',
      'platforms/cloudflare/src/services/__tests__/**/*.test.{js,ts}',
      'packages/*/src/**/*.test.{js,ts}',
      'tests/**/*.test.{js,ts}',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Include ALL source files in coverage, not just tested ones
      // This gives true repo coverage percentage
      all: true,
      include: [
        'apps/web/**/*.{js,jsx,ts,tsx}',
        'platforms/cloudflare/src/**/*.{js,ts}',
      ],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.{js,jsx}',
        '**/__tests__/**',
        'runs/**',
      ],
    },
  },
});



