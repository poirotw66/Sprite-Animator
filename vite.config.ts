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
        hmr: {
          host: 'localhost',
          port: 3000,
          protocol: 'ws',
        },
      },
      plugins: [react()],
      define: {
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
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
      }
    };
});
