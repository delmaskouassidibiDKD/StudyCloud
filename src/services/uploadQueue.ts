/**
 * StudyCloud - UploadQueue (File d'attente d'importation côté client)
 *
 * Architecture type Google Drive :
 * 1. UI Optimiste : Sauvegarde immédiate dans IndexedDB (0ms) -> disponible instantanément.
 * 2. Concurrence maîtrisée : 2 téléversements simultanés max pour éviter la saturation réseau/navigateur.
 * 3. Auto-Retry : En cas de coupure réseau, retente automatiquement (jusqu'à 3 fois) avec délai progressif.
 * 4. État observable : Notifie l'UI (badge/widget flottant Google Drive) de la progression globale.
 */

import { CloudDataStore, FileItem } from './cloudDataStore';
import { CloudStorageAPI } from './cloudStorageService';
import { storeFileBlob } from './localFileStorage';
import { invalidateCloudQueries } from './queryClient';
import { StudyCloudAPI } from './api';
import { getCurrentUserId } from './userSync';
import {
  generatePdfThumbnail,
  generateVideoThumbnail,
  extractAudioCover,
  extractAudioMetadataWithTags,
  setCachedMediaThumbnail,
  getCachedMediaThumbnail,
  isRealEmbeddedArtwork,
} from './mediaPreviewService';


export interface UploadTask {
  id: string; // Identifiant unique du fichier (cf-...)
  file: File;
  fileName: string;
  category: FileItem['category'];
  folderId?: string;
  folderName?: string;
  uploadSource?: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number; // 0 - 100
  error?: string;
  retries: number;
  fileItem: FileItem;
  originalSizeBytes?: number;
  originalSizeFormatted?: string;
  addedAt: number;
  completedAt?: number;
}

export interface UploadQueueState {
  tasks: UploadTask[];
  activeCount: number;
  pendingCount: number;
  completedCount: number;
  errorCount: number;
  totalCount: number;
  isProcessing: boolean;
}

const MAX_CONCURRENT_UPLOADS = 2;
const MAX_RETRIES = 3;

class UploadQueueManager {
  private queue: UploadTask[] = [];
  private activeTasks = new Set<string>();
  private listeners = new Set<(state: UploadQueueState) => void>();
  private autoClearTimeout: any = null;

  public getState(): UploadQueueState {
    const activeCount = this.activeTasks.size;
    const pendingCount = this.queue.filter(t => t.status === 'pending').length;
    const completedCount = this.queue.filter(t => t.status === 'completed').length;
    const errorCount = this.queue.filter(t => t.status === 'error').length;
    return {
      tasks: [...this.queue],
      activeCount,
      pendingCount,
      completedCount,
      errorCount,
      totalCount: this.queue.length,
      isProcessing: activeCount > 0 || pendingCount > 0,
    };
  }

