import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  assetsInclude: ['**/*.mjs'],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/test/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/__tests__/',
        '**/types/',
        'src/main.tsx',
        'vite.config.ts',
        'vitest.config.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    onUnhandledError(error) {
      // happy-dom aborts in-flight fetch requests during environment teardown.
      // This is a known happy-dom behaviour, not a test or application bug.
      if (error instanceof DOMException && error.name === 'AbortError') return 'skip';
    },
    projects: [
      {
        // Pure logic / hooks — no DOM rendering. isolate:false shares the
        // module cache across files within a worker, so collect only loads
        // the module graph once per worker instead of once per file.
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          pool: 'threads',
          isolate: false,
          maxThreads: 2,
          minThreads: 2,
        },
      },
      {
        // React component tests — singleFork runs all files in one process so
        // Vite's transform cache stays warm (fast collect). isolate:true (default)
        // resets the module registry per file, so vi.mock() never leaks across files.
        extends: true,
        test: {
          name: 'component',
          include: ['src/**/*.test.tsx'],
          pool: 'forks',
          singleFork: true,
        },
      },
    ],
    testTimeout: 3000,
    passWithNoTests: false,
    exclude: ['node_modules', 'dist'],
  },
});
