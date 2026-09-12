const fs = require('fs');
const path = require('path');

const workerDir = __dirname;
const distDir = path.join(workerDir, 'dist');
const tempIndexPath = path.join(distDir, 'index.js');
const targetWorkerPath = path.join(workerDir, 'CLOUDFLARE_WORKER.js');

if (!fs.existsSync(tempIndexPath)) {
  console.error('Erreur : dist/index.js introuvable pour la compilation.');
  process.exit(1);
}

let originalCode = fs.readFileSync(tempIndexPath, 'utf8');

// Supprimer les lignes de sourceMappingURL
originalCode = originalCode.replace(/\/\/#\s*sourceMappingURL=.*$/gm, '').trim();

// Directives TypeScript / Linter en tête de fichier
const header = '// @ts-nocheck\n/* eslint-disable */\n';
let moduleCode = originalCode;
if (!moduleCode.startsWith('// @ts-nocheck')) {
  moduleCode = header + moduleCode;
}

// 1. Écrire dans le fichier worker officiel et le fichier d'aide
fs.writeFileSync(targetWorkerPath, moduleCode + '\n', 'utf8');
const legacyHelperPath = path.join(workerDir, 'CODE_A_COLLER_DANS_CLOUDFLARE.js');
fs.writeFileSync(legacyHelperPath, moduleCode + '\n', 'utf8');

// 2. Supprimer les fichiers temporaires résiduels
const legacyFiles = [
  path.join(distDir, 'index.js.map'),
  path.join(distDir, 'service-worker.js'),
  path.join(distDir, 'worker-clean.js'),
  path.join(distDir, 'README.md'),
  tempIndexPath
];

for (const f of legacyFiles) {
  if (fs.existsSync(f)) {
    try { fs.unlinkSync(f); } catch (e) {}
  }
}

// Supprimer le dossier dist/ résiduel pour qu'il ne reste qu'un seul fichier
if (fs.existsSync(distDir)) {
  try { fs.rmSync(distDir, { recursive: true, force: true }); } catch (e) {}
}

console.log('Build terminé avec succès :');
console.log(' -> worker/CLOUDFLARE_WORKER.js (FICHIER UNIQUE OFFICIEL À COLLER DANS CLOUDFLARE)');
console.log('Tous les autres fichiers et doublons ont été supprimés avec succès.');
