import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // First use of the native peers (resvg, sharp) or a spawned CLI process can
    // take >5 s on cold Windows CI runners.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
