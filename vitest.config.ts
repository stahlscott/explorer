import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // test/browser is Playwright's; it needs a real Chromium, not vitest.
    include: ['test/**/*.test.ts'],
  },
});
