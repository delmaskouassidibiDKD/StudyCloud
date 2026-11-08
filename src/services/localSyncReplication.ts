/**
 * StudyCloud - Direct Server Sync Service (Zéro accumulation locale)
 *
 * Toutes les actions (favoris, corbeille, dossier sécurisé, suppression, restauration)
 * communiquent directement avec Cloudflare D1 / R2 via CloudStorageAPI et TanStack Query.
 * Aucune file d'attente locale, aucun tombstone persistant ni boucle de réplication en arrière-plan
 * ne sont stockés sur le téléphone afin d'éliminer définitivement les plantages mémoire ("Aïe aïe aïe").
 */

import { invalidateCloudQueries } from './queryClient';

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

let _currentStatus: ReplicationStatus = {
  isReplicating: false,
  lastReplicatedAt: Date.now(),
  pendingPushCount: 0,
  lastError: null,
};

const statusListeners = new Set<(status: ReplicationStatus) => void>();
const eventListeners = new Set<(event: { type: 'pull' | 'push'; count: number }) => void>();

const replicationStatus$ = {
  getValue: () => _currentStatus,
  next: (newStatus: ReplicationStatus) => {
    _currentStatus = newStatus;
    statusListeners.forEach(fn => {
      try {
        fn(newStatus);
      } catch {}
    });
  },
  asObservable: () => ({
    subscribe: (fn: (status: ReplicationStatus) => void) => {
      statusListeners.add(fn);
      fn(_currentStatus);
      return { unsubscribe: () => statusListeners.delete(fn) };
    },
  }),
};

const onSyncEvents$ = {
  next: (event: { type: 'pull' | 'push'; count: number }) => {
    eventListeners.forEach(fn => {
      try {
        fn(event);
      } catch {}
    });
  },
  asObservable: () => ({
    subscribe: (fn: (event: { type: 'pull' | 'push'; count: number }) => void) => {
      eventListeners.add(fn);
      return { unsubscribe: () => eventListeners.delete(fn) };
    },
  }),
};

const emptyTombstones = new Set<string>();
let isStarted = false;

export const LocalSyncReplication = {
  status$: replicationStatus$.asObservable(),
  events$: onSyncEvents$.asObservable(),

  getStatus(): ReplicationStatus {
    return replicationStatus$.getValue();
  },

  isTombstone(_id: string): boolean {
    return false;
  },

  getAllTombstones(): Set<string> {
    return emptyTombstones;
  },

  removeTombstone(_id: string) {
    // No-op : aucun tombstone local
  },

  recordLocalDeletion(_id: string, _category: string = 'documents') {
    // No-op : les suppressions passent directement par le serveur D1
  },

  recordLocalDeletions(_ids: string[], _category: string = 'documents') {
    // No-op : les suppressions passent directement par le serveur D1
  },

  recordLocalUpsert(_id: string, _category: string, _content: any) {
    // No-op : les créations/modifications passent directement par le serveur D1
  },

  async replicate(): Promise<boolean> {
    return true;
  },

  startAutoReplication(): () => void {
    if (isStarted) return () => {};
    isStarted = true;

    const onOnline = () => {
      invalidateCloudQueries.all().catch(() => {});
    };
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('online', onOnline);
      isStarted = false;
    };
  },

  resetCheckpoint() {
    // No-op
  },
};
