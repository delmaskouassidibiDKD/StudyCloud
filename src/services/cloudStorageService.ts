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
import { invalidateCloudQueries } from './queryClient';

// En-têtes d'authentification pour garantir l'isolation des données
function getAuthHeaders(): Record<string, string> {
  const userId = getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
  const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('sc_auth_token') || localStorage.getItem('unifolder_auth_token') || localStorage.getItem('auth_token') || '') : '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (userId && userId !== 'default-user') {
    headers['x-user-id'] = userId;
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function getUserIdParam(): string {
  const uid = getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || '';
  return encodeURIComponent(uid && uid !== 'default-user' ? uid : '');
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

export interface UserWallpaper {
  id: string;
  userId?: string;
  name: string;
  url: string;
  r2Key?: string;
  size?: number;
  isActive: boolean | number;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Helper : fetch avec timeout strict (15s par défaut pour réseaux mobiles/stables) ───
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const CloudStorageAPI = {
  // --------------------------------------------------------------------------
  // Vue d'ensemble Espace Cloud (Synthèse sans table dédiée)
  // --------------------------------------------------------------------------
  async getOverview(): Promise<CloudOverviewData | null> {
    try {
      const uid = getUserIdParam();
      if (!uid) return null;
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/overview?userId=${uid}`, {
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
  // Gestion persistante des aperçus récents rejetés / effacés (D1 user_dismissed_recents)
  // --------------------------------------------------------------------------
  async dismissRecent(fileId: string): Promise<boolean> {
    try {
      const uid = getUserIdParam();
      if (!uid) return false;
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/recents/dismiss`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fileId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getDismissedRecents(): Promise<string[]> {
    try {
      const uid = getUserIdParam();
      if (!uid) return [];
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/recents/dismissed?userId=${uid}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        return Array.isArray(json?.dismissedIds) ? json.dismissedIds : [];
      }
      return [];
    } catch {
      return [];
    }
  },

  async undismissRecent(fileId: string): Promise<boolean> {
    try {
      const uid = getUserIdParam();
      if (!uid) return false;
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/recents/undismiss`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fileId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // 1. CLASSEUR - DOSSIERS 3D (Couleurs, Modèles 3D, Positions X/Y, Zoom)
  // --------------------------------------------------------------------------
  async getClasseurFolders(): Promise<ClasseurCreatedFolder[]> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/classeur/folders?userId=${getUserIdParam()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data.map((f: any) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId || f.parent_id || undefined,
          model: (Number(f.model || f.modelId || f.model_id || 1) as 1 | 2 | 3 | 4),
          modelId: f.modelId || f.model_id || '1',
          primaryColor: f.primaryColor || f.primary_color || '#EA580C',
          accentColor: f.accentColor || f.accent_color || '#F97316',
          secondaryColor: f.secondaryColor || f.secondary_color,
          badge: f.badge,
          iconType: f.iconType || f.icon_type,
          iconName: f.iconName || f.icon_name || 'Folder',
          textDark: Boolean(f.textDark ?? f.text_dark),
          positionX: Number(f.positionX ?? f.position_x ?? 0),
          positionY: Number(f.positionY ?? f.position_y ?? 0),
          displayOrder: Number(f.displayOrder ?? f.display_order ?? 0),
          zoomLevel: Number(f.zoomLevel ?? f.zoom_level ?? 10),
          dateText: f.dateText || f.date_text || (f.createdAt ? new Date(f.createdAt).toLocaleDateString('fr-FR') : "Aujourd'hui"),
          createdAt: Number(f.createdAt ? new Date(f.createdAt).getTime() : (f.created_at ? new Date(f.created_at).getTime() : Date.now())),
          isPinned: Boolean(f.isPinned ?? f.is_pinned),
          isFavorite: Boolean(f.isFavorite ?? f.is_favorite),
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/classeur/folders?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: folder.id,
          name: folder.name,
          parentId: folder.parentId || null,
          model: folder.model,
          modelId: String(folder.modelId || folder.model || '1'),
          primaryColor: folder.primaryColor,
          accentColor: folder.accentColor,
          secondaryColor: folder.secondaryColor,
          badge: folder.badge,
          iconType: folder.iconType,
          iconName: folder.iconName,
          textDark: folder.textDark,
          dateText: folder.dateText,
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/classeur/folders?userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/classeur/folders?userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/classeur/folders?id=${encodeURIComponent(folderId)}&userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(url, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/classeur/files?userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/classeur/files?userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/classeur/files?userId=${getUserIdParam()}`, {
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

  async deleteClasseurFile(fileId: string, name?: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      let url = `${baseUrl}/api/cloud/classeur/files?id=${encodeURIComponent(fileId)}&userId=${getUserIdParam()}`;
      if (name) url += `&name=${encodeURIComponent(name)}`;
      const res = await fetchWithTimeout(url, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/audio?userId=${getUserIdParam()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data.map((a: any) => {
          const rawCover = a.coverUrl || a.thumbnailUrl || a.previewUrl || '';
          const isAudioStream = typeof rawCover === 'string' && rawCover.match(/\.(mp3|wav|ogg|m4a|aac|flac|opus|wma|amr|weba|aiff|alac|mid|midi|caf|3ga)$/i);
          const validCover = (rawCover && !isAudioStream && !rawCover.startsWith('blob:')) ? rawCover : '';
          return {
            ...a,
            previewUrl: validCover,
            coverUrl: validCover,
            thumbnailUrl: validCover,
          };
        });
      }
      return [];
    } catch (e) {
      console.warn('[CloudStorageAPI] getAudioList error:', e);
      return [];
    }
  },

  async saveAudio(item: FileItem): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/audio?userId=${getUserIdParam()}`, {
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

  async deleteAudio(id: string, name?: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      let url = `${baseUrl}/api/cloud/audio?id=${encodeURIComponent(id)}&userId=${getUserIdParam()}`;
      if (name) url += `&name=${encodeURIComponent(name)}`;
      const res = await fetchWithTimeout(url, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/images?userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/images?userId=${getUserIdParam()}`, {
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

  async deleteImage(id: string, name?: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      let url = `${baseUrl}/api/cloud/images?id=${encodeURIComponent(id)}&userId=${getUserIdParam()}`;
      if (name) url += `&name=${encodeURIComponent(name)}`;
      const res = await fetchWithTimeout(url, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/videos?userId=${getUserIdParam()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data.map((v: any) => {
          const isRealThumb = v.thumbnailUrl && !v.thumbnailUrl.endsWith('.mp4') && !v.thumbnailUrl.endsWith('.webm') && !v.thumbnailUrl.endsWith('.mov') && !v.thumbnailUrl.endsWith('.avi');
          const thumb = isRealThumb ? v.thumbnailUrl : (v.previewUrl && !v.previewUrl.endsWith('.mp4') ? v.previewUrl : '');
          return {
            ...v,
            thumbnailUrl: thumb,
            previewUrl: thumb,
          };
        });
      }
      return [];
    } catch (e) {
      console.warn('[CloudStorageAPI] getVideosList error:', e);
      return [];
    }
  },

  async saveVideo(item: FileItem): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/videos?userId=${getUserIdParam()}`, {
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

  async deleteVideo(id: string, name?: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      let url = `${baseUrl}/api/cloud/videos?id=${encodeURIComponent(id)}&userId=${getUserIdParam()}`;
      if (name) url += `&name=${encodeURIComponent(name)}`;
      const res = await fetchWithTimeout(url, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/documents?userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/documents?userId=${getUserIdParam()}`, {
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

  async deleteDocument(id: string, name?: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      let url = `${baseUrl}/api/cloud/documents?id=${encodeURIComponent(id)}&userId=${getUserIdParam()}`;
      if (name) url += `&name=${encodeURIComponent(name)}`;
      const res = await fetchWithTimeout(url, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/downloads?userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/downloads?userId=${getUserIdParam()}`, {
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

  async deleteDownload(id: string, name?: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      let url = `${baseUrl}/api/cloud/downloads?id=${encodeURIComponent(id)}&userId=${getUserIdParam()}`;
      if (name) url += `&name=${encodeURIComponent(name)}`;
      const res = await fetchWithTimeout(url, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/secure/config?userId=${getUserIdParam()}`, {
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

  async isSecureFolderConfigured(): Promise<boolean> {
    return this.checkSecurePinConfigured();
  },

  async setSecurePin(pin: string, oldPin?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/secure/set-pin?userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/secure/verify-pin?userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/secure/files?userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/secure/files?userId=${getUserIdParam()}`, {
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

  async restoreFromSecureFolder(fileIdOrIds: string | string[]): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const ids = Array.isArray(fileIdOrIds) ? fileIdOrIds : [fileIdOrIds];
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/secure/files?action=restore&userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids, action: 'restore' }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] restoreFromSecureFolder error:', e);
      return false;
    }
  },

  async deleteSecureFilesToTrash(fileIdOrIds: string | string[]): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const ids = Array.isArray(fileIdOrIds) ? fileIdOrIds : [fileIdOrIds];
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/secure/files?action=trash&userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids, action: 'trash' }),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] deleteSecureFilesToTrash error:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // 9. CORBEILLE & RESTAURATION (/api/cloud/trash)
  // --------------------------------------------------------------------------
  async getTrashFiles(): Promise<FileItem[]> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/trash?userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/trash?userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/trash?userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/trash?userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/trash?empty=true&userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] emptyTrash error:', e);
      return false;
    }
  },

  async purgeOrphanedFiles(): Promise<{ success: boolean; deletedCount?: number }> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/trash/purge-orphans?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        return { success: true, deletedCount: json.deletedCount || 0 };
      }
      return { success: false };
    } catch (e) {
      console.error('[CloudStorageAPI] purgeOrphanedFiles error:', e);
      return { success: false };
    }
  },

  // --------------------------------------------------------------------------
  // 10. UPLOAD DIRECT R2 ET D1 PAR CATÉGORIE (Validation & Routage Intelligent)
  // --------------------------------------------------------------------------
  async saveMediaThumbnail(fileId: string, category: string, dataUrl: string, fileName?: string): Promise<{ success: boolean; thumbnailUrl?: string }> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/thumbnail?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fileId, category, dataUrl, fileName }),
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        return { success: true, thumbnailUrl: json.thumbnailUrl };
      }
      return { success: false };
    } catch (e) {
      console.warn('[CloudStorageAPI] saveMediaThumbnail error:', e);
      return { success: false };
    }
  },

  getThumbnailUrl(fileId: string): string {
    const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
    return `${baseUrl}/api/cloud/thumbnail/${encodeURIComponent(fileId)}?userId=${getUserIdParam()}`;
  },

  getFileUrl(fileId: string): string {
    const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
    return `${baseUrl}/api/cloud/stream/${encodeURIComponent(fileId)}?userId=${getUserIdParam()}`;
  },

  getImageCandidateUrls(img: any): string[] {
    if (!img) return [];
    const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
    const urls: string[] = [];

    // Priorité 1 : Streaming universel Cloudflare Worker par ID de fichier (résolution directe D1 + R2)
    if (img.id) {
      urls.push(`${baseUrl}/api/cloud/stream/${encodeURIComponent(img.id)}`);
    }

    // Priorité 2 : Accès direct R2 par clé
    const key = img.r2Key || img.r2_key;
    if (key) {
      urls.push(`${baseUrl}/api/cloud/file/images/${encodeURIComponent(key)}`);
      if (key.includes('/')) {
        urls.push(`${baseUrl}/api/cloud/file/images/${key}`);
      }
    }

    // Priorité 3 : URL propre enregistrée (non localhost)
    const raw = img.url || img.previewUrl || img.imageUrl || (img.thumbnailUrl && !img.thumbnailUrl.includes('/api/cloud/thumbnail/') ? img.thumbnailUrl : '');
    if (raw && !raw.startsWith('blob:') && !raw.startsWith('data:image')) {
      if (raw.includes('localhost') && !baseUrl.includes('localhost')) {
        const parts = raw.split('/api/cloud/');
        if (parts.length > 1) {
          const rebased = `${baseUrl}/api/cloud/${parts[1]}`;
          if (!urls.includes(rebased)) urls.push(rebased);
        }
      } else if (!urls.includes(raw)) {
        urls.push(raw);
      }
    }

    return urls;
  },

  getImageDirectUrl(img: any): string {
    const candidates = this.getImageCandidateUrls(img);
    return candidates[0] || '';
  },

  async uploadFile(
    file: File | Blob,
    category: 'auto' | 'classeur' | 'audio' | 'images' | 'videos' | 'documents' | 'mes-fichiers',
    fileName: string,
    folderId?: string,
    thumbnailDataUrl?: string,
    uploadSource?: string,
    originalSizeBytes?: number,
    originalSizeFormatted?: string,
    fileId?: string,
    onProgress?: (percent: number) => void
  ): Promise<{ 
    success: boolean; 
    category?: string; 
    detectedCategory?: string; 
    file?: FileItem; 
    error?: string; 
    message?: string; 
    isStorageLimitExceeded?: boolean; 
    status?: number; 
  }> {
    return new Promise((resolve) => {
      try {
        const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
        const sourceQuery = uploadSource ? `&source=${encodeURIComponent(uploadSource)}` : '';
        const origSizeParam = originalSizeBytes ? `&originalSizeBytes=${encodeURIComponent(String(originalSizeBytes))}` : '';
        const idParam = fileId ? `&id=${encodeURIComponent(fileId)}` : '';
        const uploadUrl = `${baseUrl}/api/cloud/upload?category=${encodeURIComponent(category)}&name=${encodeURIComponent(fileName)}&folderId=${encodeURIComponent(folderId || '')}&userId=${getUserIdParam()}${sourceQuery}${origSizeParam}${idParam}`;

        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl, true);
        xhr.timeout = 240000; // 4 minutes

        const token = localStorage.getItem('sc_auth_token') || '';
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.setRequestHeader('x-user-id', getCurrentUserId() || 'default-user');
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        if (fileId) xhr.setRequestHeader('x-file-id', fileId);
        if (uploadSource) xhr.setRequestHeader('x-upload-source', uploadSource);
        if (thumbnailDataUrl && thumbnailDataUrl.startsWith('data:image') && thumbnailDataUrl.length < 8000) {
          xhr.setRequestHeader('x-thumbnail-data', thumbnailDataUrl);
        }
        if (originalSizeBytes) xhr.setRequestHeader('x-original-size-bytes', String(originalSizeBytes));
        if (originalSizeFormatted) xhr.setRequestHeader('x-original-size', originalSizeFormatted);

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && e.total > 0) {
              const pct = Math.round((e.loaded / e.total) * 100);
              onProgress(pct);
            }
          };
        }

        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && json.success) {
              resolve(json);
            } else {
              const isStorageLimit = json.error === 'STORAGE_LIMIT_EXCEEDED' || xhr.status === 413 || (typeof json.message === 'string' && json.message.toLowerCase().includes('stockage est insuffisant'));
              resolve({
                success: false,
                error: json.error || `Erreur serveur (${xhr.status})`,
                message: json.message || (isStorageLimit ? "Votre espace de stockage est insuffisant pour enregistrer ce fichier." : undefined),
                isStorageLimitExceeded: isStorageLimit,
                status: xhr.status
              });
            }
          } catch {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({ success: true });
            } else {
              const isStorageLimit = xhr.status === 413;
              resolve({
                success: false,
                error: `Erreur serveur HTTP ${xhr.status}`,
                message: isStorageLimit ? "Votre espace de stockage est insuffisant pour enregistrer ce fichier." : undefined,
                isStorageLimitExceeded: isStorageLimit,
                status: xhr.status
              });
            }
          }
        };

        xhr.onerror = () => {
          resolve({ success: false, error: 'Connexion réseau perdue ou interrompue' });
        };

        xhr.ontimeout = () => {
          resolve({ success: false, error: 'Délai d\'envoi dépassé (connexion trop lente)' });
        };

        xhr.send(file);
      } catch (e: any) {
        console.error('[CloudStorageAPI] uploadFile error:', e);
        resolve({ success: false, error: e.message || 'Erreur réseau lors du téléversement' });
      }
    });
  },

  async uploadFileToCategoryR2(
    file: File | Blob,
    category: 'classeur' | 'audio' | 'images' | 'videos' | 'documents' | 'downloads' | 'secure' | 'mes-fichiers',
    fileName: string,
    folderId?: string,
    uploadSource?: string,
    originalSizeBytes?: number,
    originalSizeFormatted?: string,
    onProgress?: (percent: number) => void
  ): Promise<{ success: boolean; id?: string; key?: string; url?: string; error?: string }> {
    const res = await this.uploadFile(file, category as any, fileName, folderId, undefined, uploadSource, originalSizeBytes, originalSizeFormatted, undefined, onProgress);
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

  async getStorageUsage(userId?: string): Promise<any> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const uid = userId ? encodeURIComponent(userId) : getUserIdParam();
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/storage-usage?userId=${uid}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('[CloudStorageAPI] getStorageUsage error:', e);
      return null;
    }
  },

  async getAllUsersStorage(params?: { search?: string; page?: number; limit?: number }): Promise<any> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.set('search', params.search);
      if (params?.page) queryParams.set('page', String(params.page));
      if (params?.limit) queryParams.set('limit', String(params.limit));
      const qs = queryParams.toString();
      const url = `${baseUrl}/api/cloud/all-users-storage${qs ? `?${qs}` : ''}`;
      const res = await fetchWithTimeout(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('[CloudStorageAPI] getAllUsersStorage error:', e);
      return null;
    }
  },

  // --------------------------------------------------------------------------
  // 10. FAVORIS (/api/cloud/favorites)
  // --------------------------------------------------------------------------
  async getFavorites(): Promise<{ itemId: string; item_id: string; id: string; category: string }[]> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/favorites?userId=${getUserIdParam()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []).map((row: any) => {
        const idVal = row.item_id || row.itemId || row.id;
        return {
          itemId: idVal,
          item_id: idVal,
          id: idVal,
          category: row.category || 'documents'
        };
      });
    } catch (e) {
      console.error('[CloudStorageAPI] getFavorites error:', e);
      return [];
    }
  },

  async getFavoritesList(): Promise<{ favIds: string[]; items: FileItem[] }> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/favorites?userId=${getUserIdParam()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return { favIds: [], items: [] };
      const json = await res.json();
      const favIds: string[] = (json.favIds || (json.data || []).map((r: any) => r.item_id || r.itemId || r.id)).filter(Boolean);
      const items: FileItem[] = Array.isArray(json.items) ? json.items : [];
      return { favIds, items };
    } catch (e) {
      console.error('[CloudStorageAPI] getFavoritesList error:', e);
      return { favIds: [], items: [] };
    }
  },

  async addFavorite(itemId: string, category: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/favorites?userId=${getUserIdParam()}`, {
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/favorites?itemId=${encodeURIComponent(itemId)}&userId=${getUserIdParam()}`, {
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
  async getPinned(): Promise<{ itemId: string; item_id: string; id: string; category: string }[]> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/pinned?userId=${getUserIdParam()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []).map((row: any) => {
        const idVal = row.item_id || row.itemId || row.id;
        return {
          itemId: idVal,
          item_id: idVal,
          id: idVal,
          category: row.category || 'documents'
        };
      });
    } catch (e) {
      console.error('[CloudStorageAPI] getPinned error:', e);
      return [];
    }
  },

  async addPinned(itemId: string, category: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/pinned?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ itemId, category }),
      });
      if (res.ok) {
        invalidateCloudQueries.pinned().catch(() => {});
        invalidateCloudQueries.all().catch(() => {});
      }
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] addPinned error:', e);
      return false;
    }
  },

  async removePinned(itemId: string): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/pinned?itemId=${encodeURIComponent(itemId)}&userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        invalidateCloudQueries.pinned().catch(() => {});
        invalidateCloudQueries.all().catch(() => {});
      }
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/rename?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, name, category, folderId }),
      });
      if (res.ok) {
        invalidateCloudQueries.all().catch(() => {});
        invalidateCloudQueries.overview().catch(() => {});
      }
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] renameItem error:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // 13. DUPLIQUER (/api/cloud/duplicate)
  // --------------------------------------------------------------------------
  async duplicateItem(id: string, category: string, folderId?: string, name?: string, newId?: string): Promise<any> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/duplicate?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, category, folderId, name, newId }),
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
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/move?userId=${getUserIdParam()}`, {
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

  // --------------------------------------------------------------------------
  // 15. MÉTHODES UTILITAIRES UNIFIÉES (Favoris, Épingles, Corbeille)
  // --------------------------------------------------------------------------
  async toggleFavorite(itemId: string, isFav: boolean, category: string = 'documents'): Promise<boolean> {
    if (isFav) {
      return this.addFavorite(itemId, category);
    } else {
      return this.removeFavorite(itemId);
    }
  },

  async togglePin(itemId: string, isPinned: boolean, category: string = 'documents'): Promise<boolean> {
    if (isPinned) {
      return this.addPinned(itemId, category);
    } else {
      return this.removePinned(itemId);
    }
  },

  async moveToTrash(itemId: string, category: string = 'documents', folderId?: string, name?: string): Promise<boolean> {
    try {
      if (category === 'classeur' || folderId) {
        return await this.deleteClasseurFile(itemId, name);
      } else if (category === 'images') {
        return await this.deleteImage(itemId, name);
      } else if (category === 'videos') {
        return await this.deleteVideo(itemId, name);
      } else if (category === 'audio') {
        return await this.deleteAudio(itemId, name);
      } else if (category === 'downloads') {
        return await this.deleteDownload(itemId, name);
      } else {
        return await this.deleteDocument(itemId, name);
      }
    } catch (e) {
      console.error('[CloudStorageAPI] moveToTrash error:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // Fond d'écran universel dédié (Table D1 user_wallpapers & Dossier R2)
  // --------------------------------------------------------------------------
  async getWallpaper(): Promise<UserWallpaper | null> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/wallpaper?userId=${getUserIdParam()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data && data.success && data.wallpaper) ? data.wallpaper : null;
    } catch (e) {
      console.warn('[CloudStorageAPI] getWallpaper error:', e);
      return null;
    }
  },

  async saveWallpaper(urlOrDataUrl: string, name?: string): Promise<{ success: boolean; wallpaper?: UserWallpaper }> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/wallpaper?userId=${getUserIdParam()}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          url: urlOrDataUrl,
          name: name || 'Fond d\'écran personnalisé',
        }),
      });
      if (!res.ok) return { success: false };
      const data = await res.json();
      return {
        success: Boolean(data?.success),
        wallpaper: data?.wallpaper,
      };
    } catch (e) {
      console.error('[CloudStorageAPI] saveWallpaper error:', e);
      return { success: false };
    }
  },

  async deleteWallpaper(): Promise<boolean> {
    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/cloud/wallpaper?userId=${getUserIdParam()}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error('[CloudStorageAPI] deleteWallpaper error:', e);
      return false;
    }
  },
};

