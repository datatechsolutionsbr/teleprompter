import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // jsdom refuses to expose localStorage when the document has an opaque
    // origin (the default `about:blank`). Pinning the URL gives the doc a
    // real origin so storage APIs work in tests.
    environmentOptions: {
      jsdom: { url: 'http://localhost/' },
    },
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
