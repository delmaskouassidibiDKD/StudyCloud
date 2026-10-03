import { SharedFolder } from '../types';

/**
 * Utilitaire de sécurisation du stockage local pour éviter l'erreur "QuotaExceededError" (5MB max)
 * Évite de persister des data-URLs volumineuses ou des images QR codes géantes.
 */
export const sanitizeFoldersForStorage = (foldersList: SharedFolder[]): SharedFolder[] => {
  if (!Array.isArray(foldersList)) return [];
  return foldersList.map((folder) => ({
    ...folder,
    qrCodeData: folder.qrCodeData && folder.qrCodeData.length > 500 ? undefined : folder.qrCodeData,
    files: (folder.files || []).map((file) => ({
      id: file.id,
      name: file.name,
      size: file.size,
      type: file.type,
      url: file.url && !file.url.startsWith('data:') ? file.url : '',
      r2Key: file.r2Key || undefined,
    })),
  }));
};
