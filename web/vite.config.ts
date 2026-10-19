import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Landing photos live once in the repo, in apps/customer-web/public/images/landing.
// Serve them at /images/landing/* in dev and copy them into this site's build.
const landingImagesDir = path.resolve(__dirname, '../apps/customer-web/public/images/landing');
function sharedLandingImages() {
  return {
    name: 'laupay-shared-landing-images',
    configureServer(server: any) {
      server.middlewares.use('/images/landing', (req: any, res: any, next: any) => {
        const file = path.join(landingImagesDir, path.basename(decodeURIComponent((req.url || '').split('?')[0])));
        if (!file.startsWith(landingImagesDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        res.setHeader('Content-Type', file.endsWith('.webp') ? 'image/webp' : 'image/png');
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      if (!fs.existsSync(landingImagesDir)) throw new Error(`Landing images missing: ${landingImagesDir}`);
      const out = path.resolve(__dirname, 'dist/images/landing');
      fs.mkdirSync(out, { recursive: true });
      for (const f of fs.readdirSync(landingImagesDir)) {
        if (/\.(png|webp|jpe?g)$/i.test(f)) fs.copyFileSync(path.join(landingImagesDir, f), path.join(out, f));
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    sharedLandingImages(),
  ],
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, 'src/app'),
      '@': path.resolve(__dirname, 'src'),
      '@assets': path.resolve(__dirname, 'public'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: __dirname,
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
