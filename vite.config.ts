import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  // ex. http://localhost:5173/api/healthに来たリクエストがapiで始まることを確認して、http://localhost:3000/api/healthにリクエストを転送する  
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
