/**
 * Module centralisé de gestion des dossiers et clés Cloudflare R2 (MON_R2_STUDYCLOUD)
 * Organise le stockage en sous-dossiers structurés selon les spécifications :
 * - products/images/ : Photos des produits de la boutique
 * - published/files/ : Fichiers publiés et partagés publiquement
 * - avatars/         : Photos de profil et icônes personnalisées des utilisateurs
 * - user-files/      : Fichiers personnels (« Mes fichiers » et Matières)
 * - ai-studies/      : Fichiers importés lors des sessions d'étude assistées par l'IA
 */

export const R2_FOLDERS = {
  PRODUCT_IMAGES: 'products/images',
  PUBLISHED_FILES: 'published/files',
  USER_AVATARS: 'avatars',
  USER_FILES: 'user-files',
  AI_STUDIES: 'ai-studies',
  SHARED_LINKS: 'shared-links/files',
} as const;

export type R2Category = keyof typeof R2_FOLDERS;

/**
 * Nettoie un nom de fichier pour les clés R2
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 100);
}

/**
 * Construit la clé R2 pour une image de produit de la boutique
 * Format: products/images/{sellerId}/{productId}_{index}.{ext}
 */
export function buildProductImageKey(sellerId: string, productId: string, index: number, ext = 'jpg'): string {
  const cleanSeller = sanitizeFileName(sellerId || 'seller');
  const cleanProd = sanitizeFileName(productId || 'prod');
  const cleanExt = ext.replace(/^\./, '').toLowerCase() || 'jpg';
  return `${R2_FOLDERS.PRODUCT_IMAGES}/${cleanSeller}/${cleanProd}_${index}.${cleanExt}`;
}

/**
 * Construit la clé R2 pour un fichier publié publiquement
 * Format: published/files/{userId}/{folderOrFileId}-{fileName}
 */
export function buildPublishedFileKey(userId: string, identifier: string, fileName: string): string {
  const cleanUser = sanitizeFileName(userId || 'user');
  const cleanId = sanitizeFileName(identifier || Date.now().toString());
  const cleanName = sanitizeFileName(fileName || 'file');
  return `${R2_FOLDERS.PUBLISHED_FILES}/${cleanUser}/${cleanId}-${cleanName}`;
}

/**
 * Construit la clé R2 pour l'icône / avatar d'un utilisateur
 * Format: avatars/{userId}-{timestamp}.{ext}
 */
export function buildAvatarKey(userId: string, ext = 'png'): string {
  const cleanUser = sanitizeFileName(userId || 'user');
  const cleanExt = ext.replace(/^\./, '').toLowerCase() || 'png';
  return `${R2_FOLDERS.USER_AVATARS}/${cleanUser}-${Date.now()}.${cleanExt}`;
}

/**
 * Construit la clé R2 pour les fichiers personnels (« Mes fichiers » et Matières)
 * Le fichier physique réside une seule fois dans R2, et D1 gère son affectation à une matière sans duplication.
 * Format: user-files/{userId}/{fileId}-{fileName}
 */
export function buildUserFileKey(userId: string, fileId: string, fileName: string): string {
  const cleanUser = sanitizeFileName(userId || 'user');
  const cleanId = sanitizeFileName(fileId || Date.now().toString());
  const cleanName = sanitizeFileName(fileName || 'document');
  return `${R2_FOLDERS.USER_FILES}/${cleanUser}/${cleanId}-${cleanName}`;
}

/**
 * Construit la clé R2 pour les fichiers importés lors des sessions d'étude avec l'IA
 * Format: ai-studies/{userId}/{fileId}-{fileName}
 */
export function buildAiStudyKey(userId: string, fileId: string, fileName: string): string {
  const cleanUser = sanitizeFileName(userId || 'user');
  const cleanId = sanitizeFileName(fileId || Date.now().toString());
  const cleanName = sanitizeFileName(fileName || 'study_doc');
  return `${R2_FOLDERS.AI_STUDIES}/${cleanUser}/${cleanId}-${cleanName}`;
}

/**
 * Construit la clé R2 pour les fichiers associés à un lien de partage
 * Stocke EXCLUSIVEMENT les fichiers associés aux liens dans un dossier dédié R2
 * Format: shared-links/files/{folderId}/{fileId}-{fileName}
 */
export function buildSharedLinkFileKey(folderId: string, fileId: string, fileName: string): string {
  const cleanFolder = sanitizeFileName(folderId || 'share');
  const cleanId = sanitizeFileName(fileId || Date.now().toString());
  const cleanName = sanitizeFileName(fileName || 'document');
  return `${R2_FOLDERS.SHARED_LINKS}/${cleanFolder}/${cleanId}-${cleanName}`;
}

