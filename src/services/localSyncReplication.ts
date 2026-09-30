/**
 * StudyCloud - Local-First Sync & Replication Service (Architecture RxDB / Cloudflare D1)
 *
 * Principes clés :
 * 1. Local-First : L'application lit et écrit instantanément dans CloudDataStore (RAM + IndexedDB).
 * 2. Suivi temporel & Tombstones :
 *    - Chaque suppression génère un "tombstone" (is_deleted: true, updated_at).
 *    - Le serveur D1 conserve l'état dans sync_items(id, user_id, category, content, updated_at, is_deleted).
 * 3. Réplication en arrière-plan :
 *    - PUSH : Envoie les mutations et suppressions locales vers /api/cloud/replication.
 *    - PULL : Récupère les modifications distantes depuis le checkpoint (updated_at > lastPulledAt).
 * 4. Élimination des fantômes inter-appareils :
 *    - Dès qu'un appareil B reçoit is_deleted: true, l'élément est définitivement purgé du cache
 *      et enregistré dans la liste locale des tombstones afin d'empêcher toute résurrection.
 */

import { BehaviorSubject, Subject } from 'rxjs';
import { getWorkerApiUrl } from './api';
import { getCurrentUserId } from './userSync';
import { CloudDataStore, FileItem, setTombstoneChecker, setTombstoneRemover, unmarkItemDeleted } from './cloudDataStore';
import { ClasseurCreatedFolder } from '../components/Folder3DModels';
import { removeDownloadedFile } from './downloadsManager';
import { deleteFileBlob } from './localFileStorage';
import { setCachedMediaThumbnail } from './mediaPreviewService';

export interface SyncDocument {
  id: string;
  category: string;
  content?: any;
  updated_at: number;
  is_deleted: boolean;
}

export interface ReplicationCheckpoint {
  updated_at: number;
}

export interface ReplicationStatus {
  isReplicating: boolean;
  lastReplicatedAt: number;
  pendingPushCount: number;
  lastError: string | null;
}

// Clés de stockage
const CHECKPOINT_KEY_PREFIX = 'studycloud_sync_cp_';
const OUTGOING_KEY_PREFIX   = 'studycloud_sync_out_';
const TOMBSTONES_KEY_PREFIX = 'studycloud_sync_tombstones_';

function getUserId(): string {
  return getCurrentUserId() || localStorage.getItem('unifolder_user_id') || 'default-user';
}

function getCheckpointKey(): string {
  return `${CHECKPOINT_KEY_PREFIX}${getUserId()}`;
}

function getOutgoingKey(): string {
  return `${OUTGOING_KEY_PREFIX}${getUserId()}`;
}

function getTombstonesKey(): string {
  return `${TOMBSTONES_KEY_PREFIX}${getUserId()}`;
}

// Cache mémoire des tombstones pour des vérifications instantanées O(1)
const inMemoryTombstones = new Set<string>();

function loadTombstones(): Set<string> {
  try {
    const raw = localStorage.getItem(getTombstonesKey());
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach(id => inMemoryTombstones.add(id));
      }
    }
  } catch {}
  return inMemoryTombstones;
}

function saveTombstones() {
  try {
    const arr = Array.from(inMemoryTombstones).slice(-2000);
    localStorage.setItem(getTombstonesKey(), JSON.stringify(arr));
  } catch {}
}

