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
import { CloudDataStore, FileItem, setTombstoneChecker } from './cloudDataStore';
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

        if (doc.is_deleted) {
          // ── SUPPRESSION MULTI-APPAREILS SANS RÉSUSCITATION ──
          inMemoryTombstones.add(doc.id);
          CloudDataStore.removeFile(doc.id);
          removeDownloadedFile(doc.id);
          deleteFileBlob(doc.id).catch(() => {});
          deletedCount++;
        } else {
          // ── ÉLÉMENT CRÉÉ OU MIS À JOUR PAR UN AUTRE APPAREIL ──
          if (inMemoryTombstones.has(doc.id)) {
            // Si localement marqué supprimé plus récemment, ne pas ressusciter
            continue;
          }

          let parsedContent: any = doc.content;
          if (typeof doc.content === 'string') {
            try {
              parsedContent = JSON.parse(doc.content);
            } catch {
              parsedContent = { id: doc.id };
            }
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

// Relier le vérificateur de tombstones à CloudDataStore
setTombstoneChecker((id: string) => LocalSyncReplication.isTombstone(id));

// Écouter toutes les suppressions locales de CloudDataStore pour réplication immédiate
CloudDataStore.onDelete((id: string, category?: string) => {
  LocalSyncReplication.recordLocalDeletion(id, category);
});

