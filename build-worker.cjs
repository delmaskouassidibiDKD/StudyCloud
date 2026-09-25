const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const entryFile = path.join(rootDir, 'worker', 'src', 'index.ts');
const outputFile = path.join(rootDir, 'worker', 'STUDYCLOUD_WORKER.js');

const bannerText = `// ============================================================================
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

esbuild.buildSync({
  entryPoints: [entryFile],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: outputFile,
  banner: {
    js: bannerText
  }
});

const stats = fs.statSync(outputFile);
console.log('✅ STUDYCLOUD_WORKER.js généré avec succès !');
console.log('Taille :', (stats.size / 1024).toFixed(1), 'Ko');
