import { defineConfig } from 'vitest/config';

// Automated tests (Phase 15B). Run with: npm test
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Starts one throwaway MongoDB (replica set, for transactions) for the whole test run
    globalSetup: ['tests/setup/globalSetup.ts'],
    // Runs before every test file: test-only settings, its own empty database
    setupFiles: ['tests/setup/testEnv.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000, // the very first run downloads MongoDB (about 100 MB)
  },
});