import { bytecodePlugin, defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    // V8 bytecode in production: the main process and the preload ship as
    // .jsc, not as readable JavaScript (closed source since v0.53)
    plugins: [externalizeDepsPlugin(), bytecodePlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    // no bytecode here: the renderers are sandboxed (Electron's default with a
    // preload) and a sandboxed preload cannot run the bytecode loader. The
    // preload is the IPC bridge, forty lines of channel names: nothing to hide.
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
        },
        output: {
          // libraries in their own chunks: scripts/obfuscate.mjs scrambles
          // only our code, and three.js is public anyway
          manualChunks: {
            three: ['three'],
            vendor: ['react', 'react-dom', 'react-dom/client']
          }
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