  public subscribe(listener: (state: UploadQueueState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(fn => {
      try {
        fn(state);
      } catch (err) {
        console.error('[UploadQueue] Listener error:', err);
      }
    });

    // Auto-masquer les fichiers terminés après 30 secondes pour laisser le temps de consulter les liens
    if (!state.isProcessing && state.completedCount > 0) {
      if (this.autoClearTimeout) clearTimeout(this.autoClearTimeout);
      this.autoClearTimeout = setTimeout(() => {
        this.clearCompleted();
      }, 30000);
    }
  }

  /**
   * Enfile une liste de fichiers pour téléversement en arrière-plan
   */
  public enqueue(
    files: File[],
    options: {
      category?: FileItem['category'];
      folderId?: string;
      folderName?: string;
      onOptimisticItem?: (item: FileItem) => void;
    } = {}
  ): FileItem[] {
    const now = Date.now();
    const newItems: FileItem[] = [];

    files.forEach((file, idx) => {
      const ext = file.name.includes('.')
        ? file.name.split('.').pop()?.toLowerCase() || ''
        : '';

      let cat: FileItem['category'] = options.category || 'documents';
      if (!options.category || options.category === 'documents') {
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(ext)) cat = 'images';
        else if (['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'wmv'].includes(ext)) cat = 'videos';
        else if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma', 'opus'].includes(ext)) cat = 'audio';
      }

      const k = 1024;
      const sizes = ['o', 'Ko', 'Mo', 'Go'];
      const i = file.size > 0 ? Math.floor(Math.log(file.size) / Math.log(k)) : 0;
      const sizeStr = file.size > 0 ? parseFloat((file.size / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i] : '0 o';
      const fileId = `cf-${options.folderId || cat}-${now}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
      const localBlobUrl = URL.createObjectURL(file);

      // 1. Stocker le binaire immédiatement dans IndexedDB (accès 0ms)
      storeFileBlob(fileId, file).catch(() => {});

      const item: FileItem = {
        id: fileId,
        name: file.name,
        category: cat,
        source: options.folderName || 'StudyCloud',
        size: sizeStr,
        sizeBytes: file.size,
        date: "Aujourd'hui",
        extension: ext.toUpperCase() || 'FICHIER',
        url: localBlobUrl,
        previewUrl: localBlobUrl,
        videoUrl: cat === 'videos' ? localBlobUrl : undefined,
        audioUrl: cat === 'audio' ? localBlobUrl : undefined,
        positionX: idx * 25,
        positionY: 0,
        displayOrder: idx,
        folderId: options.folderId,
        isUploading: true,
        uploadProgress: 10,
      };

      // 2. Ajouter immédiatement à CloudDataStore (UI optimiste)
      CloudDataStore.addOptimisticFile(item, options.folderId);
      if (options.onOptimisticItem) {
        options.onOptimisticItem(item);
      }

      newItems.push(item);

      // 3. Ajouter à la file d'attente
      const task: UploadTask = {
        id: fileId,
        file,
        fileName: file.name,
        category: cat,
        folderId: options.folderId,
        folderName: options.folderName,
        status: 'pending',
        progress: 10,
        retries: 0,
        fileItem: item,
        addedAt: now,
      };

      this.queue.push(task);
    });

    this.notify();
    this.processQueue();
    return newItems;
  }

  /**
   * Enfile des éléments déjà créés avec prévisualisation locale
   */
  public enqueueExisting(
    itemsWithFiles: { file: File | Blob; item: any; originalSizeBytes?: number; originalSizeFormatted?: string }[],
    options: {
      category?: FileItem['category'];
      folderId?: string;
      folderName?: string;
      uploadSource?: string;
    } = {}
  ): void {
    const now = Date.now();
    itemsWithFiles.forEach(({ file, item, originalSizeBytes, originalSizeFormatted }) => {
      const effectiveFolderId = options.folderId || item.folderId || (item as any).folder_id;
      const effectiveFolderName = options.folderName || item.folderName || item.source;
      const isFolderTarget = Boolean(effectiveFolderId && !['documents', 'images', 'videos', 'audio', 'default-folder', 'root'].includes(effectiveFolderId));
      const effectiveCategory = (isFolderTarget || options.category === 'classeur') ? 'classeur' : (options.category || item.category || 'documents');

      item.category = effectiveCategory;
      if (effectiveFolderId) {
        item.folderId = effectiveFolderId;
        item.originalFolderId = effectiveFolderId;
      }
      if (effectiveFolderName) {
        item.folderName = effectiveFolderName;
      }

      // 1. Sauvegarde binaire IndexedDB (accès 0ms)
      storeFileBlob(item.id, file as any).catch(() => {});
      // 2. Ajout optimiste immédiat dans CloudDataStore pour que tous les stores et vues le conservent
      CloudDataStore.addOptimisticFile(item, effectiveFolderId);

      const task: UploadTask = {
        id: item.id,
        file: file as any,
        fileName: item.name || (file as any).name || 'fichier',
        category: effectiveCategory as any,
        folderId: effectiveFolderId,
        folderName: effectiveFolderName,
        uploadSource: options.uploadSource || (item as any).uploadSource || `btn-${effectiveCategory || 'auto'}`,
        status: 'pending',
        progress: 10,
        retries: 0,
        fileItem: item,
        originalSizeBytes: originalSizeBytes || item.sizeBytes,
        originalSizeFormatted: originalSizeFormatted || item.size,
        addedAt: now,
      };
      this.queue.push(task);
    });
    this.notify();
    this.processQueue();
  }

  /**
   * Traitement séquentiel / contrôlé de la file
   */
  private async processQueue() {
    if (this.activeTasks.size >= MAX_CONCURRENT_UPLOADS) return;

    const nextTask = this.queue.find(t => t.status === 'pending');
    if (!nextTask) return;

    this.activeTasks.add(nextTask.id);
    nextTask.status = 'uploading';
    nextTask.progress = 25;
    this.notify();

    // Lancer la tâche de manière asynchrone
    this.executeTask(nextTask).finally(() => {
      this.activeTasks.delete(nextTask.id);
      this.notify();
      // Enchaîner sur la tâche suivante
      this.processQueue();
    });

    // Si on a encore du slot disponible pour une 2ème tâche simultanée
    if (this.activeTasks.size < MAX_CONCURRENT_UPLOADS) {
      this.processQueue();
    }
  }

  /**
   * Exécution d'un téléversement avec gestion des aperçus et retry
   */
  private async executeTask(task: UploadTask): Promise<void> {
    const { file, category, folderId, id, fileName } = task;
    const normName = fileName.toLowerCase();

    try {
      // Étape 0 : Vérification proactive du quota disponible avant transfert
      try {
        const cached = localStorage.getItem('studycloud_cached_user_storage');
        if (cached) {
          const parsed = JSON.parse(cached);
          const totalAllowedMb = Number(parsed?.totalAllowedMb || 100);
          const totalAllowedBytes = totalAllowedMb * 1024 * 1024;
          const totalUsedBytes = Number(parsed?.totalUsedBytes || 0);
          const remainingBytes = Math.max(0, totalAllowedBytes - totalUsedBytes);

          if (file.size > remainingBytes) {
            const formatSizeShort = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} Ko` : `${(b / (1024 * 1024)).toFixed(2)} Mo`;
            const err: any = new Error(`Espace de stockage insuffisant. Ce fichier (${formatSizeShort(file.size)}) dépasse votre quota disponible (${formatSizeShort(remainingBytes)} restants sur ${totalAllowedMb} Mo).`);
            err.isStorageLimitExceeded = true;
            err.storageMessage = err.message;
            throw err;
          }
        }
      } catch (checkErr: any) {
        if (checkErr?.isStorageLimitExceeded) throw checkErr;
      }

      // Étape A : Génération / Réutilisation de la miniature réelle
      let previewDataUrl: string | null = task.fileItem?.thumbnailUrl || task.fileItem?.previewUrl || task.fileItem?.coverUrl || null;
      const isAudio = category === 'audio' || normName.match(/\.(mp3|wav|ogg|m4a|aac|flac|wma|opus|m4b)$/i);

      if (isAudio) {
        // Pour les pistes audio, vérifier si on a déjà une vraie pochette d'artiste (JPEG/PNG)
        if (!isRealEmbeddedArtwork(previewDataUrl, task.fileItem)) {
          const cached = getCachedMediaThumbnail(id);
          if (isRealEmbeddedArtwork(cached, task.fileItem)) {
            previewDataUrl = cached;
          } else {
            const meta = await extractAudioMetadataWithTags(file).catch(() => ({} as any));
            if (meta.coverUrl && isRealEmbeddedArtwork(meta.coverUrl)) {
              previewDataUrl = meta.coverUrl;
              if (meta.artist && (!task.fileItem?.artist || task.fileItem.artist === 'Artiste inconnu' || task.fileItem.artist.includes('Enregistrement'))) {
                if (task.fileItem) task.fileItem.artist = meta.artist;
              }
            } else {
              previewDataUrl = await extractAudioCover(file, fileName, task.fileItem?.artist).catch(() => null);
            }
          }
        }
      } else {
        if (!previewDataUrl || !previewDataUrl.startsWith('data:image')) {
          previewDataUrl = null;
          if (category === 'videos' || normName.match(/\.(mp4|mov|webm|avi|mkv)$/i)) {
            previewDataUrl = getCachedMediaThumbnail(id) || await generateVideoThumbnail(file, id, fileName).catch(() => null);
          } else if (normName.endsWith('.pdf')) {
            previewDataUrl = getCachedMediaThumbnail(id) || await generatePdfThumbnail(file, id).catch(() => null);
          }
        }
      }

      if (category !== 'images' && previewDataUrl && previewDataUrl.startsWith('data:image')) {
        setCachedMediaThumbnail(id, previewDataUrl);
        CloudStorageAPI.saveMediaThumbnail(id, category, previewDataUrl, fileName).catch(() => {});
      }


      task.progress = 50;
      this.notify();

      // Étape B : Upload vers Cloudflare R2 + Enregistrement D1
      let uploadUrl = '';
      let r2Key = '';
      let serverFileId: string | undefined = undefined;

      const resolvedFolderId = folderId || task.folderId || (task.fileItem as any)?.folderId || (task.fileItem as any)?.folder_id;
      const isFolderUpload = Boolean(
        category === 'classeur' || 
        (resolvedFolderId && !['documents', 'images', 'videos', 'audio', 'default-folder', 'root'].includes(resolvedFolderId))
      );

      if (isFolderUpload && resolvedFolderId) {
        const uploadRes = await CloudStorageAPI.uploadFileToCategoryR2(
          file,
          'classeur',
          fileName,
          resolvedFolderId,
          task.uploadSource,
          task.originalSizeBytes,
          task.originalSizeFormatted,
          (pct) => {
            task.progress = Math.max(10, Math.min(99, pct));
            this.notify();
          },
          id
        );
        if (!uploadRes || uploadRes.success === false) {
          const err: any = new Error((uploadRes as any)?.message || (uploadRes as any)?.error || "Échec de l'envoi du classeur");
          err.isStorageLimitExceeded = (uploadRes as any)?.isStorageLimitExceeded || (uploadRes as any)?.error === 'STORAGE_LIMIT_EXCEEDED';
          err.storageMessage = (uploadRes as any)?.message;
          throw err;
        }
        uploadUrl = uploadRes.url;
        r2Key = uploadRes.key;
        serverFileId = uploadRes.id || id;

        const fileToSave = {
          ...task.fileItem,
          id: serverFileId || id,
          category: 'classeur',
          folderId: resolvedFolderId,
          originalFolderId: resolvedFolderId,
          folderName: task.folderName || task.fileItem?.source,
          url: uploadUrl,
          r2Key: r2Key,
          previewUrl: previewDataUrl || uploadUrl,
          isUploading: false,
        };
        await CloudStorageAPI.saveClasseurFile(fileToSave as any, resolvedFolderId);
      } else {
        const uploadCat = (category === 'classeur' || category === 'downloads' || category === 'secure' || category === 'trash' ? 'documents' : category) as any;
        const res = await CloudStorageAPI.uploadFile(
          file,
          uploadCat,
          fileName,
          folderId,
          previewDataUrl || undefined,
          task.uploadSource,
          task.originalSizeBytes,
          task.originalSizeFormatted,
          id,
          (pct) => {
            task.progress = Math.max(10, Math.min(99, pct));
            this.notify();
          }
        );

        if (!res || res.success === false) {
          const err: any = new Error(res?.message || res?.error || "Échec de l'envoi");
          err.isStorageLimitExceeded = (res as any)?.isStorageLimitExceeded || res?.error === 'STORAGE_LIMIT_EXCEEDED';
          err.storageMessage = (res as any)?.message;
          throw err;
        }

        if (res.file) {
          uploadUrl = res.file.url || '';
          r2Key = (res.file as any).r2Key || (res.file as any).key || (res as any).r2Key || (res as any).key || '';
          serverFileId = res.file.id;
        } else if ((res as any)?.url) {
          uploadUrl = (res as any).url;
          r2Key = (res as any).r2Key || (res as any).key || '';
          serverFileId = (res as any).id;
        }

        if (!r2Key && uploadUrl && !uploadUrl.startsWith('blob:') && !uploadUrl.startsWith('data:')) {
          const match = uploadUrl.match(/\/api\/cloud\/file\/[^/]+\/([^?#]+)/);
          if (match && match[1]) {
            try {
              r2Key = decodeURIComponent(match[1]);
            } catch {
              r2Key = match[1];
            }
          }
        }
      }

      // Étape C : Succès - mise à jour définitive du CloudDataStore et IndexedDB
      task.status = 'completed';
      task.progress = 100;
      task.completedAt = Date.now();

      if (serverFileId && serverFileId !== id) {
        storeFileBlob(serverFileId, file).catch(() => {});
      }

      CloudDataStore.updateFile(id, {
        id: serverFileId || id,
        url: uploadUrl || task.fileItem.url,
        r2Key: r2Key || task.fileItem.r2Key,
        previewUrl: category === 'images'
          ? (uploadUrl || task.fileItem.url)
          : (category === 'audio'
              ? (previewDataUrl || task.fileItem?.coverUrl || undefined)
              : (previewDataUrl || uploadUrl || task.fileItem.previewUrl)),
        thumbnailUrl: category === 'images'
          ? (uploadUrl || task.fileItem.url)
          : (previewDataUrl || task.fileItem?.thumbnailUrl || undefined),
        coverUrl: category === 'audio' ? (previewDataUrl || task.fileItem?.coverUrl) : undefined,
        artist: task.fileItem?.artist || (category === 'audio' ? 'Artiste inconnu' : undefined),
        videoUrl: category === 'videos' ? (uploadUrl || task.fileItem.videoUrl) : undefined,
        audioUrl: category === 'audio' ? (uploadUrl || task.fileItem.audioUrl) : undefined,
        isUploading: false,
        uploadProgress: 100,
      }, folderId);

      // Si audio, sauvegarder également la métadonnée complète (artiste, album, pochette réelle, etc.) dans D1
      if (category === 'audio') {
        const audioToSave = {
          ...task.fileItem,
          id: serverFileId || id,
          url: uploadUrl || task.fileItem?.url,
          audioUrl: uploadUrl || task.fileItem?.audioUrl || uploadUrl,
          r2Key: r2Key || task.fileItem?.r2Key,
          coverUrl: previewDataUrl || task.fileItem?.coverUrl || undefined,
          thumbnailUrl: previewDataUrl || task.fileItem?.thumbnailUrl || undefined,
          previewUrl: previewDataUrl || task.fileItem?.coverUrl || undefined,
          artist: task.fileItem?.artist || 'Artiste inconnu',
          isUploading: false,
        };
        CloudStorageAPI.saveAudio(audioToSave as any).catch(() => {});
      }

      // Synchronisation directe et EXCLUSIVE dans la table files de D1 (pour Mes Fichiers et Matières)
      const isMesFichiersUpload = category === 'mes-fichiers' || 
        task.uploadSource === 'mes-fichiers' || 
        Boolean((task.fileItem as any)?.matiere) || 
        (task.folderId && !['documents', 'images', 'videos', 'audio', 'default-folder', 'root'].includes(task.folderId));

      if (uploadUrl && r2Key && isMesFichiersUpload) {
        const currentUserId = getCurrentUserId() || localStorage.getItem('unifolder_user_id') || 'default-user';
        const extVal = (task.fileItem as any)?.extension || (fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() : 'FICHIER');
        const resolvedMatiereId = (task.fileItem as any)?.matiereId || 
          (task.folderId && task.folderId !== 'root' && task.folderId !== 'mes-fichiers' ? task.folderId : null) || 
          ((task.fileItem as any)?.matiere && (task.fileItem as any).matiere !== 'Mes fichiers' ? (task.fileItem as any).matiere : null);

        StudyCloudAPI.registerFileMetadata({
          id: serverFileId || id,
          userId: currentUserId,
          matiereId: resolvedMatiereId || undefined,
          name: fileName,
          size: task.fileItem?.sizeBytes || file.size,
          type: file.type || 'application/octet-stream',
          extension: extVal,
          r2Key: r2Key,
          fileUrl: uploadUrl,
          thumbnailUrl: previewDataUrl || task.fileItem?.thumbnailUrl || (task.fileItem as any)?.coverUrl || (task.fileItem as any)?.previewUrl || undefined,
          isFavorite: !!task.fileItem?.isFavorite,
          isImported: true,
          lastImported: Date.now()
        }).catch(err => console.warn('[UploadQueue] Erreur update registerFileMetadata:', err));
      }

      // Invalider immédiatement le cache TanStack Query ciblé pour préserver l'isolation
      try {
        if (category === 'audio') invalidateCloudQueries.audio();
        else if (category === 'videos') invalidateCloudQueries.videos();
        else if (category === 'images') invalidateCloudQueries.images();
        else if (category === 'documents') invalidateCloudQueries.documents();
        else if (category === 'classeur' || isFolderUpload) invalidateCloudQueries.classeurFiles(resolvedFolderId || folderId);
        else if (category === 'mes-fichiers') invalidateCloudQueries.filesMenu();
        
        invalidateCloudQueries.overview();
        if (category !== 'mes-fichiers' && category !== 'documents' && category !== 'classeur' && !isFolderUpload) {
          invalidateCloudQueries.all();
        }
      } catch {}

      // Déclencher un événement global pour tout listener de mise à jour
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studycloud_file_uploaded', {
          detail: { fileId: id, folderId, category, name: fileName, uploadUrl, r2Key }
        }));
      }
    } catch (err: any) {
      console.warn(`[UploadQueue] Échec sur "${fileName}":`, err);

      const isQuotaExceeded = err?.isStorageLimitExceeded || 
        err?.code === 'STORAGE_LIMIT_EXCEEDED' || 
        err?.message?.includes('STORAGE_LIMIT_EXCEEDED') || 
        err?.message?.includes('insuffisant') ||
        (err?.message?.includes('413') && !err?.message?.includes('> 100 Mo'));

      if (isQuotaExceeded) {
        task.retries = MAX_RETRIES;
        task.status = 'error';
        const errorMsg = err?.storageMessage || err?.message || 'Votre espace de stockage est insuffisant pour enregistrer ce fichier.';
        task.error = errorMsg;

        // Détruire / supprimer le fichier temporaire du store pour ne rien laisser consommer d'espace
        try {
          CloudDataStore.removeFile(id);
        } catch(e) {}

        this.notify();

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('studycloud_storage_limit_exceeded', {
            detail: { fileId: id, fileName, message: errorMsg }
          }));
        }
        return;
      }

