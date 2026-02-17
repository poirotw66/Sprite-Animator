import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Set base path for GitHub Pages deployment
    // If deploying to root, use '/', otherwise use '/repository-name/'
    const base = process.env.GITHUB_PAGES === 'true' ? '/Sprite-Animator/' : '/';
    
    return {
      base,
      server: {
        port: 3000,
        host: '0.0.0.0',
        // HMR uses the dev server's port automatically (do not set hmr.port so 3001 works when 3000 is in use)
        hmr: { protocol: 'ws', host: 'localhost' },
      },
      plugins: [react()],
      define: {
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY ?? env.GEMINI_API_KEY ?? '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      worker: {
        format: 'es',
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom'],
              'vendor-genai': ['@google/genai'],
              'vendor-ui': ['lucide-react'],
            },
          },
        },
        chunkSizeWarningLimit: 600,
      }
    };
});
