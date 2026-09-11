const fs = require('fs');
const path = require('path');

const workerDir = __dirname;
const distDir = path.join(workerDir, 'dist');
const indexPath = path.join(distDir, 'index.js');
const cloudflarePath = path.join(workerDir, 'CODE_A_COLLER_DANS_CLOUDFLARE.js');

if (!fs.existsSync(indexPath)) {
  console.error('dist/index.js introuvable');
  process.exit(1);
}

let originalCode = fs.readFileSync(indexPath, 'utf8');

// Supprimer les lignes de sourceMappingURL
originalCode = originalCode.replace(/\/\/#\s*sourceMappingURL=.*$/gm, '').trim();

// Ajouter les directives de suppression d'erreurs de linter/TypeScript en tête de fichier
const header = '// @ts-nocheck\n/* eslint-disable */\n';

let moduleCode = originalCode;
if (!moduleCode.startsWith('// @ts-nocheck')) {
  moduleCode = header + moduleCode;
}

// Écrire la version finale propre dans dist/index.js et CODE_A_COLLER_DANS_CLOUDFLARE.js
fs.writeFileSync(indexPath, moduleCode + '\n', 'utf8');
fs.writeFileSync(cloudflarePath, moduleCode + '\n', 'utf8');

// Nettoyer tous les fichiers temporaires ou inutilisés
const filesToDelete = [
  path.join(distDir, 'index.js.map'),
  path.join(distDir, 'service-worker.js'),
  path.join(distDir, 'worker-clean.js')
];

for (const file of filesToDelete) {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

console.log('Build terminé avec succès :');
console.log(' - worker/dist/index.js (fichier original)');
console.log(' - worker/CODE_A_COLLER_DANS_CLOUDFLARE.js (fichier direct)');
