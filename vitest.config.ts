import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@/server': path.resolve(__dirname, './server'),
      '@server': path.resolve(__dirname, './server'),
      '@': path.resolve(__dirname, './client'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./client/test/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}', 'client/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['client/**/*.{ts,tsx}'],
      exclude: ['client/test/**', 'client/**/*.d.ts'],
    },
  },
});
