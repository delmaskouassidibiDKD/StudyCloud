import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';

const currentBuildId = Date.now().toString(36);

function swVersionPlugin() {
  return {
    name: 'sw-version-plugin',
    closeBundle() {
      // 1. Extraire automatiquement les assets critiques (JS/CSS/polices) de dist/index.html
      // pour que le Service Worker les pré-cache DÈS l'installation -> ouverture 100 % hors-ligne garantie !
      const distDir = path.resolve(__dirname, 'dist');
      const indexHtmlPath = path.resolve(distDir, 'index.html');
      const precacheBundleAssets = new Set<string>();

      if (fs.existsSync(indexHtmlPath)) {
        const html = fs.readFileSync(indexHtmlPath, 'utf-8');
        const assetRegex = /(?:src|href)=["'](\/assets\/[^"']+)["']/g;
        let match: RegExpExecArray | null;
        while ((match = assetRegex.exec(html)) !== null) {
          precacheBundleAssets.add(match[1]);
        }
      }

      // Inclure aussi les chunks critiques core dans dist/assets (index-*.js, vendor-react-*.js, vendor-icons-*.js, index-*.css)
      const assetsDir = path.resolve(distDir, 'assets');
      if (fs.existsSync(assetsDir)) {
        try {
          for (const file of fs.readdirSync(assetsDir)) {
            if (
              /^index-.*\.(js|css)$/.test(file) ||
              /^vendor-react-.*\.js$/.test(file) ||
              /^vendor-icons-.*\.js$/.test(file)
            ) {
              precacheBundleAssets.add(`/assets/${file}`);
            }
          }
        } catch {}
      }

      // 2. Mettre à jour dist/sw.js avec le numéro de version ET la liste exacte des assets à pré-cacher
      const swDistPath = path.resolve(distDir, 'sw.js');
      if (fs.existsSync(swDistPath)) {
        let content = fs.readFileSync(swDistPath, 'utf-8');
        content = content.replace(
          /const CACHE_NAME = 'studycloud-pwa-[^']*';/,
          `const CACHE_NAME = 'studycloud-pwa-v${currentBuildId}';`
        );
        const injectedAssetsJson = JSON.stringify(Array.from(precacheBundleAssets));
        content = content.replace(
          /const BUILD_APP_ASSETS = \[[^\]]*\];/,
          `const BUILD_APP_ASSETS = ${injectedAssetsJson};`
        );
        content += `\n// BUILD_DEPLOY_VERSION_${currentBuildId}\n`;
        fs.writeFileSync(swDistPath, content);
        console.log(
          `[PWA] dist/sw.js versionné : v${currentBuildId} (${precacheBundleAssets.size} assets cœur pré-cachés pour le hors-ligne)`
        );
      }

      // 3. Générer dist/version.json pour détection universelle 100% appareils / comptes
      const versionDistPath = path.resolve(distDir, 'version.json');
      try {
        fs.writeFileSync(versionDistPath, JSON.stringify({
          buildId: currentBuildId,
          timestamp: Date.now(),
          version: '1.0.0'
        }, null, 2));
        console.log(`[PWA] dist/version.json généré : buildId = ${currentBuildId}`);
      } catch (err) {
        console.warn(`[PWA] Avertissement écriture dist/version.json :`, err);
      }

      // 4. Également dans public/version.json
      const versionPublicPath = path.resolve(__dirname, 'public', 'version.json');
      try {
        fs.writeFileSync(versionPublicPath, JSON.stringify({
          buildId: currentBuildId,
          timestamp: Date.now(),
          version: '1.0.0'
        }, null, 2));
      } catch (e) {}
    }
  };
}

export default defineConfig(() => {
  return {
    define: {
      '__STUDYCLOUD_BUILD_ID__': JSON.stringify(currentBuildId),
    },
    plugins: [react(), tailwindcss(), swVersionPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/pdfjs-dist') || id.includes('node_modules/pdf-lib')) {
              return 'vendor-pdf';
            }
            if (id.includes('node_modules/xlsx') || id.includes('node_modules/mammoth')) {
              return 'vendor-office';
            }
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) {
              return 'vendor-charts';
            }
            if (id.includes('node_modules/@fullcalendar')) {
              return 'vendor-calendar';
            }
            if (id.includes('node_modules/katex') || id.includes('node_modules/mathjs')) {
              return 'vendor-math';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
