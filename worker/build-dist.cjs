const fs = require('fs');
const path = require('path');

const workerDir = __dirname;
const distDir = path.join(workerDir, 'dist');
const tempIndexPath = path.join(distDir, 'index.js');
const targetWorkerPath = path.join(workerDir, 'STUDYCLOUD_WORKER.js');

if (!fs.existsSync(tempIndexPath)) {
  console.error('Erreur : dist/index.js introuvable pour la compilation.');
  process.exit(1);
}

let originalCode = fs.readFileSync(tempIndexPath, 'utf8');

// Supprimer les lignes de sourceMappingURL
originalCode = originalCode.replace(/\/\/#\s*sourceMappingURL=.*$/gm, '').trim();

// En-tête officiel clair
const banner = `// ============================================================================
// STUDYCLOUD - CLOUDFLARE WORKER BACKEND (FICHIER UNIQUE OFFICIEL)
// ============================================================================
// Ce fichier est le SEUL et UNIQUE fichier de Worker du projet.
// Tous les anciens fichiers ont été supprimés définitivement.
//
// POUR DÉPLOYER DANS CLOUDFLARE :
// 1. Ouvrez ce fichier (worker/STUDYCLOUD_WORKER.js).
// 2. Faites Ctrl+A puis Ctrl+C pour tout copier.
// 3. Allez sur votre Cloudflare Dashboard > Workers & Pages > Votre Worker > Quick Edit.
// 4. Effacez tout l'ancien code (Ctrl+A puis Suppr) et collez le nouveau code (Ctrl+V).
// 5. Cliquez sur "Save and Deploy" (Enregistrer et déployer).
// ============================================================================
// @ts-nocheck
/* eslint-disable */
`;

// Écrire UNIQUEMENT dans le nouveau fichier unique officiel STUDYCLOUD_WORKER.js
fs.writeFileSync(targetWorkerPath, banner + originalCode + '\n', 'utf8');

// Supprimer impérativement et définitivement TOUS les anciens fichiers
const legacyFiles = [
  path.join(workerDir, 'CLOUDFLARE_WORKER.js'),
  path.join(workerDir, 'CODE_A_COLLER_DANS_CLOUDFLARE.js'),
  path.join(workerDir, 'worker-clean.js'),
  path.join(workerDir, 'service-worker.js'),
  path.join(distDir, 'index.js.map'),
  path.join(distDir, 'service-worker.js'),
  path.join(distDir, 'worker-clean.js'),
  path.join(distDir, 'README.md'),
  tempIndexPath
];

for (const f of legacyFiles) {
  if (fs.existsSync(f)) {
    try { 
      fs.unlinkSync(f); 
      console.log('Ancien fichier supprimé :', path.basename(f));
    } catch (e) {}
  }
}

// Supprimer le dossier dist/ résiduel
if (fs.existsSync(distDir)) {
  try { fs.rmSync(distDir, { recursive: true, force: true }); } catch (e) {}
}

console.log('------------------------------------------------------------');
console.log('Succès : Le nouveau fichier unique du worker a été généré :');
console.log(' -> worker/STUDYCLOUD_WORKER.js');
console.log('Tous les anciens fichiers ont été supprimés avec succès.');
console.log('------------------------------------------------------------');
