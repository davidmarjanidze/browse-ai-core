import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'browse-ai-core/element': fileURLToPath(
        new URL('./projects/testing/element-stub.ts', import.meta.url)
      )
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['projects/react/**/*.spec.ts', 'projects/vue/**/*.spec.ts']
  }
})
