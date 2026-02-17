import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scenarios/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 15_000,
    fileParallelism: false, // Tests share API state — must run sequentially
  },
});
