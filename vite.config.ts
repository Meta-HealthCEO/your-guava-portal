/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const configuredApiUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL?.trim()
    if (!configuredApiUrl) {
      throw new Error('VITE_API_URL is required for production builds')
    }

    let productionApiUrl: URL
    try {
      productionApiUrl = new URL(configuredApiUrl)
    } catch {
      throw new Error('VITE_API_URL must be an absolute HTTPS URL for production builds')
    }
    if (productionApiUrl.protocol !== 'https:') {
      throw new Error('VITE_API_URL must use HTTPS for production builds')
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      env: {
        VITE_API_URL: 'http://localhost:5000/api',
      },
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
