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
      '@persistence/memory/summarization/parser': resolve(__dirname, '../memory/src/summarization/parser/index.ts'),
      '@persistence/memory/summarization/formatter': resolve(__dirname, '../memory/src/summarization/formatter/index.ts'),
      '@persistence/memory/summarization/prompts': resolve(__dirname, '../memory/src/summarization/prompts/index.ts'),
      '@persistence/memory/summarization/tier': resolve(__dirname, '../memory/src/summarization/tier/index.ts'),
      '@persistence/memory/summarization': resolve(__dirname, '../memory/src/summarization/index.ts'),
      '@persistence/memory': resolve(__dirname, '../memory/src/index.ts'),
      '@persistence/db': resolve(__dirname, '../db/src/index.ts'),
      '@persistence/core': resolve(__dirname, '../core/src/index.ts'),
      '@persistence/llm': resolve(__dirname, '../llm/src/index.ts'),
    },
  },
});
