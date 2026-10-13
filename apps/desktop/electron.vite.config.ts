import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const fontsDir = resolve(__dirname, '../../assets/fonts')
const brandingDir = resolve(__dirname, '../../assets/branding')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@fonts': fontsDir,
        '@branding': brandingDir
      }
    },
    server: {
      fs: {
        // Fonts live at the monorepo root; let the dev server reach them
        allow: [resolve(__dirname, '../..')]
      }
    }
  }
})
