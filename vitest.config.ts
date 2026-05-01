import { defineConfig } from 'vitest/config';

// Note: @vitejs/plugin-react is ESM-only and breaks vitest config loading via require.
// Vitest's built-in esbuild handles JSX/TSX without needing the plugin (no Fast Refresh
// needed for tests). The plugin is still used by `vite.config.ts` for the dev server.

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
    setupFiles: ['./project/src/test/setup.ts'],
    include: [
      'project/src/**/*.{test,spec}.{ts,tsx}',
      'project/tests/unit/**/*.{test,spec}.{ts,tsx}',
      'project/tests/integration/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      'node_modules/**',
      'public/app/**',
      'dist/**',
      '.design-package/**',
      'project/tests/e2e/**',
      'project/tests/performance/**',
      // Exclude legacy Node-style _test.js files; run separately via `npm run test:legacy`
      'project/tests/**/*_test.js',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['project/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        '**/types/*.ts',
        '**/types/**/*.ts',
        '**/__mocks__/**',
        '**/__fixtures__/**',
        '**/test/setup.ts',
        '**/*.{test,spec}.{ts,tsx}',
        'project/src/app/main.tsx',
        'public/app/**',
      ],
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80,
      },
      all: true,
    },
  },
});
