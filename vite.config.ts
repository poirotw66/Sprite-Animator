import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function serveOutputFolderPlugin() {
  return {
    name: 'serve-output-folder',
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b?: Buffer) => void; statusCode: number }, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.startsWith('/output/')) {
          next();
          return;
        }
        const rel = decodeURIComponent(url.slice('/output/'.length));
        if (rel.includes('..')) {
          res.statusCode = 403;
          res.end();
          return;
        }
        const filePath = path.join(projectRoot, 'output', rel);
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          next();
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.json': 'application/json',
        };
        res.setHeader('Content-Type', mime[ext] ?? 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

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
      plugins: [react(), serveOutputFolderPlugin()],
      define: {
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY ?? env.GEMINI_API_KEY ?? '')
      },
      resolve: {
        alias: {
          '@': path.resolve(projectRoot, '.'),
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
              'vendor-transformers': ['@huggingface/transformers'],
            },
          },
        },
        chunkSizeWarningLimit: 600,
      }
    };
});
