import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue({
      template: {
        // Only needed if you use the <browse-ai-core> tag directly in templates
        compilerOptions: { isCustomElement: (tag) => tag === 'browse-ai-core' }
      }
    })
  ]
})
