import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';

function swVersionPlugin() {
  return {
    name: 'sw-version-plugin',
    closeBundle() {
      const swDistPath = path.resolve(__dirname, 'dist', 'sw.js');
      if (fs.existsSync(swDistPath)) {
        let content = fs.readFileSync(swDistPath, 'utf-8');
        const buildId = Date.now().toString(36);
        content = content.replace(/const CACHE_NAME = 'studycloud-pwa-[^']*';/, `const CACHE_NAME = 'studycloud-pwa-v${buildId}';`);
        content += `\n// BUILD_DEPLOY_VERSION_${buildId}\n`;
        fs.writeFileSync(swDistPath, content);
        console.log(`[PWA] dist/sw.js versionné avec succès : v${buildId}`);
      }
    }
  };
}

export default defineConfig(() => {
  return {
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
