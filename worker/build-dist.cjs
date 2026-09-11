const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const indexPath = path.join(distDir, 'index.js');
const swPath = path.join(distDir, 'service-worker.js');

if (!fs.existsSync(indexPath)) {
  console.error('dist/index.js introuvable');
  process.exit(1);
}

const originalCode = fs.readFileSync(indexPath, 'utf8');

// Version Service Worker (sans mot-clé export, utilise addEventListener)
const swCode = originalCode.replace(
  /export\s*\{\s*src_default\s+as\s+default\s*\};?/,
  `addEventListener('fetch', (event) => {\n  event.respondWith(src_default.fetch(event.request, globalThis, event));\n});`
);

fs.writeFileSync(swPath, swCode, 'utf8');
console.log('Build terminé avec succès :');
console.log(' - worker/dist/index.js (format ES Modules)');
console.log(' - worker/dist/service-worker.js (format Service Worker)');
