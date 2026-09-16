import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Upload, CheckCircle2, X, FileText, Table, Presentation, Plus, 
  RefreshCw, Globe, Tag, GraduationCap, BookOpen, Check, Edit3, AlertCircle 
} from 'lucide-react';
import { FileIconBadge } from './FileIconBadge';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { StudyCloudAPI } from '../services/api';

// Configure worker for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// IndexedDB pour conserver les fichiers bruts (File / Blob) même en cas de rechargement de page
const IDB_PUBLISH_DB = 'studycloud_publish_files_db';
const IDB_STORE_NAME = 'raw_files';

function openPublishFilesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = window.indexedDB.open(IDB_PUBLISH_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function persistRawFile(id: string, file: File): Promise<void> {
  try {
    const db = await openPublishFilesDB();
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    tx.objectStore(IDB_STORE_NAME).put(file, id);
  } catch (e) {
    console.warn('Could not persist file to IndexedDB:', e);
  }
}

async function retrieveRawFile(id: string): Promise<File | null> {
  try {
    const db = await openPublishFilesDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const req = tx.objectStore(IDB_STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function deleteRawFile(id: string): Promise<void> {
  try {
    const db = await openPublishFilesDB();
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    tx.objectStore(IDB_STORE_NAME).delete(id);
  } catch (e) {
    console.warn('Could not delete file from IndexedDB:', e);
  }
}

async function clearAllPersistedFiles(): Promise<void> {
  try {
    const db = await openPublishFilesDB();
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    tx.objectStore(IDB_STORE_NAME).clear();
  } catch (e) {
    console.warn('Could not clear IndexedDB:', e);
  }
}

/**
 * Vérifie si le fichier est autorisé à la publication.
 * Interdit formellement : vidéos, sons/audios, dossiers et archives compressées.
 * Seuls les documents (PDF, Word, Excel, PowerPoint, texte) et les images sont acceptés.
 */
export const checkPublicationFileType = (file: { name: string; type?: string; webkitRelativePath?: string }): {
  allowed: boolean;
  reason?: string;
} => {
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();

  // 1. Vidéos interdites
  if (type.startsWith('video/') || /\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|3gp|3g2|ts|mts|m2ts|vob|ogv)$/i.test(name)) {
    return {
      allowed: false,
      reason: "Les vidéos ne sont pas autorisées. Seuls les documents et les images sont acceptés."
    };
  }

  // 2. Audios et sons interdits
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|wma|opus|aiff|mid|midi|amr)$/i.test(name)) {
    return {
      allowed: false,
      reason: "Les fichiers audio et sons ne sont pas autorisés. Seuls les documents et les images sont acceptés."
    };
  }

  // 3. Dossiers / archives compressées multi-fichiers interdits
  if (
    Boolean(file.webkitRelativePath && file.webkitRelativePath.includes('/')) ||
    type.includes('zip') ||
    type.includes('tar') ||
    type.includes('rar') ||
    type.includes('7z') ||
    type.includes('compressed') ||
    /\.(zip|rar|7z|tar|gz|bz2|xz|tgz|iso)$/i.test(name)
  ) {
    return {
      allowed: false,
      reason: "Les dossiers et archives compressées ne sont pas autorisés. Veuillez publier chaque document ou image un par un."
    };
  }

  // 4. Seuls les documents et les images sont autorisés
  const isImage = type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|bmp|tiff|heic)$/i.test(name);
  const isDoc = (
    type === 'application/pdf' ||
    type.includes('word') ||
    type.includes('officedocument') ||
    type.includes('excel') ||
    type.includes('spreadsheet') ||
    type.includes('presentation') ||
    type.includes('powerpoint') ||
    type.startsWith('text/') ||
    /\.(pdf|docx?|xlsx?|pptx?|txt|csv|md|rtf|odt|ods|odp)$/i.test(name)
  );

  if (!isImage && !isDoc) {
    return {
      allowed: false,
      reason: "Ce genre de fichier n'est pas autorisé. Seuls les documents (PDF, Word, Excel, PowerPoint, texte) et les images sont acceptés."
    };
  }

  return { allowed: true };
};

interface PublishFileViewProps {
  onBack: () => void;
  onPublish?: (title: string, description: string, category: string, files: any[]) => void;
  onStatusChange?: (status: { isPublishing: boolean; hasFiles: boolean; progress?: string }) => void;
}

