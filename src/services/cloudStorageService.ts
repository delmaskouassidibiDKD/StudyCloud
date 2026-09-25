/**
 * StudyCloud - Service de Stockage Cloud & Base de Données Dédiée (Option B)
 * Gère l'ensemble des interactions avec Cloudflare D1 et Cloudflare R2
 * pour le Classeur 3D, Audio, Images, Vidéos, Documents, Téléchargements,
 * Dossier Sécurisé et Corbeille avec isolation multi-utilisateur stricte.
 */

import { getWorkerApiUrl } from './api';
import { getCurrentUserId } from './userSync';
import { FileItem } from '../components/Page1FilesMenuView';
import { ClasseurCreatedFolder } from '../components/Folder3DModels';

// En-têtes d'authentification pour garantir l'isolation des données
function getAuthHeaders(): Record<string, string> {
  const userId = getCurrentUserId() || localStorage.getItem('unifolder_user_id') || 'default-user';
  const token = localStorage.getItem('sc_auth_token') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': userId,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function getUserIdParam(): string {
  return encodeURIComponent(getCurrentUserId() || localStorage.getItem('unifolder_user_id') || 'default-user');
}

export interface CloudOverviewData {
  counts: {
    classeurFolders: number;
    classeurFiles: number;
    audio: number;
    images: number;
    videos: number;
    documents: number;
    downloads: number;
    secure: number;
    trash: number;
  };
  totalBytes: number;
  totalFormatted: string;
  recentFiles: FileItem[];
}

export interface ReorderFolderItem {
  id: string;
  displayOrder?: number;
  positionX?: number;
  positionY?: number;
  zoomLevel?: number;
}

export interface ReorderFileItem {
  id: string;
  displayOrder?: number;
  positionX?: number;
  positionY?: number;
}

