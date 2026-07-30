/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages serves a project repo under /<repo-name>/, not /. Everything
  // else (local dev, npm run build for any other static host) stays at "/".
  base: process.env.GH_PAGES_BASE ?? '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
