import { defineConfig } from 'vitest/config';
import path from 'node:path';

const alias = { '@': path.resolve(__dirname, 'src') };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node', testTimeout: 120_000 },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          testTimeout: 120_000,
          hookTimeout: 180_000,
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          globalSetup: ['tests/integration/global-setup.ts'],
        },
      },
    ],
  },
});