export const PublishFileView: React.FC<PublishFileViewProps> = ({ onBack, onPublish, onStatusChange }) => {
  const [selectedFiles, setSelectedFiles] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('published_selected_files');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });
  const [school, setSchool] = useState(() => localStorage.getItem('published_school') || '');
  const [filiere, setFiliere] = useState(() => localStorage.getItem('published_filiere') || '');
  const [infoMode, setInfoMode] = useState<'all' | 'individual' | 'none'>(() => {
    return (localStorage.getItem('published_info_mode') as any) || 'all';
  });

  // Champs globaux (pour le mode "all")
  const [docTitle, setDocTitle] = useState(() => localStorage.getItem('published_doc_title') || '');
  const [docDescription, setDocDescription] = useState(() => localStorage.getItem('published_doc_description') || '');
  const [docCategory, setDocCategory] = useState(() => localStorage.getItem('published_doc_category') || "Pas d'informations");
  const [customDocCategory, setCustomDocCategory] = useState(() => localStorage.getItem('published_custom_category') || '');
  const [docMatiere, setDocMatiere] = useState(() => localStorage.getItem('published_doc_matiere') || '');
  const [docLevel, setDocLevel] = useState(() => localStorage.getItem('published_doc_level') || '');
  const [docCountry, setDocCountry] = useState(() => localStorage.getItem('published_doc_country') || localStorage.getItem('user_country') || "Côte d'Ivoire");
  const [docTags, setDocTags] = useState(() => localStorage.getItem('published_doc_tags') || '');

  // État du modal d'édition individuelle
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalCategory, setModalCategory] = useState("Pas d'informations");
  const [customModalCategory, setCustomModalCategory] = useState('');
  const [modalMatiere, setModalMatiere] = useState('');
  const [modalLevel, setModalLevel] = useState('');
  const [modalSchool, setModalSchool] = useState('');
  const [modalFiliere, setModalFiliere] = useState('');
  const [modalCountry, setModalCountry] = useState("Côte d'Ivoire");
  const [modalDescription, setModalDescription] = useState('');
  const [modalTags, setModalTags] = useState('');

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishingProgress, setPublishingProgress] = useState<{ current: number; total: number; currentFileName: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [totalPublishedCount, setTotalPublishedCount] = useState<number>(0);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [topNotification, setTopNotification] = useState<{
    type: 'success' | 'warning' | 'error';
    publishedFiles: string[];
    duplicateFiles?: string[];
    rejectedFiles?: string[];
    forbiddenFiles?: { name: string; reason: string }[];
  } | null>(() => {
    try {
      const saved = localStorage.getItem('published_top_notification');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (topNotification) {
      try {
        localStorage.setItem('published_top_notification', JSON.stringify(topNotification));
      } catch {}
    } else {
      localStorage.removeItem('published_top_notification');
    }
  }, [topNotification]);

  const loadPublishedCount = async () => {
    try {
      const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
      const res = await StudyCloudAPI.getPublishedDocumentsCount(userId);
      if (res && typeof res.count === 'number') {
        setTotalPublishedCount(res.count);
      }
    } catch (e) {
      console.warn('Erreur chargement compteur publications:', e);
    }
  };

  useEffect(() => {
    loadPublishedCount();
    const handleRefresh = () => {
      loadPublishedCount();
    };
    window.addEventListener('studycloud_refresh_published_docs', handleRefresh);
    return () => {
      window.removeEventListener('studycloud_refresh_published_docs', handleRefresh);
    };
  }, []);

  useEffect(() => {
    try {
      const sanitized = selectedFiles.map(f => ({
        ...f,
        url: f.isImage && f.url && f.url.length > 50000 ? '' : f.url
      }));
      localStorage.setItem('published_selected_files', JSON.stringify(sanitized));
    } catch (e) {
      console.error('LocalStorage quota exceeded:', e);
      try {
        localStorage.removeItem('published_selected_files');
      } catch (err) {}
    }
  }, [selectedFiles]);

  // Synchroniser le statut en cours pour l'application globale (sidebar & badge)
  useEffect(() => {
    if (onStatusChange) {
      const hasFiles = selectedFiles.length > 0;
      const progress = isPublishing
        ? publishingProgress?.currentFileName
          ? `Doc ${publishingProgress.current}/${publishingProgress.total} : ${publishingProgress.currentFileName}`
          : 'Traitement en cours...'
        : hasFiles
        ? `${selectedFiles.length} fichier(s)`
        : undefined;
      onStatusChange({ isPublishing, hasFiles, progress });
    }
  }, [isPublishing, publishingProgress, selectedFiles.length, onStatusChange]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('published_school', school);
      localStorage.setItem('published_filiere', filiere);
      localStorage.setItem('published_info_mode', infoMode);
      localStorage.setItem('published_doc_title', docTitle);
      localStorage.setItem('published_doc_description', docDescription);
      localStorage.setItem('published_doc_category', docCategory);
      localStorage.setItem('published_custom_category', customDocCategory);
      localStorage.setItem('published_doc_matiere', docMatiere);
      localStorage.setItem('published_doc_level', docLevel);
      localStorage.setItem('published_doc_country', docCountry);
      localStorage.setItem('published_doc_tags', docTags);
    } catch (e) {
      console.error(e);
    }
  }, [school, filiere, infoMode, docTitle, docDescription, docCategory, customDocCategory, docMatiere, docLevel, docCountry, docTags]);

  useEffect(() => {
    if (selectedFiles.length > 0 && containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 150);
    }
  }, [selectedFiles.length]);

  // Map pour stocker les fichiers bruts (non sérialisables) par ID pour l'upload R2
  const rawFileMap = useRef<Map<string, File>>(new Map());

  // Réhydrater les fichiers bruts depuis IndexedDB lors du montage / retour au menu
  useEffect(() => {
    async function rehydrateRawFiles() {
      for (const f of selectedFiles) {
        if (!rawFileMap.current.has(f.id)) {
          const raw = await retrieveRawFile(f.id);
          if (raw) {
            rawFileMap.current.set(f.id, raw);
          }
        }
      }
    }
    if (selectedFiles.length > 0) {
      rehydrateRawFiles();
    }
  }, []);

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const processFiles = (filesArray: File[]) => {
    const allowedFiles: File[] = [];
    const forbiddenFilesDetected: { name: string; reason: string }[] = [];

    filesArray.forEach((file: any) => {
      const check = checkPublicationFileType(file);
      if (!check.allowed) {
        forbiddenFilesDetected.push({
          name: file.name,
          reason: check.reason || "Ce genre de fichier n'est pas autorisé."
        });
      } else {
        allowedFiles.push(file);
      }
    });

    if (forbiddenFilesDetected.length > 0) {
      setTopNotification({
        type: 'warning',
        publishedFiles: [],
        forbiddenFiles: forbiddenFilesDetected
      });
    }

    if (allowedFiles.length === 0) return;

    allowedFiles.forEach((file: any) => {
      const fileNameLower = file.name.toLowerCase();
      const isImage = file.type && file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || fileNameLower.endsWith('.pdf');
      const isDocx = file.type.includes('wordprocessingml') || fileNameLower.endsWith('.docx') || fileNameLower.endsWith('.doc');
      const isXlsx = fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls') || fileNameLower.endsWith('.csv') || file.type.includes('spreadsheet') || file.type.includes('excel');
      const isPptx = fileNameLower.endsWith('.pptx') || fileNameLower.endsWith('.ppt') || file.type.includes('presentation') || file.type.includes('powerpoint');
      const isText = file.type.startsWith('text/') || fileNameLower.endsWith('.txt') || fileNameLower.endsWith('.md') || fileNameLower.endsWith('.json');

      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-_]/g, ' ');
      const fileId = Math.random().toString(36).substring(2, 9);
      rawFileMap.current.set(fileId, file);
      persistRawFile(fileId, file);

      const baseFileProps = {
        id: fileId,
        name: file.name,
        size: file.size,
        textContent: cleanName,
        tableRows: [],
        fileTitle: cleanName,
        fileCategory: docCategory || "Pas d'informations",
        fileMatiere: docMatiere || '',
        fileLevel: docLevel || '',
        fileSchool: school || '',
        fileFiliere: filiere || '',
        fileCountry: docCountry || "Côte d'Ivoire",
        fileDescription: '',
        fileTags: '',
        isCompleted: false,
      };

      if (isImage) {
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          const resultUrl = uploadEvent.target?.result as string || '';
          const newFileObj = {
            ...baseFileProps,
            type: file.type || 'image/png',
            url: resultUrl,
            isImage: true,
            fileTypeCategory: 'image',
          };
          setSelectedFiles((prev) => [...prev, newFileObj]);
        };
        reader.readAsDataURL(file);
      } else if (isPdf) {
        const reader = new FileReader();
        reader.onload = async (uploadEvent) => {
          try {
            const arrayBuffer = uploadEvent.target?.result as ArrayBuffer;
            if (arrayBuffer) {
              const typedarray = new Uint8Array(arrayBuffer);
              const loadingTask = pdfjsLib.getDocument({ data: typedarray });
              const pdf = await loadingTask.promise;
              const page = await pdf.getPage(1);
              const viewport = page.getViewport({ scale: 1.5 });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              if (context) {
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: context, viewport }).promise;
                const imageUrl = canvas.toDataURL('image/png');

                const newFileObj = {
                  ...baseFileProps,
                  type: file.type || 'application/pdf',
                  url: imageUrl,
                  isImage: true,
                  fileTypeCategory: 'pdf',
                };
                setSelectedFiles((prev) => [...prev, newFileObj]);
                return;
              }
            }
          } catch (err) {
            console.warn('Could not render PDF first page (fallback):', err);
          }

          const newFileObj = {
            ...baseFileProps,
            type: file.type || 'application/pdf',
            url: '',
            isImage: false,
            fileTypeCategory: 'pdf',
          };
          setSelectedFiles((prev) => [...prev, newFileObj]);
        };
        reader.readAsArrayBuffer(file);
      } else if (isDocx) {
        const reader = new FileReader();
        reader.onload = async (uploadEvent) => {
          try {
            const arrayBuffer = uploadEvent.target?.result as ArrayBuffer;
            if (arrayBuffer) {
              const result = await mammoth.extractRawText({ arrayBuffer });
              const text = result.value || '';
              const newFileObj = {
                ...baseFileProps,
                type: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                url: '',
                isImage: false,
                fileTypeCategory: 'docx',
                textContent: text ? text.trim() : cleanName,
              };
              setSelectedFiles((prev) => [...prev, newFileObj]);
              return;
            }
          } catch (err) {
            console.warn('Could not extract Word text (fallback):', err);
          }

          const newFileObj = {
            ...baseFileProps,
            type: file.type || 'application/msword',
            url: '',
            isImage: false,
            fileTypeCategory: 'docx',
          };
          setSelectedFiles((prev) => [...prev, newFileObj]);
        };
        reader.readAsArrayBuffer(file);
      } else if (isXlsx) {
        const reader = new FileReader();
        reader.onload = async (uploadEvent) => {
          try {
            const arrayBuffer = uploadEvent.target?.result as ArrayBuffer;
            if (arrayBuffer) {
              const workbook = XLSX.read(arrayBuffer, { type: 'array' });
              const firstSheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[firstSheetName];
              const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
              const rows = jsonData.slice(0, 6).map((r) => r.slice(0, 4));

              const newFileObj = {
                ...baseFileProps,
                type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                url: '',
                isImage: false,
                fileTypeCategory: 'xlsx',
                tableRows: rows.length > 0 ? rows : [['ID', 'Nom', 'Valeur', 'Statut'], ['01', 'Article A', '150', 'Actif'], ['02', 'Article B', '320', 'En attente']],
              };
              setSelectedFiles((prev) => [...prev, newFileObj]);
              return;
            }
          } catch (err) {
            console.warn('Could not parse Excel spreadsheet (fallback):', err);
          }

          const newFileObj = {
            ...baseFileProps,
            type: file.type || 'application/vnd.ms-excel',
            url: '',
            isImage: false,
            fileTypeCategory: 'xlsx',
          };
          setSelectedFiles((prev) => [...prev, newFileObj]);
        };
        reader.readAsArrayBuffer(file);
      } else if (isPptx) {
        const reader = new FileReader();
        reader.onload = () => {
          const newFileObj = {
            ...baseFileProps,
            type: file.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            url: '',
            isImage: false,
            fileTypeCategory: 'pptx',
          };
          setSelectedFiles((prev) => [...prev, newFileObj]);
        };
        reader.readAsArrayBuffer(file);
      } else if (isText) {
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          const text = uploadEvent.target?.result as string || '';
          const newFileObj = {
            ...baseFileProps,
            type: file.type || 'text/plain',
            url: '',
            isImage: false,
            fileTypeCategory: 'text',
            textContent: text ? text.trim() : cleanName,
          };
          setSelectedFiles((prev) => [...prev, newFileObj]);
        };
        reader.readAsText(file);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const newFileObj = {
            ...baseFileProps,
            type: file.type || 'application/octet-stream',
            url: '',
            isImage: false,
            fileTypeCategory: 'other',
          };
          setSelectedFiles((prev) => [...prev, newFileObj]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    let folderDetected = false;
    const detectedFiles: File[] = [];
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
          if (entry && entry.isDirectory) {
            folderDetected = true;
          } else {
            const f = item.getAsFile();
            if (f) detectedFiles.push(f);
          }
        }
      }
    }

    if (folderDetected) {
      setTopNotification({
        type: 'warning',
        publishedFiles: [],
        forbiddenFiles: [
          {
            name: 'Dossier détecté',
            reason: "Les dossiers (qui contiennent plusieurs fichiers) ne sont pas autorisés. Veuillez publier chaque document ou image individuellement."
          }
        ]
      });
    }

    const filesToProcess: File[] = detectedFiles.length > 0 ? detectedFiles : (e.dataTransfer.files ? Array.from(e.dataTransfer.files) as File[] : []);
    if (filesToProcess.length > 0) {
      processFiles(filesToProcess);
    }
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
    rawFileMap.current.delete(id);
    deleteRawFile(id);
    if (editingFileId === id) {
      setEditingFileId(null);
    }
  };

  const handleBack = () => {
    clearAllPersistedFiles();
    [
      'published_selected_files',
      'published_school',
      'published_filiere',
      'published_info_mode',
      'published_doc_title',
      'published_doc_description',
      'published_doc_category',
      'published_custom_category',
      'published_doc_matiere',
      'published_doc_level',
      'published_doc_country',
      'published_doc_tags',
      'published_top_notification'
    ].forEach(k => localStorage.removeItem(k));
    setSelectedFiles([]);
    setTopNotification(null);
    setPublishError(null);
    setIsPublishing(false);
    setPublishingProgress(null);
    if (onStatusChange) {
      onStatusChange({ isPublishing: false, hasFiles: false });
    }
    onBack();
  };

  // Gestion de la modale individuelle
  // Gestion de la modale individuelle
  const STANDARD_CATEGORIES = ["Pas d'informations", 'Cours', 'TD', 'TP', 'Examen', 'Résumé', 'Projet'];

  const openEditModal = (file: any) => {
    setEditingFileId(file.id);
    setModalTitle(file.fileTitle || file.name.replace(/\.[^/.]+$/, '').replace(/[_-_]/g, ' '));
    const cat = file.fileCategory || docCategory || "Pas d'informations";
    if (STANDARD_CATEGORIES.includes(cat)) {
      setModalCategory(cat);
      setCustomModalCategory('');
    } else {
      setModalCategory('Autre');
      setCustomModalCategory(cat === "Pas d'informations" ? '' : cat);
    }
    setModalMatiere(file.fileMatiere || docMatiere || '');
    setModalLevel(file.fileLevel || docLevel || '');
    setModalSchool(file.fileSchool || school || '');
    setModalFiliere(file.fileFiliere || filiere || '');
    setModalCountry(file.fileCountry || docCountry || "Côte d'Ivoire");
    setModalDescription(file.fileDescription || '');
    setModalTags(file.fileTags || '');
  };

  const closeEditModal = () => {
    setEditingFileId(null);
  };

  const isModalFormValid = 
    modalMatiere.trim().length > 0 &&
    modalLevel.trim().length > 0 &&
    modalFiliere.trim().length > 0 &&
    modalCountry.trim().length > 0;

  const saveEditModal = () => {
    if (!editingFileId || !isModalFormValid) return;
    const finalCategory = modalCategory === 'Autre'
      ? (customModalCategory.trim() || "Pas d'informations")
      : (modalCategory.trim() || "Pas d'informations");
    setSelectedFiles(prev => prev.map(f => {
      if (f.id === editingFileId) {
        return {
          ...f,
          fileTitle: modalTitle.trim(),
          fileCategory: finalCategory,
          fileMatiere: modalMatiere.trim(),
          fileLevel: modalLevel.trim(),
          fileSchool: modalSchool.trim(),
          fileFiliere: modalFiliere.trim(),
          fileCountry: modalCountry.trim(),
          fileDescription: modalDescription.trim(),
          fileTags: modalTags.trim(),
          isCompleted: true,
        };
      }
      return f;
    }));
    setEditingFileId(null);
  };

  // Comptage des fichiers complétés en mode individuel
  const completedCount = selectedFiles.filter(f => f.isCompleted).length;

  // Validation globale selon le mode choisi
  const isFormValid = (() => {
    if (selectedFiles.length === 0) return false;

    // Si tous les fichiers sont des doublons détectés, invalider
    const nonDuplicates = selectedFiles.filter(f => !f.isDuplicate);
    if (nonDuplicates.length === 0 && selectedFiles.some(f => f.isDuplicate)) return false;

    if (infoMode === 'all') {
      return (
        docMatiere.trim().length > 0 &&
        docLevel.trim().length > 0 &&
        filiere.trim().length > 0 &&
        docCountry.trim().length > 0
      );
    }

    if (infoMode === 'individual') {
      return nonDuplicates.length > 0 && nonDuplicates.every(f => f.isCompleted === true);
    }

    if (infoMode === 'none') {
      return nonDuplicates.length > 0;
    }

    return false;
  })();

  const handlePublishAll = async () => {
    if (!isFormValid || selectedFiles.length === 0 || isPublishing) return;
    setIsPublishing(true);
    setPublishError(null);
    setUploadProgress(10);

    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    const userName = localStorage.getItem('unifolder_user_name') || 'Étudiant';

    try {
      setPublishingProgress({
        current: 1,
        total: selectedFiles.length,
        currentFileName: 'Vérification anti-doublon en cours...'
      });
      setUploadProgress(20);

      // 1. Détection locale immédiate des doublons dans le même lot sélectionné
      const localSeenNames = new Set<string>();
      const localDuplicateIdSet = new Set<string>();
      for (const f of selectedFiles) {
        const normName = (f.name || '').trim().toLowerCase();
        if (normName) {
          if (localSeenNames.has(normName)) {
            // Deuxième occurrence du même fichier : recalé
            localDuplicateIdSet.add(f.id);
          } else {
            localSeenNames.add(normName);
          }
        }
      }

      // 2. Vérification des doublons auprès du Worker (déjà dans D1 ou dans le lot)
      const duplicateFileIdSet = new Set<string>(localDuplicateIdSet);
      const duplicateNameSet = new Set<string>();
      try {
        const checkRes = await StudyCloudAPI.checkPublishedDuplicates(
          userId,
          selectedFiles.map(f => ({ id: f.id, name: f.name, size: f.size }))
        );
        if (checkRes && checkRes.duplicates) {
          checkRes.duplicates.forEach(d => {
            if (d.isDuplicate) {
              if (d.fileId) {
                duplicateFileIdSet.add(d.fileId);
              } else {
                duplicateNameSet.add(d.fileName.toLowerCase());
              }
            }
          });
        }
      } catch (checkErr) {
        console.warn('Erreur vérification doublons via API:', checkErr);
      }

      // Marquer les fichiers détectés comme doublons
      // Si le même fichier apparaît deux fois, seul le premier s'enregistre, le second est refusé/recalé
      const updatedFiles = selectedFiles.map(f => {
        const isDup = duplicateFileIdSet.size > 0
          ? duplicateFileIdSet.has(f.id)
          : duplicateNameSet.has(f.name.toLowerCase());
        return isDup ? { ...f, isDuplicate: true } : f;
      });
      setSelectedFiles(updatedFiles);

      const filesToPublish = updatedFiles.filter(f => !f.isDuplicate);
      const duplicateFilesList = updatedFiles.filter(f => f.isDuplicate).map(f => f.name);

      // Si tous les fichiers sélectionnés sont des doublons
      if (filesToPublish.length === 0) {
        setUploadProgress(100);
        setTimeout(() => {
          setIsPublishing(false);
          setPublishingProgress(null);
          setTopNotification({
            type: 'warning',
            publishedFiles: [],
            duplicateFiles: duplicateFilesList
          });
        }, 500);
        return;
      }

      // 2. Publication des fichiers valides
      const publishedSuccessNames: string[] = [];
      const publishedSuccessIds: string[] = [];
      const rejectedFilesList: string[] = [];
      let currentIdx = 0;

      for (const file of filesToPublish) {
        currentIdx++;
        const basePercent = 20 + Math.round(((currentIdx - 1) / filesToPublish.length) * 75);
        setUploadProgress(basePercent);

        setPublishingProgress({
          current: currentIdx,
          total: filesToPublish.length,
          currentFileName: file.name
        });

        let title = '';
        let fileSchool = '';
        let fileFiliere = '';
        let category = "Pas d'informations";
        let matiereName = '';
        let level = '';
        let country = docCountry || "Côte d'Ivoire";
        let description = '';
        let tagsArray: string[] = [];

        if (infoMode === 'all') {
          title = docTitle.trim() || file.name.replace(/\.[^/.]+$/, '');
          fileSchool = school.trim();
          fileFiliere = filiere.trim();
          category = docCategory === 'Autre'
            ? (customDocCategory.trim() || "Pas d'informations")
            : (docCategory.trim() || "Pas d'informations");
          matiereName = docMatiere.trim();
          level = docLevel.trim();
          country = docCountry.trim() || "Côte d'Ivoire";
          description = docDescription.trim();
          tagsArray = docTags ? docTags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
        } else if (infoMode === 'individual') {
          title = file.fileTitle?.trim() || file.name.replace(/\.[^/.]+$/, '');
          fileSchool = file.fileSchool?.trim() || '';
          fileFiliere = file.fileFiliere?.trim() || '';
          category = file.fileCategory?.trim() && file.fileCategory !== 'Autre'
            ? file.fileCategory.trim()
            : "Pas d'informations";
          matiereName = file.fileMatiere?.trim() || '';
          level = file.fileLevel?.trim() || '';
          country = file.fileCountry?.trim() || docCountry || "Côte d'Ivoire";
          description = file.fileDescription?.trim() || '';
          tagsArray = file.fileTags ? file.fileTags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
        } else {
          title = file.name.replace(/\.[^/.]+$/, '');
          fileSchool = '';
          fileFiliere = '';
          category = "Pas d'informations";
          matiereName = '';
          level = '';
          country = docCountry || "Côte d'Ivoire";
          description = docDescription ? docDescription.trim() : '';
          tagsArray = [];
        }

        // Safeguard de sécurité : vérification stricte du type de fichier
        const typeCheck = checkPublicationFileType(file);
        if (!typeCheck.allowed) {
          rejectedFilesList.push(file.name);
          setSelectedFiles(prev => prev.map(f => f.id === file.id ? {
            ...f,
            isRejected: true,
            rejectReason: typeCheck.reason || "Fichier non autorisé"
          } : f));
          continue;
        }

        // Tenter l'upload R2
        let r2Key: string | null = null;
        let fileUrl: string = '';
        try {
          let rawFile = rawFileMap.current.get(file.id);
          if (!rawFile) {
            rawFile = (await retrieveRawFile(file.id)) || undefined;
          }
          if (rawFile) {
            const key = `published/${userId}/${Date.now()}-${file.name}`;
            const uploadResult = await StudyCloudAPI.uploadFileToR2(rawFile, key);
            r2Key = uploadResult.key;
            fileUrl = uploadResult.url;

            // Upload de la miniature si elle a été générée (PDF)
            if (file.url && file.url.startsWith('data:image')) {
              try {
                const res = await fetch(file.url);
                const blob = await res.blob();
                await StudyCloudAPI.uploadFileToR2(blob, `${key}_thumb.png`);
              } catch (thumbErr) {
                console.warn('Upload de la miniature R2 échoué:', thumbErr);
              }
            }
          }
        } catch (uploadErr) {
          console.warn('Upload R2 échoué (mode local):', uploadErr);
        }

        setUploadProgress(basePercent + Math.round(35 / filesToPublish.length));

        // Envoi au Worker avec tolérance doublon
        let pubRes: any = null;
        try {
          pubRes = await StudyCloudAPI.publishDocument({
            userId,
            title,
            description,
            school: fileSchool,
            filiere: fileFiliere,
            matiereName,
            level,
            category,
            authorName: userName,
            country,
            infoMode,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            r2Key,
            fileUrl,
            isPublic: true,
            tagsJson: JSON.stringify(tagsArray),
          });
        } catch (publishErr: any) {
          if (publishErr?.duplicate || publishErr?.message?.includes('recalé') || publishErr?.message?.includes('409')) {
            pubRes = { duplicate: true, message: 'Un fichier a été recalé car son deuxième a été enregistré' };
          } else if (publishErr?.forbiddenType || publishErr?.message?.includes('pas autorisé') || publishErr?.message?.includes('interdit')) {
            pubRes = { forbiddenType: true, message: publishErr?.message || "Ce genre de fichier n'est pas autorisé." };
          } else {
            console.warn('Fichier non accepté ou erreur:', file.name, publishErr);
            pubRes = { rejected: true, message: publishErr?.message || 'Fichier non accepté' };
          }
        }

        if (pubRes && (pubRes as any).duplicate) {
          duplicateFilesList.push(file.name);
          setSelectedFiles(prev => prev.map(f => f.id === file.id ? { ...f, isDuplicate: true } : f));
        } else if (pubRes && ((pubRes as any).forbiddenType || pubRes.success === false)) {
          rejectedFilesList.push(file.name);
          setSelectedFiles(prev => prev.map(f => f.id === file.id ? { ...f, isRejected: true, rejectReason: pubRes.message || "Fichier non autorisé" } : f));
        } else if (pubRes && (pubRes as any).rejected) {
          rejectedFilesList.push(file.name);
          setSelectedFiles(prev => prev.map(f => f.id === file.id ? { ...f, isRejected: true, rejectReason: pubRes.message } : f));
        } else {
          publishedSuccessNames.push(file.name);
          publishedSuccessIds.push(file.id);
          deleteRawFile(file.id);
          rawFileMap.current.delete(file.id);
        }
      }

      setUploadProgress(100);

      // Recharger le compteur de documents publiés
      await loadPublishedCount();

      // Nettoyer de la liste les fichiers publiés avec succès en filtrant par ID
      // Les fichiers doublons/recalés et non acceptés restent affichés pour que l'utilisateur voie qu'ils ont été refusés
      setSelectedFiles(prev => prev.filter(f => !publishedSuccessIds.includes(f.id)));

      setIsPublishing(false);
      setPublishingProgress(null);

      // Notification détaillée en haut
      setTopNotification({
        type: (duplicateFilesList.length > 0 || rejectedFilesList.length > 0) && publishedSuccessNames.length === 0 ? 'warning' : 'success',
        publishedFiles: publishedSuccessNames,
        duplicateFiles: duplicateFilesList.length > 0 ? duplicateFilesList : undefined,
        rejectedFiles: rejectedFilesList.length > 0 ? rejectedFilesList : undefined
      });

      // Déclencher le rafraîchissement des documents en direct en arrière-plan sans quitter la page
      window.dispatchEvent(new Event('studycloud_refresh_published_docs'));

      if (onPublish && publishedSuccessNames.length > 0) {
        const cleanFilesToPublish = filesToPublish
          .filter(f => publishedSuccessIds.includes(f.id))
          .map(f => ({
            id: f.id,
            name: f.name,
            size: f.size,
            type: f.type,
            url: f.url && !f.url.startsWith('data:') ? f.url : ''
          }));
        onPublish(
          infoMode === 'all' ? docTitle : publishedSuccessNames[0],
          docDescription || '',
          docCategory || "Pas d'informations",
          cleanFilesToPublish
        );
      }
      // REMARQUE : Aucune redirection vers Ressources ! L'utilisateur reste exactement sur cette page de publication.
    } catch (err: any) {
      console.error('Erreur lors de la publication:', err);
      setPublishError(err.message || 'Erreur lors de la publication. Vérifiez la connexion au Worker.');
      setIsPublishing(false);
      setPublishingProgress(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo';
    }
    return Math.round(bytes / 1024) + ' ko';
  };

  const activeEditingFile = selectedFiles.find(f => f.id === editingFileId);

  return (
    <div 
      ref={containerRef} 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`absolute inset-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-screen bg-[#FDFBF7] text-stone-950 px-3 sm:px-6 py-4 overflow-y-auto transition-colors ${
        isDraggingOver ? 'ring-4 ring-emerald-500 ring-inset bg-emerald-50/20' : ''
      }`}
    >
      {/* Fullscreen Drag Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-[100] bg-[#2D4A3E]/85 backdrop-blur-sm border-4 border-dashed border-emerald-400 flex flex-col items-center justify-center pointer-events-none p-6 text-center animate-in fade-in duration-150">
          <div className="w-20 h-20 rounded-3xl bg-white/20 border-2 border-white flex items-center justify-center mb-4 shadow-xl animate-bounce">
            <Upload className="w-10 h-10 text-white stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-black text-white drop-shadow-md">Déposez vos fichiers ici</h2>
          <p className="text-sm font-bold text-emerald-100 mt-1">Seuls les documents (PDF, Word, Excel, PPT...) et images sont acceptés (vidéos, sons et dossiers interdits)</p>
        </div>
      )}

      {/* Top Floating Notification (cites files, without stars) */}
      {topNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] w-[94%] max-w-xl animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
          <div className={`p-4 rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_#1c1917] ${
            topNotification.type === 'success' ? 'bg-[#2D4A3E] text-white' : 'bg-[#78350F] text-amber-50'
          }`}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                {topNotification.type === 'success' ? (
                  <Check className="w-5 h-5 text-emerald-300 stroke-[3]" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-300 stroke-[3]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black leading-tight">
                  {topNotification.publishedFiles.length > 0
                    ? 'Publication réussie !'
                    : (topNotification.forbiddenFiles && topNotification.forbiddenFiles.length > 0)
                    ? 'Fichier(s) non autorisé(s)'
                    : (topNotification.rejectedFiles && topNotification.rejectedFiles.length > 0)
                    ? 'Fichier(s) non accepté(s)'
                    : 'Notification de doublon'}
                </h4>
                {topNotification.publishedFiles.length > 0 && (
                  <div className="mt-1.5 text-xs text-emerald-100 font-medium space-y-1">
                    <p>
                      Les fichiers suivants ont été publiés avec succès :
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {topNotification.publishedFiles.map((fn, idx) => (
                        <span key={idx} className="bg-emerald-900/90 border border-emerald-400/50 px-2 py-0.5 rounded-md text-[11px] font-bold text-white truncate max-w-full">
                          📄 {fn}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {topNotification.forbiddenFiles && topNotification.forbiddenFiles.length > 0 && (
                  <div className="mt-2.5 pt-2 text-xs font-medium border-t border-white/20 text-red-100">
                    <p className="font-bold text-red-300">
                      🚫 {topNotification.forbiddenFiles.length > 1
                        ? `${topNotification.forbiddenFiles.length} fichiers ne sont pas autorisés :`
                        : "Ce fichier n'est pas autorisé :"}
                    </p>
                    <p className="text-[11px] text-amber-200/90 mt-0.5 font-medium">
                      Les vidéos, les sons et les dossiers sont interdits. Seuls les documents (PDF, Word, Excel, PPT...) et les images sont autorisés.
                    </p>
                    <div className="flex flex-col gap-1 mt-1.5">
                      {topNotification.forbiddenFiles.map((item, idx) => (
                        <div key={idx} className="bg-red-950/80 border border-red-400/40 px-2 py-1 rounded-md text-[11px] font-medium text-white flex items-start gap-1.5">
                          <span className="font-bold text-red-300 shrink-0">❌ {item.name}</span>
                          <span className="text-stone-200">— {item.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {topNotification.duplicateFiles && topNotification.duplicateFiles.length > 0 && (
                  <div className={`mt-2.5 pt-2 text-xs font-medium ${
                    topNotification.publishedFiles.length > 0 ? 'border-t border-white/20 text-amber-200' : 'text-amber-100'
                  }`}>
                    <p className="font-bold text-amber-300">
                      ⚠️ {topNotification.duplicateFiles.length > 1
                        ? `${topNotification.duplicateFiles.length} fichiers ont été recalés car leur double a été enregistré :`
                        : 'Un fichier a été recalé car son deuxième a été enregistré :'}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {topNotification.duplicateFiles.map((fn, idx) => (
                        <span key={idx} className="bg-red-900/90 border border-red-400/50 px-2 py-0.5 rounded-md text-[11px] font-bold text-white truncate max-w-full">
                          ❌ {fn}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {topNotification.rejectedFiles && topNotification.rejectedFiles.length > 0 && (
                  <div className={`mt-2.5 pt-2 text-xs font-medium border-t border-white/20 text-red-100`}>
                    <p className="font-bold text-red-300">
                      ⚠️ {topNotification.rejectedFiles.length > 1
                        ? `${topNotification.rejectedFiles.length} fichiers n'ont pas pu être acceptés :`
                        : "Un fichier n'a pas pu être accepté :"}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {topNotification.rejectedFiles.map((fn, idx) => (
                        <span key={idx} className="bg-red-900/90 border border-red-400/50 px-2 py-0.5 rounded-md text-[11px] font-bold text-white truncate max-w-full">
                          ❌ {fn}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setTopNotification(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Fixed Bar */}
      <div className="fixed top-4 left-3 right-3 sm:left-6 sm:right-6 md:left-[calc(16rem+1.5rem)] flex items-center justify-between z-40 pointer-events-none">
        <button
          onClick={handleBack}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F1E9] hover:bg-[#EBE5DA] text-stone-900 font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour</span>
        </button>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Compteur de fichiers publiés depuis la création du compte */}
          <div 
            title="Nombre total de documents publiés depuis la création de votre compte"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F1E9] text-stone-900 font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] select-none"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden sm:inline text-stone-700 font-bold text-[11px]">Publiés :</span>
            <span className="bg-[#2D4A3E] text-white font-black px-1.5 py-0.5 rounded-lg text-[11px] min-w-[20px] text-center shadow-xs">
              {totalPublishedCount}
            </span>
          </div>

          <label 
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processFiles(Array.from(e.dataTransfer.files));
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F1E9] hover:bg-[#EBE5DA] text-stone-900 font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <Upload className="w-3.5 h-3.5 text-orange-600" />
            <span>Ajouter</span>
            <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.rtf,.odt,.ods,.odp,image/*" onChange={handleFileChange} className="hidden" />
          </label>

          {selectedFiles.length > 0 && (
            <button
              onClick={handlePublishAll}
              disabled={!isFormValid || isPublishing}
              title={
                !isFormValid
                  ? infoMode === 'individual'
                    ? `Complétez tous les fichiers (${completedCount}/${selectedFiles.length} renseignés)`
                    : 'Remplissez tous les champs obligatoires (*)'
                  : 'Valider et publier les documents'
              }
              className={`flex items-center gap-1.5 px-4 py-1.5 font-bold text-xs rounded-xl border-2 transition-all select-none ${
                isFormValid && !isPublishing
                  ? 'bg-[#2D4A3E] hover:bg-[#1e332a] text-white border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer active:translate-x-0.5 active:translate-y-0.5'
                  : 'bg-stone-200 text-stone-400 border-stone-400 shadow-none cursor-not-allowed opacity-80'
              }`}
            >
              {isPublishing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
              ) : isFormValid ? (
                <Check className="w-3.5 h-3.5 text-emerald-300 stroke-[3]" />
              ) : null}
              <span>
                {isPublishing
                  ? 'Publication en cours...'
                  : infoMode === 'individual'
                  ? `Valider (${completedCount}/${selectedFiles.length})`
                  : `Valider (${selectedFiles.length})`}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto pt-16 pb-24">
        <div className="w-full space-y-4">
            {selectedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[70vh]">
                <label 
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      processFiles(Array.from(e.dataTransfer.files));
                    }
                  }}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-stone-400 bg-white hover:bg-stone-50 rounded-2xl p-12 sm:p-16 cursor-pointer transition-all shadow-[3px_3px_0px_0px_#1c1917] text-center w-full max-w-md group"
                >
                  <Upload className="w-10 h-10 text-orange-600 mb-3 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-stone-800">Cliquez ou déposez vos fichiers ici</span>
                  <span className="text-xs text-stone-600 mt-1">Seuls les documents (PDF, Word, Excel, PPT...) et images sont autorisés</span>
                  <span className="text-[10.5px] font-bold text-red-600 mt-0.5">🚫 Vidéos, sons et dossiers non autorisés</span>
                  <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.rtf,.odt,.ods,.odp,image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            ) : (
              <div>
                {/* File Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-3.5 mt-2">
                  {selectedFiles.map((file) => {
                    const isIndividual = infoMode === 'individual';
                    const isDup = !!file.isDuplicate;
                    const isRejected = !!file.isRejected;
                    const isGreen = isIndividual && file.isCompleted && !isDup && !isRejected;

                    const fileNameLower = (file.name || '').toLowerCase();
                    const isPdfCard = fileNameLower.endsWith('.pdf');
                    const isDocxCard = /\.(docx|doc)$/i.test(fileNameLower);
                    const isXlsxCard = /\.(xlsx|xls|csv)$/i.test(fileNameLower);
                    const isPptxCard = /\.(pptx|ppt)$/i.test(fileNameLower);
                    const isTextCard = /\.(txt|md|json)$/i.test(fileNameLower);
                    
                    let baseBg = 'bg-stone-700'; // Par défaut
                    if (isPdfCard) baseBg = 'bg-[#dc2626] text-white';
                    else if (isDocxCard) baseBg = 'bg-[#2563eb] text-white';
                    else if (isXlsxCard) baseBg = 'bg-[#059669] text-white';
                    else if (isPptxCard) baseBg = 'bg-[#d97706] text-white';
                    else if (file.isImage) baseBg = 'bg-[#0891b2] text-white';

                    return (
                      <div
                        key={file.id}
                        onClick={() => {
                          if (isIndividual && !isDup && !isRejected) {
                            openEditModal(file);
                          }
                        }}
                        className={`aspect-[3/4] rounded-xl p-2.5 flex flex-col justify-between shadow-[2px_2px_0px_0px_#1c1917] relative group select-none overflow-hidden transition-all ${
                          isIndividual && !isDup && !isRejected ? 'cursor-pointer hover:scale-[1.02]' : ''
                        } ${
                          isDup
                            ? 'bg-red-950/90 border-2 border-red-500 ring-2 ring-red-500/60'
                            : isRejected
                            ? 'bg-red-950/90 border-2 border-rose-500 ring-2 ring-rose-500/60'
                            : `${baseBg} border-2 ${isGreen ? 'border-emerald-400 ring-2 ring-emerald-500/50' : isIndividual ? 'border-amber-500 hover:border-amber-400' : 'border-stone-800'}`
                        }`}
                      >
                        {/* File size badge in top right */}
                        <div className="absolute top-1.5 right-1.5 z-20 bg-black/80 backdrop-blur-sm text-stone-200 font-bold text-[8px] px-1.5 py-0.5 rounded border border-stone-700 shadow-sm">
                          {formatSize(file.size)}
                        </div>

                        {/* Status Badge */}
                        {isDup ? (
                          <div className="absolute top-1.5 left-8 z-20">
                            <span 
                              title="Un fichier a été recalé car son deuxième a été enregistré"
                              className="bg-red-600 text-white font-black text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm"
                            >
                              <X className="w-2.5 h-2.5 stroke-[3]" /> Recalé (doublon)
                            </span>
                          </div>
                        ) : isRejected ? (
                          <div className="absolute top-1.5 left-8 z-20">
                            <span 
                              title={file.rejectReason || "Non accepté"}
                              className="bg-rose-700 text-white font-black text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm"
                            >
                              <X className="w-2.5 h-2.5 stroke-[3]" /> Non accepté
                            </span>
                          </div>
                        ) : isIndividual && (
                          <div className="absolute top-1.5 left-8 z-20">
                            {file.isCompleted ? (
                              <span className="bg-emerald-500 text-white font-black text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                                <Check className="w-2.5 h-2.5 stroke-[3]" /> Rempli
                              </span>
                            ) : (
                              <span className="bg-amber-500 text-stone-950 font-black text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                                <AlertCircle className="w-2.5 h-2.5 stroke-[3]" /> À remplir
                              </span>
                            )}
                          </div>
                        )}

                        {/* Remove button on hover top left */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(file.id);
                          }}
                          className="absolute top-1.5 left-1.5 z-20 w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity shadow-md cursor-pointer"
                          title="Supprimer ce fichier"
                        >
                          <X className="w-3 h-3" />
                        </button>

                        {/* Preview Thumbnail / Authentic Document Page View */}
                        <div className="flex-1 w-full flex items-center justify-center overflow-hidden rounded-lg bg-stone-900/40 relative mt-5">
                          {file.isImage && file.url ? (
                            <img src={file.url} alt={file.name} className="w-full h-full object-cover object-top" />
                          ) : file.isImage && !file.url ? (
                            <div className="w-full h-full bg-[#2A2B2E] flex flex-col items-center justify-center p-2 text-center relative overflow-hidden">
                              <div className="absolute inset-0 opacity-20 flex items-center justify-center">
                                <FileIconBadge fileName={file.name} size={72} />
                              </div>
                              <div className="z-10 flex flex-col items-center justify-center space-y-1">
                                <FileIconBadge fileName={file.name} size={48} />
                                <span className="text-[8px] font-black uppercase tracking-wider text-purple-300 bg-black/80 px-2 py-0.5 rounded border border-purple-800 shadow-sm">
                                  {file.name.split('.').pop()?.toUpperCase() || 'IMG'}
                                </span>
                              </div>
                            </div>
                          ) : file.fileTypeCategory === 'docx' ? (
                            <div className="w-full h-full bg-[#FAFAFA] p-2 flex flex-col justify-between text-stone-900 overflow-hidden relative shadow-inner">
                              <div className="flex items-center gap-1 border-b-2 border-blue-600 pb-1 mb-1">
                                <FileText className="w-3 h-3 text-blue-600 shrink-0" />
                                <span className="text-[7.5px] font-black uppercase tracking-wider text-blue-900">DOCUMENT WORD</span>
                              </div>
                              <div className="space-y-1.5 flex-1 overflow-hidden font-sans">
                                <div className="text-[9px] font-extrabold text-stone-900 leading-tight line-clamp-2">
                                  {file.textContent || file.name.replace(/\.[^/.]+$/, "")}
                                </div>
                                <div className="space-y-1 pt-0.5">
                                  <div className="h-1 bg-stone-300 rounded w-full"></div>
                                  <div className="h-1 bg-stone-300 rounded w-11/12"></div>
                                  <div className="h-1 bg-stone-200 rounded w-4/5"></div>
                                </div>
                              </div>
                            </div>
                          ) : file.fileTypeCategory === 'xlsx' && file.tableRows && file.tableRows.length > 0 ? (
                            <div className="w-full h-full bg-white p-1.5 flex flex-col justify-between text-stone-900 overflow-hidden relative shadow-inner text-[6.5px]">
                              <div className="flex items-center gap-1 border-b border-emerald-600 pb-0.5 mb-1 bg-emerald-50 px-1 rounded">
                                <Table className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                                <span className="font-black uppercase tracking-wider text-emerald-900">
                                  EXCEL
                                </span>
                              </div>
                              <div className="overflow-hidden flex-1 space-y-0.5 font-mono">
                                <table className="w-full border-collapse">
                                  <tbody>
                                    {file.tableRows.slice(0, 3).map((row: any[], rIdx: number) => (
                                      <tr key={rIdx} className={rIdx === 0 ? 'bg-emerald-600 text-white font-bold' : 'bg-white'}>
                                        {row.slice(0, 3).map((cell: any, cIdx: number) => (
                                          <td key={cIdx} className="px-1 py-0.5 border border-stone-300 truncate max-w-[35px]">
                                            {cell !== undefined && cell !== null ? String(cell) : ''}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : file.fileTypeCategory === 'pptx' ? (
                            <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 p-2 flex flex-col justify-between text-white overflow-hidden relative shadow-inner">
                              <div className="flex items-center gap-1 border-b border-white/30 pb-1">
                                <Presentation className="w-3 h-3 text-white shrink-0" />
                                <span className="text-[7.5px] font-black uppercase tracking-wider">PPT</span>
                              </div>
                              <div className="my-auto py-1 text-center space-y-1">
                                <div className="text-[8px] font-black leading-tight line-clamp-2 drop-shadow-sm">
                                  {file.textContent}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full bg-white p-2 flex flex-col justify-between text-stone-900 overflow-hidden relative shadow-inner">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 border-b border-stone-200 pb-0.5">
                                  <FileText className="w-3 h-3 text-orange-600 shrink-0" />
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-stone-600 truncate">
                                    {file.name.split('.').pop() || 'DOC'}
                                  </span>
                                </div>
                                <div className="text-[7.5px] leading-tight text-stone-700 font-mono line-clamp-4 select-none whitespace-pre-wrap">
                                  {file.textContent ? file.textContent : `Aperçu : ${file.name}...`}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* File name at bottom */}
                        <div className="mt-1.5 px-0.5">
                          <p className="text-[10px] font-bold text-stone-100 line-clamp-1 leading-tight break-all" title={file.name}>
                            {file.fileTitle || file.name}
                          </p>
                          {isDup && (
                            <p className="text-[8px] font-bold text-red-400 truncate mt-0.5" title="Un fichier a été recalé car son deuxième a été enregistré">
                              Recalé : doublon enregistré
                            </p>
                          )}
                          {isRejected && (
                            <p className="text-[8px] font-bold text-rose-300 truncate mt-0.5" title={file.rejectReason || "Non accepté"}>
                              {file.rejectReason || "Non accepté"}
                            </p>
                          )}
                        </div>

                        {/* Individual Mode action button on each card */}
                        {isIndividual && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!file.isDuplicate && !file.isRejected) openEditModal(file);
                            }}
                            className={`w-full mt-1.5 py-1 px-1 rounded text-[9px] font-black flex items-center justify-center gap-1 shadow-sm transition-all ${
                              file.isDuplicate
                                ? 'bg-red-700 text-white cursor-default'
                                : file.isRejected
                                ? 'bg-rose-800 text-white cursor-default'
                                : file.isCompleted
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                                : 'bg-amber-500 hover:bg-amber-400 text-stone-950 animate-pulse cursor-pointer'
                            }`}
                          >
                            {file.isDuplicate ? (
                              <>
                                <X className="w-2.5 h-2.5" />
                                <span>Recalé (doublon)</span>
                              </>
                            ) : file.isRejected ? (
                              <>
                                <X className="w-2.5 h-2.5" />
                                <span>Non accepté</span>
                              </>
                            ) : file.isCompleted ? (
                              <>
                                <Edit3 className="w-2.5 h-2.5" />
                                <span>Modifier</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-2.5 h-2.5 stroke-[3]" />
                                <span>Remplir les infos</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Dashed square button with plus to add more files */}
                  <label 
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        processFiles(Array.from(e.dataTransfer.files));
                      }
                    }}
                    className="aspect-[3/4] bg-white hover:bg-stone-50 border-2 border-dashed border-stone-400 hover:border-orange-600 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all shadow-[2px_2px_0px_0px_#1c1917] group"
                  >
                    <div className="w-9 h-9 rounded-full bg-orange-100 group-hover:bg-orange-200 text-orange-600 flex items-center justify-center transition-colors mb-2 shadow-sm">
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <span className="text-[10px] font-extrabold text-stone-800 text-center">Ajouter</span>
                    <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.rtf,.odt,.ods,.odp,image/*" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>

                {/* 3 Option buttons positioned right below the file cards */}
                <div className="mt-5 p-2 bg-stone-100/90 rounded-2xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInfoMode('all')}
                    className={`flex-1 min-w-[170px] py-2 px-3 rounded-xl border-2 border-stone-800 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      infoMode === 'all'
                        ? 'bg-[#2D4A3E] text-white shadow-[2px_2px_0px_0px_#1c1917]'
                        : 'bg-white text-stone-800 hover:bg-stone-50 shadow-[1px_1px_0px_0px_#1c1917]'
                    }`}
                  >
                    <span>Appliquer l'information à tous</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInfoMode('individual')}
                    className={`flex-1 min-w-[170px] py-2 px-3 rounded-xl border-2 border-stone-800 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      infoMode === 'individual'
                        ? 'bg-[#2D4A3E] text-white shadow-[2px_2px_0px_0px_#1c1917]'
                        : 'bg-white text-stone-800 hover:bg-stone-50 shadow-[1px_1px_0px_0px_#1c1917]'
                    }`}
                  >
                    <span>Informations individuelles</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                      completedCount === selectedFiles.length && selectedFiles.length > 0
                        ? 'bg-emerald-400 text-emerald-950'
                        : 'bg-amber-400 text-amber-950'
                    }`}>
                      {completedCount}/{selectedFiles.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInfoMode('none')}
                    className={`flex-1 min-w-[170px] py-2 px-3 rounded-xl border-2 border-stone-800 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      infoMode === 'none'
                        ? 'bg-[#2D4A3E] text-white shadow-[2px_2px_0px_0px_#1c1917]'
                        : 'bg-white text-stone-800 hover:bg-stone-50 shadow-[1px_1px_0px_0px_#1c1917]'
                    }`}
                  >
                    <span>Aucune information</span>
                  </button>
                </div>

                {/* Message d'erreur s'il y a lieu */}
                {publishError && (
                  <div className="mt-3 bg-red-50 border-2 border-red-600 rounded-xl p-3 text-xs text-red-700 font-bold">
                    ⚠️ {publishError}
                  </div>
                )}

                {/* Contenu conditionnel selon le mode sélectionné */}

                {/* MODE 1 : Appliquer l'information à tous */}
                {infoMode === 'all' && (
                  <div className="mt-4 pt-3 border-t-2 border-stone-300 space-y-3.5 bg-white/60 p-4 rounded-2xl border-2 border-stone-300">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-stone-800 uppercase tracking-wider">
                        Champs appliqués à tous les documents
                      </h4>
                      <span className="text-[10px] font-bold text-stone-500 italic">
                        Les champs avec astérisque (<span className="text-red-500">*</span>) sont obligatoires
                      </span>
                    </div>

                    {/* Titre et description */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> Titre du document <span className="text-red-500">*</span></span>
                          <span className="text-[10px] font-mono text-stone-400">{docTitle.length}/60</span>
                        </label>
                        <input
                          type="text"
                          maxLength={60}
                          value={docTitle}
                          onChange={(e) => setDocTitle(e.target.value)}
                          placeholder="Ex: Cours d'Électrotechnique S1..."
                          className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                            !docTitle.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                          <span>Description <span className="text-stone-400 text-[10px] font-normal">(Optionnel)</span></span>
                          <span className="text-[10px] font-mono text-stone-400">{docDescription.length}/60</span>
                        </label>
                        <input
                          type="text"
                          maxLength={60}
                          value={docDescription}
                          onChange={(e) => setDocDescription(e.target.value)}
                          placeholder="Courte description du document..."
                          className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Catégorie, Matière, Niveau */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                          <span>Catégorie <span className="text-stone-400 text-[10px] font-normal">(Optionnel)</span></span>
                          {docCategory === 'Autre' && <span className="text-[10px] font-mono text-stone-400">{customDocCategory.length}/60</span>}
                        </label>
                        <div className="space-y-1.5">
                          <select
                            value={docCategory}
                            onChange={(e) => setDocCategory(e.target.value)}
                            className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none cursor-pointer"
                          >
                            {["Pas d'informations", 'Cours', 'TD', 'TP', 'Examen', 'Résumé', 'Projet', 'Autre'].map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          {docCategory === 'Autre' && (
                            <input
                              type="text"
                              maxLength={60}
                              value={customDocCategory}
                              onChange={(e) => setCustomDocCategory(e.target.value)}
                              placeholder="Précisez la catégorie (facultatif)..."
                              className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none animate-in fade-in duration-150"
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Matière <span className="text-red-500">*</span></span>
                          <span className="text-[10px] font-mono text-stone-400">{docMatiere.length}/60</span>
                        </label>
                        <input
                          type="text"
                          maxLength={60}
                          value={docMatiere}
                          onChange={(e) => setDocMatiere(e.target.value)}
                          placeholder="Ex: Mathématiques, Physique..."
                          className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                            !docMatiere.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                          <span>Niveau <span className="text-red-500">*</span></span>
                          <span className="text-[10px] font-mono text-stone-400">{docLevel.length}/60</span>
                        </label>
                        <input
                          type="text"
                          maxLength={60}
                          value={docLevel}
                          onChange={(e) => setDocLevel(e.target.value)}
                          placeholder="Ex: BTS 1, Licence 2..."
                          className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                            !docLevel.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                          }`}
                        />
                      </div>
                    </div>

                    {/* École et Filière */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                          <span>École <span className="text-stone-400 text-[10px] font-normal">(Optionnel)</span></span>
                          <span className="text-[10px] font-mono text-stone-400">{school.length}/60</span>
                        </label>
                        <input 
                          type="text" 
                          maxLength={60}
                          value={school} 
                          onChange={(e) => setSchool(e.target.value)} 
                          placeholder="Provenance de l'école (facultatif)..."
                          className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none" 
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                          <span>Filière <span className="text-red-500">*</span></span>
                          <span className="text-[10px] font-mono text-stone-400">{filiere.length}/60</span>
                        </label>
                        <input 
                          type="text" 
                          maxLength={60}
                          value={filiere} 
                          onChange={(e) => setFiliere(e.target.value)} 
                          placeholder="Nom de la filière..."
                          className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                            !filiere.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                          }`} 
                        />
                      </div>
                    </div>

                    {/* Pays et Tags */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Pays <span className="text-red-500">*</span></span>
                          <span className="text-[10px] font-mono text-stone-400">{docCountry.length}/60</span>
                        </label>
                        <input 
                          type="text" 
                          maxLength={60}
                          value={docCountry} 
                          onChange={(e) => setDocCountry(e.target.value)} 
                          placeholder="Côte d'Ivoire..."
                          className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                            !docCountry.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                          }`} 
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Tags <span className="text-stone-400 text-[10px] font-normal">(Optionnel, séparés par virgules)</span></span>
                          <span className="text-[10px] font-mono text-stone-400">{docTags.length}/60</span>
                        </label>
                        <input 
                          type="text" 
                          maxLength={60}
                          value={docTags} 
                          onChange={(e) => setDocTags(e.target.value)} 
                          placeholder="révision, annales, circuit..."
                          className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none" 
                        />
                      </div>
                    </div>

                    {!isFormValid && (
                      <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-300 px-3 py-2 rounded-xl text-xs font-bold">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Veuillez renseigner tous les champs obligatoires (*) pour activer le bouton « Valider ».</span>
                      </div>
                    )}
                  </div>
                )}

                {/* MODE 2 : Informations individuelles (les champs du bas disparaissent pour ne pas mélanger) */}
                {infoMode === 'individual' && (
                  <div className="mt-4 bg-amber-50/80 border-2 border-amber-600 rounded-2xl p-4 sm:p-5 text-stone-900 shadow-[2px_2px_0px_0px_#d97706] space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-amber-950">Mode informations individuelles actif</h4>
                      <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${
                        completedCount === selectedFiles.length && selectedFiles.length > 0
                          ? 'bg-emerald-100 border-emerald-500 text-emerald-800'
                          : 'bg-amber-100 border-amber-500 text-amber-900'
                      }`}>
                        {completedCount} / {selectedFiles.length} fichier(s) rempli(s)
                      </span>
                    </div>

                    <p className="text-xs text-amber-900 font-medium leading-relaxed">
                      Cliquez sur chaque document ci-dessus pour renseigner ses informations propres. Dès qu'un fichier est validé, il devient <strong className="text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">vert ✅</strong>. Tous les fichiers doivent être remplis pour pouvoir valider la publication.
                    </p>

                    {/* Progress Bar */}
                    <div className="w-full bg-amber-200 h-2.5 rounded-full overflow-hidden border border-amber-400">
                      <div 
                        className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${selectedFiles.length > 0 ? (completedCount / selectedFiles.length) * 100 : 0}%` }}
                      />
                    </div>

                    {completedCount === selectedFiles.length && selectedFiles.length > 0 ? (
                      <div className="flex items-center gap-1.5 text-emerald-800 font-black text-xs pt-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Tous les documents sont prêts ! Vous pouvez cliquer sur « Valider » en haut à droite.</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs pt-1">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Il reste {selectedFiles.length - completedCount} document(s) à renseigner.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* MODE 3 : Aucune information (les champs disparaissent sauf description facultative) */}
                {infoMode === 'none' && (
                  <div className="mt-4 bg-emerald-50/80 border-2 border-emerald-600 rounded-2xl p-4 sm:p-5 text-emerald-950 shadow-[2px_2px_0px_0px_#059669] space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <h4 className="text-sm font-black">Mode sans information complémentaire</h4>
                    </div>
                    <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                      Le nom réel de chaque fichier sera automatiquement enregistré comme titre du document. Vous pouvez ajouter une description facultative ci-dessous ou directement cliquer sur <strong>« Valider ({selectedFiles.length}) »</strong> en haut à droite pour publier.
                    </p>

                    {/* Champ Description facultatif (60 caractères max) */}
                    <div className="pt-2 border-t border-emerald-300/80">
                      <label className="block text-[11px] font-bold text-emerald-900 mb-1 flex items-center justify-between">
                        <span>Description <span className="text-emerald-700 text-[10px] font-normal">(Facultatif)</span></span>
                        <span className="text-[10px] font-mono text-emerald-800">{docDescription.length}/60</span>
                      </label>
                      <input 
                        type="text"
                        maxLength={60}
                        value={docDescription} 
                        onChange={(e) => setDocDescription(e.target.value)} 
                        placeholder="Courte description facultative pour ces documents..."
                        className="w-full bg-white border-2 border-emerald-700 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#059669] focus:outline-none" 
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
      </div>

      {/* Modal Popup pour l'édition individuelle d'un fichier */}
      {editingFileId && activeEditingFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#FDFBF7] border-2 border-stone-900 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-[5px_5px_0px_0px_#1c1917] max-h-[90vh] overflow-y-auto space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b-2 border-stone-200 pb-3">
              <div>
                <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-orange-600" />
                  Renseigner les informations du fichier
                </h3>
                <p className="text-[11px] text-stone-500 font-mono truncate max-w-xs mt-0.5" title={activeEditingFile.name}>
                  Fichier : {activeEditingFile.name} ({formatSize(activeEditingFile.size)})
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="w-7 h-7 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="space-y-3">
              {/* Titre */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> Titre du document <span className="text-red-500">*</span></span>
                  <span className="text-[10px] font-mono text-stone-400">{modalTitle.length}/60</span>
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="Titre de ce document..."
                  className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                    !modalTitle.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                  }`}
                />
              </div>

              {/* Catégorie & Matière */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                    <span>Catégorie <span className="text-stone-400 text-[10px] font-normal">(Optionnel)</span></span>
                    {modalCategory === 'Autre' && <span className="text-[10px] font-mono text-stone-400">{customModalCategory.length}/60</span>}
                  </label>
                  <div className="space-y-1.5">
                    <select
                      value={modalCategory}
                      onChange={(e) => setModalCategory(e.target.value)}
                      className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none cursor-pointer"
                    >
                      {["Pas d'informations", 'Cours', 'TD', 'TP', 'Examen', 'Résumé', 'Projet', 'Autre'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {modalCategory === 'Autre' && (
                      <input
                        type="text"
                        maxLength={60}
                        value={customModalCategory}
                        onChange={(e) => setCustomModalCategory(e.target.value)}
                        placeholder="Précisez la catégorie (facultatif)..."
                        className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none animate-in fade-in duration-150"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Matière <span className="text-red-500">*</span></span>
                    <span className="text-[10px] font-mono text-stone-400">{modalMatiere.length}/60</span>
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={modalMatiere}
                    onChange={(e) => setModalMatiere(e.target.value)}
                    placeholder="Ex: Mathématiques..."
                    className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                      !modalMatiere.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                    }`}
                  />
                </div>
              </div>

              {/* Niveau & École */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                    <span>Niveau <span className="text-red-500">*</span></span>
                    <span className="text-[10px] font-mono text-stone-400">{modalLevel.length}/60</span>
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={modalLevel}
                    onChange={(e) => setModalLevel(e.target.value)}
                    placeholder="Ex: BTS 1, Licence 2..."
                    className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                      !modalLevel.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                    <span>École <span className="text-stone-400 text-[10px] font-normal">(Optionnel)</span></span>
                    <span className="text-[10px] font-mono text-stone-400">{modalSchool.length}/60</span>
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={modalSchool}
                    onChange={(e) => setModalSchool(e.target.value)}
                    placeholder="Provenance de l'école (facultatif)..."
                    className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none"
                  />
                </div>
              </div>

              {/* Filière & Pays */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                    <span>Filière <span className="text-red-500">*</span></span>
                    <span className="text-[10px] font-mono text-stone-400">{modalFiliere.length}/60</span>
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={modalFiliere}
                    onChange={(e) => setModalFiliere(e.target.value)}
                    placeholder="Nom de la filière..."
                    className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                      !modalFiliere.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Pays <span className="text-red-500">*</span></span>
                    <span className="text-[10px] font-mono text-stone-400">{modalCountry.length}/60</span>
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={modalCountry}
                    onChange={(e) => setModalCountry(e.target.value)}
                    placeholder="Côte d'Ivoire..."
                    className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                      !modalCountry.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                    }`}
                  />
                </div>
              </div>

              {/* Description & Tags */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                  <span>Description <span className="text-stone-400 text-[10px] font-normal">(Optionnel)</span></span>
                  <span className="text-[10px] font-mono text-stone-400">{modalDescription.length}/60</span>
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  placeholder="Courte description de ce document..."
                  className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Tags <span className="text-stone-400 text-[10px] font-normal">(Optionnel, séparés par virgules)</span></span>
                  <span className="text-[10px] font-mono text-stone-400">{modalTags.length}/60</span>
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={modalTags}
                  onChange={(e) => setModalTags(e.target.value)}
                  placeholder="révision, examen, td..."
                  className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-stone-200">
              <button
                type="button"
                onClick={closeEditModal}
                className="px-3.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={saveEditModal}
                disabled={!isModalFormValid}
                className={`flex items-center gap-1.5 px-4 py-1.5 font-bold text-xs rounded-xl border-2 transition-all ${
                  isModalFormValid
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer'
                    : 'bg-stone-300 text-stone-500 border-stone-400 cursor-not-allowed shadow-none'
                }`}
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Valider pour ce document</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publishing loading modal overlay with progress */}
      {isPublishing && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FDFBF7] border-2 border-stone-900 rounded-2xl p-6 sm:p-7 text-center space-y-4 shadow-[5px_5px_0px_0px_#1c1917] max-w-sm w-full animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 border-2 border-stone-900 flex items-center justify-center mx-auto text-emerald-800 shadow-[2px_2px_0px_0px_#1c1917]">
              <RefreshCw className="w-7 h-7 text-emerald-700 animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-stone-900">Publication en cours...</h3>
              <p className="text-xs text-stone-600">
                {publishingProgress 
                  ? `Traitement du document ${publishingProgress.current}/${publishingProgress.total} :`
                  : "Traitement et validation en cours..."}
              </p>
              {publishingProgress?.currentFileName && (
                <p className="text-[11px] font-mono font-bold text-emerald-900 truncate bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300 shadow-xs">
                  {publishingProgress.currentFileName}
                </p>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full bg-stone-200 h-2.5 rounded-full overflow-hidden border border-stone-400">
              <div 
                className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${publishingProgress ? (publishingProgress.current / publishingProgress.total) * 100 : 25}%` }}
              />
            </div>

            <p className="text-[10px] text-stone-500 font-medium leading-relaxed">
              Veuillez patienter pendant la validation et l'enregistrement de vos documents.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