      if (task.retries < MAX_RETRIES) {
        task.retries++;
        task.status = 'pending'; // Re-placer dans la file
        task.progress = 10;
        task.error = `Nouvelle tentative (${task.retries}/${MAX_RETRIES})...`;
        this.notify();
        // Attendre un délai exponentiel avant de retenter
        await new Promise(res => setTimeout(res, task.retries * 1500));
      } else {
        task.status = 'error';
        const errorMsg = err?.message?.includes('413')
          ? 'Fichier trop volumineux pour Cloudflare (> 100 Mo)'
          : err?.message?.includes('timeout')
            ? 'Délai d\'envoi dépassé (connexion trop lente)'
            : (err?.message || 'Erreur réseau ou timeout');
        task.error = errorMsg;
        CloudDataStore.updateFile(id, { 
          isUploading: false, 
          isSyncError: true, 
          uploadError: errorMsg 
        } as any, folderId);
        this.notify();

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('studycloud_upload_error', {
            detail: { fileId: id, fileName, error: errorMsg }
          }));
        }
      }
    }
  }

  public retryTask(taskId: string) {
    const task = this.queue.find(t => t.id === taskId);
    if (task && task.status === 'error') {
      task.status = 'pending';
      task.retries = 0;
      task.error = undefined;
      task.progress = 15;
      CloudDataStore.updateFile(task.id, { 
        isUploading: true, 
        isSyncError: false, 
        uploadError: undefined 
      } as any, task.folderId);
      this.notify();
      this.processQueue();
    }
  }

  public retryAllFailed() {
    this.queue.forEach(task => {
      if (task.status === 'error') {
        task.status = 'pending';
        task.retries = 0;
        task.error = undefined;
        task.progress = 15;
        CloudDataStore.updateFile(task.id, { 
          isUploading: true, 
          isSyncError: false, 
          uploadError: undefined 
        } as any, task.folderId);
      }
    });
    this.notify();
    this.processQueue();
  }

  public clearCompleted() {
    this.queue = this.queue.filter(t => t.status !== 'completed');
    this.notify();
  }

  public removeTask(taskId: string) {
    this.queue = this.queue.filter(t => t.id !== taskId);
    this.notify();
  }
}

export const UploadQueue = new UploadQueueManager();
