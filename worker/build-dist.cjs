const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const indexPath = path.join(distDir, 'index.js');
const cleanPath = path.join(distDir, 'worker-clean.js');
const swPath = path.join(distDir, 'service-worker.js');

if (!fs.existsSync(indexPath)) {
  console.error('dist/index.js introuvable');
  process.exit(1);
}

let originalCode = fs.readFileSync(indexPath, 'utf8');

// Supprimer les lignes de sourceMappingURL (provoquent des erreurs 404 dans l'éditeur en ligne de Cloudflare)
originalCode = originalCode.replace(/\/\/#\s*sourceMappingURL=.*$/gm, '').trim();

// Ajouter les directives de suppression d'erreurs de linter/TypeScript en tête de fichier
const header = '// @ts-nocheck\n/* eslint-disable */\n';

let moduleCode = originalCode;
if (!moduleCode.startsWith('// @ts-nocheck')) {
  moduleCode = header + moduleCode;
}

// Écrire à la fois dans index.js et dans un nouveau fichier worker-clean.js
fs.writeFileSync(indexPath, moduleCode + '\n', 'utf8');
fs.writeFileSync(cleanPath, moduleCode + '\n', 'utf8');

// Version Service Worker (sans aucun mot-clé export, utilise addEventListener)
let swCode = originalCode;
swCode = swCode.replace(/export\s*\{[^}]*\};?/g, '');
swCode = swCode.replace(/export\s+class\s+MyWorkflow/g, 'class MyWorkflow');

swCode += `\n\naddEventListener('fetch', (event) => {\n  event.respondWith(src_default.fetch(event.request, globalThis, event));\n});\n`;

if (!swCode.startsWith('// @ts-nocheck')) {
  swCode = header + swCode;
}

fs.writeFileSync(swPath, swCode, 'utf8');

console.log('Build terminé avec succès :');
console.log(' - worker/dist/index.js (format ES Modules)');
console.log(' - worker/dist/worker-clean.js (format ES Modules - nouveau fichier frais sans cache éditeur)');
console.log(' - worker/dist/service-worker.js (format Service Worker)');
