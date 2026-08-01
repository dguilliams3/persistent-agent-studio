import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@persistence/core': resolve(__dirname, '../core/src/index.ts'),
      '@persistence/db': resolve(__dirname, '../db/src/index.ts'),
      '@persistence/memory/summarization': resolve(__dirname, '../memory/src/summarization/index.ts'),
      '@persistence/memory': resolve(__dirname, '../memory/src/index.ts'),
      '@persistence/tools': resolve(__dirname, '../tools/src/index.ts'),
    },
  },
});
