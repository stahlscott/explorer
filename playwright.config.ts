import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    // Every assertion here is about a file:// artifact with no server.
    baseURL: undefined,
  },
});