export const CloudStorageAPI = {
  // --------------------------------------------------------------------------
  // Vue d'ensemble Espace Cloud (Synthèse sans table dédiée)
  // --------------------------------------------------------------------------
  async getOverview(): Promise<CloudOverviewData | null> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/overview?userId=${getUserIdParam()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? data : null;
    } catch (e) {
      console.warn('[CloudStorageAPI] getOverview fallback local:', e);
      return null;
    }
  },

  // --------------------------------------------------------------------------
  // 1. CLASSEUR - DOSSIERS 3D (Couleurs, Modèles 3D, Positions X/Y, Zoom)
  // --------------------------------------------------------------------------
  async getClasseurFolders(): Promise<ClasseurCreatedFolder[]> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/classeur/folders?userId=${getUserIdParam()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data.map((f: any) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId || undefined,
          modelId: f.modelId || '1',
          primaryColor: f.primaryColor || '#EA580C',
          accentColor: f.accentColor || '#F97316',
          iconName: f.iconName || 'Folder',
          textDark: Boolean(f.textDark),
          positionX: Number(f.positionX || 0),
          positionY: Number(f.positionY || 0),
          displayOrder: Number(f.displayOrder || 0),
          zoomLevel: Number(f.zoomLevel || 10),
          isPinned: Boolean(f.isPinned),
          isFavorite: Boolean(f.isFavorite),
        }));
      }
      return [];
    } catch (e) {
      console.warn('[CloudStorageAPI] getClasseurFolders error:', e);
      return [];
    }
  },

  async saveClasseurFolder(folder: ClasseurCreatedFolder): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/classeur/folders?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: folder.id,
          name: folder.name,
          parentId: folder.parentId || null,
          modelId: folder.modelId || '1',
          primaryColor: folder.primaryColor,
          accentColor: folder.accentColor,
          iconName: folder.iconName,
          textDark: folder.textDark,
          positionX: folder.positionX || 0,
          positionY: folder.positionY || 0,
          displayOrder: folder.displayOrder || 0,
          zoomLevel: folder.zoomLevel || 10,
          isPinned: folder.isPinned,
          isFavorite: folder.isFavorite,
        }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] saveClasseurFolder error:', e);
      return false;
    }
  },

  async reorderClasseurFolders(reorderList: ReorderFolderItem[]): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/classeur/folders?userId=${getUserIdParam()}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reorderList }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] reorderClasseurFolders error:', e);
      return false;
    }
  },

  async updateClasseurFolder(id: string, updates: Partial<ClasseurCreatedFolder>): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/classeur/folders?userId=${getUserIdParam()}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, ...updates }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] updateClasseurFolder error:', e);
      return false;
    }
  },

  async deleteClasseurFolder(folderId: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/classeur/folders?id=${encodeURIComponent(folderId)}&userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] deleteClasseurFolder error:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // 2. CLASSEUR - FICHIERS & BLOC-NOTES INTÉGRÉS (Positions, Tailles, Contenu)
  // --------------------------------------------------------------------------
  async getClasseurFiles(folderId?: string): Promise<FileItem[]> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const url = folderId
        ? `${baseUrl}/api/cloud/classeur/files?folderId=${encodeURIComponent(folderId)}&userId=${getUserIdParam()}`
        : `${baseUrl}/api/cloud/classeur/files?userId=${getUserIdParam()}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (e) {
      console.warn('[CloudStorageAPI] getClasseurFiles error:', e);
      return [];
    }
  },

  async saveClasseurFile(file: FileItem, folderId: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/classeur/files?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: file.id,
          folderId,
          name: file.name,
          size: file.size,
          sizeBytes: file.sizeBytes,
          category: file.category,
          extension: file.extension,
          source: file.source,
          date: file.date,
          positionX: (file as any).positionX || 0,
          positionY: (file as any).positionY || 0,
          displayOrder: (file as any).displayOrder || 0,
          isNotepad: file.isNotepad,
          noteTitle: file.noteTitle,
          content: file.content,
          previewUrl: file.previewUrl,
          r2Key: (file as any).r2Key,
          fileUrl: file.url,
          isPinned: file.isPinned,
          isFavorite: file.isFavorite,
        }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] saveClasseurFile error:', e);
      return false;
    }
  },

  async reorderClasseurFiles(reorderList: ReorderFileItem[]): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/classeur/files?userId=${getUserIdParam()}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reorderList }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] reorderClasseurFiles error:', e);
      return false;
    }
  },

  async updateClasseurFile(fileId: string, updates: Partial<FileItem>): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/classeur/files?userId=${getUserIdParam()}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: fileId, ...updates }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] updateClasseurFile error:', e);
      return false;
    }
  },

  async deleteClasseurFile(fileId: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/classeur/files?id=${encodeURIComponent(fileId)}&userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] deleteClasseurFile error:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // 3. AUDIO / MUSIQUE (/api/cloud/audio)
  // --------------------------------------------------------------------------
  async getAudioList(): Promise<FileItem[]> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/audio?userId=${getUserIdParam()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (e) {
      console.warn('[CloudStorageAPI] getAudioList error:', e);
      return [];
    }
  },

  async saveAudio(item: FileItem): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/audio?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(item),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] saveAudio error:', e);
      return false;
    }
  },

  async deleteAudio(id: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/audio?id=${encodeURIComponent(id)}&userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] deleteAudio error:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // 4. IMAGES / PHOTOS (/api/cloud/images)
  // --------------------------------------------------------------------------
  async getImagesList(): Promise<FileItem[]> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/images?userId=${getUserIdParam()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (e) {
      console.warn('[CloudStorageAPI] getImagesList error:', e);
      return [];
    }
  },

  async saveImage(item: FileItem): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/images?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(item),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] saveImage error:', e);
      return false;
    }
  },

  async deleteImage(id: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/images?id=${encodeURIComponent(id)}&userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] deleteImage error:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // 5. VIDÉOS (/api/cloud/videos)
  // --------------------------------------------------------------------------
  async getVideosList(): Promise<FileItem[]> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/videos?userId=${getUserIdParam()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (e) {
      console.warn('[CloudStorageAPI] getVideosList error:', e);
      return [];
    }
  },

  async saveVideo(item: FileItem): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/videos?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(item),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] saveVideo error:', e);
      return false;
    }
  },

  async deleteVideo(id: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/videos?id=${encodeURIComponent(id)}&userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] deleteVideo error:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // 6. DOCUMENTS DE COURS & FASCICULES (/api/cloud/documents)
  // --------------------------------------------------------------------------
  async getDocumentsList(): Promise<FileItem[]> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/documents?userId=${getUserIdParam()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (e) {
      console.warn('[CloudStorageAPI] getDocumentsList error:', e);
      return [];
    }
  },

  async saveDocument(item: FileItem): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/documents?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(item),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] saveDocument error:', e);
      return false;
    }
  },

  async deleteDocument(id: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/documents?id=${encodeURIComponent(id)}&userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] deleteDocument error:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // 7. TÉLÉCHARGEMENTS (/api/cloud/downloads)
  // --------------------------------------------------------------------------
  async getDownloadsList(): Promise<FileItem[]> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/downloads?userId=${getUserIdParam()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (e) {
      console.warn('[CloudStorageAPI] getDownloadsList error:', e);
      return [];
    }
  },

  async saveDownload(item: FileItem): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/downloads?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(item),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] saveDownload error:', e);
      return false;
    }
  },

  async deleteDownload(id: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/downloads?id=${encodeURIComponent(id)}&userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] deleteDownload error:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // 8. DOSSIER SÉCURISÉ (/api/cloud/secure/*)
  // --------------------------------------------------------------------------
  async checkSecurePinConfigured(): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/secure/config?userId=${getUserIdParam()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return false;
      const json = await res.json();
      return Boolean(json.isConfigured);
    } catch (e) {
      return Boolean(localStorage.getItem('studycloud_secure_folder_pin'));
    }
  },

  async setSecurePin(pin: string, oldPin?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/secure/set-pin?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ pin, oldPin }),
      });
      const json = await res.json();
      if (json.success) {
        localStorage.setItem('studycloud_secure_folder_pin', pin);
      }
      return json;
    } catch (e: any) {
      return { success: false, error: e.message || 'Erreur réseau' };
    }
  },

  async verifySecurePin(pin: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/secure/verify-pin?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        const json = await res.json();
        return Boolean(json.verified);
      }
      // Fallback local si offline
      const local = localStorage.getItem('studycloud_secure_folder_pin');
      return local === pin;
    } catch (e) {
      const local = localStorage.getItem('studycloud_secure_folder_pin');
      return local === pin;
    }
  },

  async getSecureFiles(): Promise<FileItem[]> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/secure/files?userId=${getUserIdParam()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (e) {
      console.warn('[CloudStorageAPI] getSecureFiles error:', e);
      return [];
    }
  },

  async moveToSecureFolder(file: FileItem, fromCategory: string, fromFolderId?: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/secure/files?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ file, fromCategory, fromFolderId }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] moveToSecureFolder error:', e);
      return false;
    }
  },

  async restoreFromSecureFolder(fileId: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/secure/files?id=${encodeURIComponent(fileId)}&userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] restoreFromSecureFolder error:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // 9. CORBEILLE & RESTAURATION (/api/cloud/trash)
  // --------------------------------------------------------------------------
  async getTrashFiles(): Promise<FileItem[]> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/trash?userId=${getUserIdParam()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (e) {
      console.warn('[CloudStorageAPI] getTrashFiles error:', e);
      return [];
    }
  },

  async restoreTrashItem(id: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/trash?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] restoreTrashItem error:', e);
      return false;
    }
  },

  async restoreMultipleTrash(ids: string[]): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/trash?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] restoreMultipleTrash error:', e);
      return false;
    }
  },

  async deleteTrashPermanently(ids: string[]): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/trash?userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] deleteTrashPermanently error:', e);
      return false;
    }
  },

  async emptyTrash(): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/trash?empty=true&userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] emptyTrash error:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // 10. UPLOAD DIRECT R2 ET D1 PAR CATÉGORIE (Validation & Routage Intelligent)
  // --------------------------------------------------------------------------
  async uploadFile(
    file: File | Blob,
    category: 'auto' | 'classeur' | 'audio' | 'images' | 'videos' | 'documents',
    fileName: string,
    folderId?: string
  ): Promise<{ success: boolean; category?: string; detectedCategory?: string; file?: FileItem; error?: string }> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const uploadUrl = `${baseUrl}/api/cloud/upload?category=${encodeURIComponent(category)}&name=${encodeURIComponent(fileName)}&folderId=${encodeURIComponent(folderId || '')}&userId=${getUserIdParam()}`;
      
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'x-user-id': getCurrentUserId() || 'default-user',
        },
        body: file,
      });

      if (!res.ok) {
        let errorMsg = 'Erreur lors du téléversement';
        try {
          const errJson = await res.json();
          if (errJson && errJson.error) errorMsg = errJson.error;
        } catch {
          const errText = await res.text();
          if (errText) errorMsg = errText;
        }
        return { success: false, error: errorMsg };
      }

      const json = await res.json();
      return json;
    } catch (e: any) {
      console.error('[CloudStorageAPI] uploadFile error:', e);
      return { success: false, error: e.message || 'Erreur réseau lors du téléversement' };
    }
  },

  async uploadFileToCategoryR2(
    file: File | Blob,
    category: 'classeur' | 'audio' | 'images' | 'videos' | 'documents' | 'downloads' | 'secure',
    fileName: string,
    folderId?: string
  ): Promise<{ success: boolean; id?: string; key?: string; url?: string; error?: string }> {
    const res = await this.uploadFile(file, category as any, fileName, folderId);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return {
      success: true,
      id: res.file?.id,
      key: (res.file as any)?.r2Key || res.file?.id,
      url: res.file?.url,
    };
  },

  // --------------------------------------------------------------------------
  // 10. FAVORIS (/api/cloud/favorites)
  // --------------------------------------------------------------------------
  async getFavorites(): Promise<{ itemId: string; category: string }[]> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/favorites?userId=${getUserIdParam()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []).map((row: any) => ({
        itemId: row.item_id || row.itemId || row.id,
        category: row.category || 'documents'
      }));
    } catch (e) {
      console.error('[CloudStorageAPI] getFavorites error:', e);
      return [];
    }
  },

  async addFavorite(itemId: string, category: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/favorites?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ itemId, category }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] addFavorite error:', e);
      return false;
    }
  },

  async removeFavorite(itemId: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/favorites?itemId=${encodeURIComponent(itemId)}&userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] removeFavorite error:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // 11. ÉPINGLÉS (/api/cloud/pinned)
  // --------------------------------------------------------------------------
  async getPinned(): Promise<{ itemId: string; category: string }[]> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/pinned?userId=${getUserIdParam()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []).map((row: any) => ({
        itemId: row.item_id || row.itemId || row.id,
        category: row.category || 'documents'
      }));
    } catch (e) {
      console.error('[CloudStorageAPI] getPinned error:', e);
      return [];
    }
  },

  async addPinned(itemId: string, category: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/pinned?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ itemId, category }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] addPinned error:', e);
      return false;
    }
  },

  async removePinned(itemId: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/pinned?itemId=${encodeURIComponent(itemId)}&userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] removePinned error:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // 12. RENOMMER (/api/cloud/rename)
  // --------------------------------------------------------------------------
  async renameItem(id: string, name: string, category: string, folderId?: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/rename?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, name, category, folderId }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] renameItem error:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // 13. DUPLIQUER (/api/cloud/duplicate)
  // --------------------------------------------------------------------------
  async duplicateItem(id: string, category: string, folderId?: string, name?: string): Promise<any> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/duplicate?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, category, folderId, name }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch (e) {
      console.error('[CloudStorageAPI] duplicateItem error:', e);
      return null;
    }
  },

  // --------------------------------------------------------------------------
  // 14. DÉPLACER OU COPIER VERS DES DOSSIERS (/api/cloud/move)
  // --------------------------------------------------------------------------
  async moveOrCopyItems(items: any[], targetFolderIds: string[], mode: 'move' | 'copy' = 'move'): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/api/cloud/move?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ items, targetFolderIds, mode }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] moveOrCopyItems error:', e);
      return false;
    }
  },
};

