import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    // DJG_VITE_PORT: run a second dev instance next to a live one (smoke tests)
    server: process.env.DJG_VITE_PORT ? { port: +process.env.DJG_VITE_PORT, strictPort: true } : undefined,
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/index.html'),
          output: resolve(__dirname, 'src/renderer/output.html')
        }
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@engine': resolve(__dirname, 'src/engine'),
        '@renderer': resolve(__dirname, 'src/renderer')
      }
    }
  }
})
