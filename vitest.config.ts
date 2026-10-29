import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/components/TerrainRelief3D/**/*.ts',
        'src/components/TerrainRelief3D/**/*.tsx',
      ],
      reporter: ['text', 'text-summary'],
    },
  },
});