function getCheckpoint(): number {
  try {
    const val = localStorage.getItem(getCheckpointKey());
    return val ? Number(val) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveCheckpoint(ts: number) {
  try {
    localStorage.setItem(getCheckpointKey(), String(ts));
  } catch {}
}

function getOutgoingQueue(): SyncDocument[] {
  try {
    const raw = localStorage.getItem(getOutgoingKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  return [];
}

function saveOutgoingQueue(queue: SyncDocument[]) {
  try {
    localStorage.setItem(getOutgoingKey(), JSON.stringify(queue.slice(-500)));
  } catch {}
}

function getAuthHeaders(): Record<string, string> {
  const userId = getUserId();
  const token = localStorage.getItem('sc_auth_token') || localStorage.getItem('unifolder_auth_token') || localStorage.getItem('auth_token') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': userId,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// État observable avec RxJS
const replicationStatus$ = new BehaviorSubject<ReplicationStatus>({
  isReplicating: false,
  lastReplicatedAt: 0,
  pendingPushCount: 0,
  lastError: null,
});

const onSyncEvents$ = new Subject<{ type: 'pull' | 'push'; count: number }>();

// Initialiser les tombstones
loadTombstones();

let isReplicating = false;
let replicationInterval: any = null;
let isStarted = false;

export const LocalSyncReplication = {
  status$: replicationStatus$.asObservable(),
  events$: onSyncEvents$.asObservable(),

  getStatus(): ReplicationStatus {
    return replicationStatus$.getValue();
  },

  isTombstone(id: string): boolean {
    if (!id) return false;
    return inMemoryTombstones.has(id);
  },

  getAllTombstones(): Set<string> {
    return inMemoryTombstones;
  },

  removeTombstone(id: string) {
    if (!id) return;
    inMemoryTombstones.delete(id);
    saveTombstones();
    const queue = getOutgoingQueue().filter(item => item.id !== id);
    saveOutgoingQueue(queue);
  },

  /**
   * Enregistrer immédiatement une suppression locale (Tombstone).
   * L'élément est retiré immédiatement du cache et mis en file d'attente pour push instantané.
   */
  recordLocalDeletion(id: string, category: string = 'documents') {
    if (!id) return;
    inMemoryTombstones.add(id);
    saveTombstones();

    const queue = getOutgoingQueue();
    // Retirer tout doublon de cet ID
    const nextQueue = queue.filter(item => item.id !== id);
    nextQueue.push({
      id,
      category,
      updated_at: Date.now(),
      is_deleted: true,
    });
    saveOutgoingQueue(nextQueue);

    replicationStatus$.next({
      ...replicationStatus$.getValue(),
      pendingPushCount: nextQueue.length,
    });

    // Déclencher la réplication immédiatement
    this.replicate().catch(() => {});
  },

  recordLocalDeletions(ids: string[], category: string = 'documents') {
    if (!ids || ids.length === 0) return;
    const now = Date.now();
    ids.forEach(id => inMemoryTombstones.add(id));
    saveTombstones();

    const idSet = new Set(ids);
    const queue = getOutgoingQueue().filter(item => !idSet.has(item.id));
    ids.forEach(id => {
      queue.push({
        id,
        category,
        updated_at: now,
        is_deleted: true,
      });
    });
    saveOutgoingQueue(queue);

    replicationStatus$.next({
      ...replicationStatus$.getValue(),
      pendingPushCount: queue.length,
    });

    this.replicate().catch(() => {});
  },

  /**
   * Enregistrer une création ou modification locale pour réplication
   */
  recordLocalUpsert(id: string, category: string, content: any) {
    if (!id) return;
    // Si l'élément avait été supprimé précédemment, retirer le tombstone
    inMemoryTombstones.delete(id);
    saveTombstones();

    const queue = getOutgoingQueue().filter(item => item.id !== id);
    queue.push({
      id,
      category,
      content,
      updated_at: Date.now(),
      is_deleted: false,
    });
    saveOutgoingQueue(queue);

    replicationStatus$.next({
      ...replicationStatus$.getValue(),
      pendingPushCount: queue.length,
    });

    this.replicate().catch(() => {});
  },

  /**
   * Cycle de réplication complet :
   * 1. PUSH des mutations et tombstones vers Cloudflare D1
   * 2. PULL des nouveaux changements depuis le dernier checkpoint
   * 3. Application des suppressions et des mises à jour dans CloudDataStore
   */
  async replicate(): Promise<boolean> {
    if (isReplicating) return false;
    isReplicating = true;

    replicationStatus$.next({
      ...replicationStatus$.getValue(),
      isReplicating: true,
      lastError: null,
    });

    try {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const userId = getUserId();
      const currentCheckpoint = getCheckpoint();
      const outgoingDocs = getOutgoingQueue();

      const payload = {
        checkpoint: { updated_at: currentCheckpoint },
        documents: outgoingDocs,
      };

      const response = await fetch(`${baseUrl}/api/cloud/replication?userId=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Replication HTTP error: ${response.status}`);
      }

      const resJson = await response.json();
      if (!resJson.success) {
        throw new Error(resJson.error || 'Erreur lors de la réplication');
      }

      // Si le push a réussi, vider les documents envoyés
      if (outgoingDocs.length > 0) {
        const remaining = getOutgoingQueue();
        const sentIdSet = new Set(outgoingDocs.map(d => d.id));
        const updatedQueue = remaining.filter(d => !sentIdSet.has(d.id));
        saveOutgoingQueue(updatedQueue);
        onSyncEvents$.next({ type: 'push', count: outgoingDocs.length });
      }

      const incomingDocs: SyncDocument[] = Array.isArray(resJson.documents) ? resJson.documents : [];
      let deletedCount = 0;
      let upsertCount = 0;

      for (const doc of incomingDocs) {
        if (!doc || !doc.id) continue;

        let parsedContent: any = doc.content;
        if (typeof doc.content === 'string') {
          try {
            parsedContent = JSON.parse(doc.content);
          } catch {
            parsedContent = { id: doc.id };
          }
        }

        if (doc.is_deleted) {
          // ── GESTION DES FAVORIS ET ÉPINGLÉS (DÉCOCHÉS) ──
          if (doc.category === 'favorites') {
            const favItemId = parsedContent?.itemId || doc.content?.itemId || doc.id.replace(/^fav_[^_]+_/, '');
            if (favItemId) {
              CloudDataStore.toggleFavorite(favItemId, false);
            }
            deletedCount++;
            continue;
          }
          if (doc.category === 'pinned') {
            const pinItemId = parsedContent?.itemId || doc.content?.itemId || doc.id.replace(/^pin_[^_]+_/, '');
            if (pinItemId) {
              CloudDataStore.togglePin(pinItemId, false);
            }
            deletedCount++;
            continue;
          }

          // ── SUPPRESSION MULTI-APPAREILS SANS RÉSUSCITATION ──
          if (doc.category === 'trash') {
            // Suppression définitive de la corbeille
            inMemoryTombstones.add(doc.id);
            saveTombstones();
            CloudDataStore.permanentlyRemoveTrashFile(doc.id);
            removeDownloadedFile(doc.id);
            deleteFileBlob(doc.id).catch(() => {});
            deletedCount++;
          } else {
            // Déplacement vers la corbeille ou retrait de la catégorie source
            // Ne pas écraser la corbeille locale !
            CloudDataStore.removeFileFromCategory(doc.id, doc.category);
            if (doc.category === 'classeur_folder') {
              CloudDataStore.removeFolder(doc.id);
            }
            deletedCount++;
          }
        } else {
          // ── FAVORIS ET ÉPINGLÉS MIS À JOUR PAR UN AUTRE APPAREIL ──
          if (doc.category === 'favorites') {
            const favItemId = parsedContent?.itemId || doc.content?.itemId || doc.id.replace(/^fav_[^_]+_/, '');
            if (favItemId) {
              CloudDataStore.toggleFavorite(favItemId, true);
            }
            upsertCount++;
            continue;
          }
          if (doc.category === 'pinned') {
            const pinItemId = parsedContent?.itemId || doc.content?.itemId || doc.id.replace(/^pin_[^_]+_/, '');
            if (pinItemId) {
              CloudDataStore.togglePin(pinItemId, true);
            }
            upsertCount++;
            continue;
          }

          // ── ÉLÉMENT CRÉÉ OU MIS À JOUR PAR UN AUTRE APPAREIL ──
          if (doc.category === 'trash') {
            // Les éléments de la corbeille sont valides et ne doivent pas être bloqués par un tombstone d'une autre catégorie
            inMemoryTombstones.delete(doc.id);
          } else {
            // Si le serveur nous renvoie un élément actif (is_deleted: false),
            // il s'agit d'un élément créé, modifié ou RESTAURÉ depuis la corbeille !
            if (inMemoryTombstones.has(doc.id)) {
              inMemoryTombstones.delete(doc.id);
              saveTombstones();
              unmarkItemDeleted(doc.id);
            }
            // S'assurer de le retirer de la corbeille locale s'il y résidait
            CloudDataStore.permanentlyRemoveTrashFile(doc.id);
          }

          if (doc.category === 'deleted_recent') {
            const targetId = parsedContent?.fileId || doc.id.replace(/^deleted_recent_/, '');
            try {
              const raw = localStorage.getItem('studycloud_deleted_recent_ids');
              const set = new Set(raw ? JSON.parse(raw) : []);
              if (targetId) set.add(targetId);
              localStorage.setItem('studycloud_deleted_recent_ids', JSON.stringify(Array.from(set).slice(-500)));
            } catch {}
            CloudDataStore.setRecentFiles(CloudDataStore.getState().recentFiles.filter(f => f.id !== targetId));
            continue;
          }

          if (parsedContent && typeof parsedContent === 'object') {
            const cat = doc.category || parsedContent.category || 'documents';
            const fileItem: FileItem = {
              ...parsedContent,
              id: doc.id,
              category: cat as any,
              date: parsedContent.date || parsedContent.date_formatted || new Date(doc.updated_at).toLocaleDateString('fr-FR'),
              size: parsedContent.size || '0 o',
            };

            // Mise en cache de l'aperçu / vignette si disponible
            const thumbUrl = (fileItem.previewUrl && !fileItem.previewUrl.startsWith('blob:')) 
              ? fileItem.previewUrl 
              : (fileItem.thumbnailUrl && !fileItem.thumbnailUrl.startsWith('blob:')) 
                ? fileItem.thumbnailUrl 
                : null;
            if (thumbUrl) {
              setCachedMediaThumbnail(doc.id, thumbUrl);
            }

            // Insérer ou mettre à jour dans la bonne catégorie
            const state = CloudDataStore.getState();
            if (cat === 'images') {
              const exists = state.images.some(x => x.id === doc.id);
              if (!exists) {
                CloudDataStore.setImages([fileItem, ...state.images]);
              } else {
                CloudDataStore.setImages(state.images.map(x => x.id === doc.id ? { ...x, ...fileItem } : x));
              }
            } else if (cat === 'videos') {
              const exists = state.videos.some(x => x.id === doc.id);
              if (!exists) {
                CloudDataStore.setVideos([fileItem, ...state.videos]);
              } else {
                CloudDataStore.setVideos(state.videos.map(x => x.id === doc.id ? { ...x, ...fileItem } : x));
              }
            } else if (cat === 'audio') {
              const exists = state.audio.some(x => x.id === doc.id);
              if (!exists) {
                CloudDataStore.setAudio([fileItem, ...state.audio]);
              } else {
                CloudDataStore.setAudio(state.audio.map(x => x.id === doc.id ? { ...x, ...fileItem } : x));
              }
            } else if (cat === 'downloads') {
              const exists = state.downloads.some(x => x.id === doc.id);
              if (!exists) {
                CloudDataStore.setDownloads([fileItem as any, ...state.downloads]);
              } else {
                CloudDataStore.setDownloads(state.downloads.map(x => x.id === doc.id ? { ...x, ...fileItem } : x) as any);
              }
            } else if (cat === 'documents') {
              const exists = state.documents.some(x => x.id === doc.id);
              if (!exists) {
                CloudDataStore.setDocuments([fileItem, ...state.documents]);
              } else {
                CloudDataStore.setDocuments(state.documents.map(x => x.id === doc.id ? { ...x, ...fileItem } : x));
              }
            } else if (cat === 'trash') {
              const exists = state.trash.some(x => x.id === doc.id);
              if (!exists) {
                CloudDataStore.setTrashFiles([fileItem, ...state.trash]);
              } else {
                CloudDataStore.setTrashFiles(state.trash.map(x => x.id === doc.id ? { ...x, ...fileItem } : x));
              }
            } else if (cat === 'classeur_folder') {
              const folder: ClasseurCreatedFolder = {
                id: doc.id,
                name: parsedContent.name || 'Dossier',
                model: (Number(parsedContent.model || parsedContent.modelId || parsedContent.model_id || 1) as 1 | 2 | 3 | 4),
                modelId: parsedContent.modelId || parsedContent.model_id || parsedContent.model || '1',
                primaryColor: parsedContent.primaryColor || parsedContent.primary_color || '#EA580C',
                accentColor: parsedContent.accentColor || parsedContent.accent_color || '#F97316',
                secondaryColor: parsedContent.secondaryColor || parsedContent.secondary_color,
                badge: parsedContent.badge,
                iconType: parsedContent.iconType || parsedContent.icon_type,
                iconName: parsedContent.iconName || parsedContent.icon_name || 'Folder',
                textDark: Boolean(parsedContent.textDark ?? parsedContent.text_dark),
                dateText: parsedContent.dateText || parsedContent.date_text || (parsedContent.createdAt ? new Date(parsedContent.createdAt).toLocaleDateString('fr-FR') : new Date(doc.updated_at).toLocaleDateString('fr-FR')),
                createdAt: Number(parsedContent.createdAt || doc.updated_at || Date.now()),
                parentId: parsedContent.parentId || parsedContent.parent_id || undefined,
                positionX: Number(parsedContent.positionX ?? parsedContent.position_x ?? 0),
                positionY: Number(parsedContent.positionY ?? parsedContent.position_y ?? 0),
                displayOrder: Number(parsedContent.displayOrder ?? parsedContent.display_order ?? 0),
                zoomLevel: Number(parsedContent.zoomLevel ?? parsedContent.zoom_level ?? 10),
                isPinned: Boolean(parsedContent.isPinned ?? parsedContent.is_pinned),
                isFavorite: Boolean(parsedContent.isFavorite ?? parsedContent.is_favorite),
              };
              CloudDataStore.addClasseurFolder(folder);
            } else if (cat === 'classeur') {
              const folderId = parsedContent.folderId || parsedContent.folder_id || fileItem.folderId;
              if (folderId) {
                CloudDataStore.addOptimisticFile({ ...fileItem, folderId }, folderId);
              }
            }
            upsertCount++;
          }
        }
      }

      if (deletedCount > 0) {
        saveTombstones();
      }

      // Mettre à jour le checkpoint
      const newCheckpoint = Number(resJson.checkpoint?.updated_at || currentCheckpoint);
      if (newCheckpoint > currentCheckpoint) {
        saveCheckpoint(newCheckpoint);
      }

      if (incomingDocs.length > 0) {
        onSyncEvents$.next({ type: 'pull', count: incomingDocs.length });
      }

      replicationStatus$.next({
        isReplicating: false,
        lastReplicatedAt: Date.now(),
        pendingPushCount: getOutgoingQueue().length,
        lastError: null,
      });

      return true;
    } catch (err: any) {
      console.warn('[LocalSyncReplication] Replication error:', err.message || err);
      replicationStatus$.next({
        ...replicationStatus$.getValue(),
        isReplicating: false,
        lastError: err.message || 'Erreur réseau de réplication',
      });
      return false;
    } finally {
      isReplicating = false;
    }
  },

  /**
   * Démarrer le démon de réplication automatique
   */
  startAutoReplication(): () => void {
    if (isStarted) return () => {};
    isStarted = true;

    // 1. Première réplication immédiate
    this.replicate().catch(() => {});

    // 2. Réplication périodique toutes les 8 secondes
    replicationInterval = setInterval(() => {
      this.replicate().catch(() => {});
    }, 8000);

    // 3. Réplication dès que l'onglet redevient visible (changement d'appareil ou d'onglet)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        this.replicate().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 4. Réplication dès que la connexion internet revient
    const onOnline = () => {
      this.replicate().catch(() => {});
    };
    window.addEventListener('online', onOnline);

    return () => {
      if (replicationInterval) clearInterval(replicationInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      isStarted = false;
    };
  },

  /**
   * Réinitialiser le checkpoint (par exemple lors d'un changement de compte)
   */
  resetCheckpoint() {
    saveCheckpoint(0);
    inMemoryTombstones.clear();
    saveTombstones();
    saveOutgoingQueue([]);
  }
};

// Relier le vérificateur et le destructeur de tombstones à CloudDataStore
setTombstoneChecker((id: string) => LocalSyncReplication.isTombstone(id));
setTombstoneRemover((id: string) => LocalSyncReplication.removeTombstone(id));

// Écouter toutes les suppressions locales de CloudDataStore pour réplication immédiate
CloudDataStore.onDelete((id: string, category?: string) => {
  LocalSyncReplication.recordLocalDeletion(id, category);
});

