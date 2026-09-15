import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Upload, CheckCircle2, X, FileText, Table, Presentation, Plus, 
  RefreshCw, Globe, Tag, GraduationCap, BookOpen, Check, Edit3, AlertCircle, Sparkles 
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

interface PublishFileViewProps {
  onBack: () => void;
  onPublish?: (title: string, description: string, category: string, files: any[]) => void;
}

export const PublishFileView: React.FC<PublishFileViewProps> = ({ onBack, onPublish }) => {
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
  const [docCategory, setDocCategory] = useState(() => localStorage.getItem('published_doc_category') || 'Cours');
  const [docMatiere, setDocMatiere] = useState(() => localStorage.getItem('published_doc_matiere') || '');
  const [docLevel, setDocLevel] = useState(() => localStorage.getItem('published_doc_level') || '');
  const [docCountry, setDocCountry] = useState(() => localStorage.getItem('published_doc_country') || localStorage.getItem('user_country') || "Côte d'Ivoire");
  const [docTags, setDocTags] = useState(() => localStorage.getItem('published_doc_tags') || '');

  // État du modal d'édition individuelle
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalCategory, setModalCategory] = useState('Cours');
  const [modalMatiere, setModalMatiere] = useState('');
  const [modalLevel, setModalLevel] = useState('');
  const [modalSchool, setModalSchool] = useState('');
  const [modalFiliere, setModalFiliere] = useState('');
  const [modalCountry, setModalCountry] = useState("Côte d'Ivoire");
  const [modalDescription, setModalDescription] = useState('');
  const [modalTags, setModalTags] = useState('');

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishingProgress, setPublishingProgress] = useState<{ current: number; total: number; currentFileName: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

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

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('published_school', school);
      localStorage.setItem('published_filiere', filiere);
      localStorage.setItem('published_info_mode', infoMode);
      localStorage.setItem('published_doc_title', docTitle);
      localStorage.setItem('published_doc_description', docDescription);
      localStorage.setItem('published_doc_category', docCategory);
      localStorage.setItem('published_doc_matiere', docMatiere);
      localStorage.setItem('published_doc_level', docLevel);
      localStorage.setItem('published_doc_country', docCountry);
      localStorage.setItem('published_doc_tags', docTags);
    } catch (e) {
      console.error(e);
    }
  }, [school, filiere, infoMode, docTitle, docDescription, docCategory, docMatiere, docLevel, docCountry, docTags]);

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
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const processFiles = (filesArray: File[]) => {
    filesArray.forEach((file: any) => {
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
        fileCategory: docCategory || 'Cours',
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
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
    localStorage.removeItem('published_selected_files');
    localStorage.removeItem('published_school');
    localStorage.removeItem('published_filiere');
    localStorage.removeItem('published_doc_title');
    localStorage.removeItem('published_doc_description');
    localStorage.removeItem('published_doc_category');
    localStorage.removeItem('published_doc_matiere');
    localStorage.removeItem('published_doc_level');
    localStorage.removeItem('published_doc_country');
    localStorage.removeItem('published_doc_tags');
    onBack();
  };

  // Gestion de la modale individuelle
  const openEditModal = (file: any) => {
    setEditingFileId(file.id);
    setModalTitle(file.fileTitle || file.name.replace(/\.[^/.]+$/, '').replace(/[_-_]/g, ' '));
    setModalCategory(file.fileCategory || docCategory || 'Cours');
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
    modalTitle.trim().length > 0 &&
    modalCategory.trim().length > 0 &&
    modalMatiere.trim().length > 0 &&
    modalLevel.trim().length > 0 &&
    modalSchool.trim().length > 0 &&
    modalFiliere.trim().length > 0 &&
    modalCountry.trim().length > 0;

  const saveEditModal = () => {
    if (!editingFileId || !isModalFormValid) return;
    setSelectedFiles(prev => prev.map(f => {
      if (f.id === editingFileId) {
        return {
          ...f,
          fileTitle: modalTitle.trim(),
          fileCategory: modalCategory.trim(),
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

    if (infoMode === 'all') {
      // Tous les champs obligatoires sauf Description et Tags
      return (
        docTitle.trim().length > 0 &&
        docCategory.trim().length > 0 &&
        docMatiere.trim().length > 0 &&
        docLevel.trim().length > 0 &&
        school.trim().length > 0 &&
        filiere.trim().length > 0 &&
        docCountry.trim().length > 0
      );
    }

    if (infoMode === 'individual') {
      // Tous les fichiers de la sélection doivent être validés individuellement
      return selectedFiles.length > 0 && selectedFiles.every(f => f.isCompleted === true);
    }

    if (infoMode === 'none') {
      // Aucun champ requis, le bouton devient valide immédiatement
      return selectedFiles.length > 0;
    }

    return false;
  })();

  const handlePublishAll = async () => {
    if (!isFormValid || selectedFiles.length === 0 || isPublishing) return;
    setIsPublishing(true);
    setPublishError(null);

    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    const userName = localStorage.getItem('unifolder_user_name') || 'Étudiant';

    try {
      let fileIndex = 0;
      for (const file of selectedFiles) {
        fileIndex++;
        setPublishingProgress({
          current: fileIndex,
          total: selectedFiles.length,
          currentFileName: file.name
        });

        let title = '';
        let fileSchool = '';
        let fileFiliere = '';
        let category = 'Cours';
        let matiereName = '';
        let level = '';
        let country = docCountry || "Côte d'Ivoire";
        let description = '';
        let tagsArray: string[] = [];

        if (infoMode === 'all') {
          title = docTitle.trim() || file.name.replace(/\.[^/.]+$/, '');
          fileSchool = school.trim();
          fileFiliere = filiere.trim();
          category = docCategory.trim() || 'Cours';
          matiereName = docMatiere.trim();
          level = docLevel.trim();
          country = docCountry.trim() || "Côte d'Ivoire";
          description = docDescription.trim();
          tagsArray = docTags ? docTags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
        } else if (infoMode === 'individual') {
          title = file.fileTitle?.trim() || file.name.replace(/\.[^/.]+$/, '');
          fileSchool = file.fileSchool?.trim() || '';
          fileFiliere = file.fileFiliere?.trim() || '';
          category = file.fileCategory?.trim() || 'Cours';
          matiereName = file.fileMatiere?.trim() || '';
          level = file.fileLevel?.trim() || '';
          country = file.fileCountry?.trim() || docCountry || "Côte d'Ivoire";
          description = file.fileDescription?.trim() || '';
          tagsArray = file.fileTags ? file.fileTags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
        } else {
          // infoMode === 'none' : c'est le nom du fichier lui-même qui est enregistré
          title = file.name.replace(/\.[^/.]+$/, '');
          fileSchool = '';
          fileFiliere = '';
          category = 'Cours';
          matiereName = '';
          level = '';
          country = docCountry || "Côte d'Ivoire";
          description = '';
          tagsArray = [];
        }

        // Tenter d'uploader vers R2 si le fichier brut est disponible (avec compression gzip intelligente automatique)
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
          }
        } catch (uploadErr) {
          console.warn('Upload R2 échoué (mode local):', uploadErr);
        }

        await StudyCloudAPI.publishDocument({
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
      }

      // Nettoyer IndexedDB et le localStorage
      clearAllPersistedFiles();
      ['published_selected_files','published_school','published_filiere','published_info_mode',
       'published_doc_title','published_doc_description','published_doc_category',
       'published_doc_matiere','published_doc_level','published_doc_country','published_doc_tags'
      ].forEach(k => localStorage.removeItem(k));

      setPublishingProgress(null);
      setIsPublishing(false);
      setSuccess(true);

      if (onPublish) {
        onPublish(
          infoMode === 'all' ? docTitle : selectedFiles[0]?.name || 'Document partagé',
          docDescription || '',
          docCategory || 'Cours',
          selectedFiles
        );
      }

      setTimeout(() => { onBack(); }, 1500);
    } catch (err: any) {
      console.error('Erreur lors de la publication:', err);
      setPublishError(err.message || 'Erreur lors de la publication. Vérifiez la connexion au Worker.');
      setIsPublishing(false);
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
          <p className="text-sm font-bold text-emerald-100 mt-1">PDF, Word, Excel, PPT, images... ils seront ajoutés automatiquement à la publication</p>
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
            <input type="file" multiple onChange={handleFileChange} className="hidden" />
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
                  ? 'Compression & envoi...'
                  : infoMode === 'individual'
                  ? `Valider (${completedCount}/${selectedFiles.length})`
                  : `Valider (${selectedFiles.length})`}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto pt-16 pb-24">
        {success ? (
          <div className="bg-emerald-50 border-2 border-emerald-600 rounded-2xl p-6 text-center space-y-2 shadow-[3px_3px_0px_0px_#047857] w-full max-w-lg mx-auto mt-20">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h2 className="text-base font-black text-emerald-900">Fichiers publiés avec succès !</h2>
            <p className="text-xs text-emerald-700">Vos documents ont été compressés, stockés et partagés.</p>
          </div>
        ) : (
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
                  <span className="text-xs text-stone-500 mt-1">PDF, Word, Excel, PPT, images...</span>
                  <input type="file" multiple onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            ) : (
              <div>
                {/* Badge d'indication de compression intelligente */}
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-[11px] font-bold w-fit mb-2 shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Compression intelligente R2 active : vos fichiers sont optimisés en arrière-plan</span>
                </div>

                {/* File Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-3.5 mt-2">
                  {selectedFiles.map((file) => {
                    const isIndividual = infoMode === 'individual';
                    const isGreen = isIndividual && file.isCompleted;

                    return (
                      <div
                        key={file.id}
                        onClick={() => {
                          if (isIndividual) {
                            openEditModal(file);
                          }
                        }}
                        className={`aspect-[3/4] rounded-xl p-2.5 flex flex-col justify-between shadow-[2px_2px_0px_0px_#1c1917] relative group select-none overflow-hidden transition-all ${
                          isIndividual ? 'cursor-pointer hover:scale-[1.02]' : ''
                        } ${
                          isGreen
                            ? 'bg-[#18392b] border-2 border-emerald-400 ring-2 ring-emerald-500/50'
                            : isIndividual
                            ? 'bg-[#2A2B2E] border-2 border-amber-500 hover:border-amber-400'
                            : 'bg-[#2A2B2E] border-2 border-stone-800'
                        }`}
                      >
                        {/* File size badge in top right */}
                        <div className="absolute top-1.5 right-1.5 z-20 bg-black/80 backdrop-blur-sm text-stone-200 font-bold text-[8px] px-1.5 py-0.5 rounded border border-stone-700 shadow-sm">
                          {formatSize(file.size)}
                        </div>

                        {/* Status Badge in individual mode */}
                        {isIndividual && (
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
                        <div className="flex-1 w-full flex items-center justify-center overflow-hidden rounded-lg bg-[#1E1F22] relative mt-5">
                          {file.isImage && file.url ? (
                            <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
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
                        </div>

                        {/* Individual Mode action button on each card */}
                        {isIndividual && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(file);
                            }}
                            className={`w-full mt-1.5 py-1 px-1 rounded text-[9px] font-black flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer ${
                              file.isCompleted
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-amber-500 hover:bg-amber-400 text-stone-950 animate-pulse'
                            }`}
                          >
                            {file.isCompleted ? (
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
                    <input type="file" multiple onChange={handleFileChange} className="hidden" />
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
                      <h4 className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                        Champs appliqués à tous les documents
                      </h4>
                      <span className="text-[10px] font-bold text-stone-500 italic">
                        Les champs avec astérisque (<span className="text-red-500">*</span>) sont obligatoires
                      </span>
                    </div>

                    {/* Titre et description */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> Titre du document <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={docTitle}
                          onChange={(e) => setDocTitle(e.target.value)}
                          placeholder="Ex: Cours d'Électrotechnique S1..."
                          className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                            !docTitle.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          Description <span className="text-stone-400 text-[10px] font-normal">(Optionnel)</span>
                        </label>
                        <input
                          type="text"
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
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          Catégorie <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={docCategory}
                          onChange={(e) => setDocCategory(e.target.value)}
                          className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none cursor-pointer"
                        >
                          {['Cours', 'TD', 'TP', 'Examen', 'Résumé', 'Projet'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" /> Matière <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={docMatiere}
                          onChange={(e) => setDocMatiere(e.target.value)}
                          placeholder="Ex: Mathématiques, Physique..."
                          className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                            !docMatiere.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          Niveau <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
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
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          École <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="text" 
                          value={school} 
                          onChange={(e) => setSchool(e.target.value)} 
                          placeholder="Provenance de l'école..."
                          className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                            !school.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                          }`} 
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          Filière <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="text" 
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
                        <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Pays <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="text" 
                          value={docCountry} 
                          onChange={(e) => setDocCountry(e.target.value)} 
                          placeholder="Côte d'Ivoire..."
                          className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                            !docCountry.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                          }`} 
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                          <Tag className="w-3 h-3" /> Tags <span className="text-stone-400 text-[10px] font-normal">(Optionnel, séparés par virgules)</span>
                        </label>
                        <input 
                          type="text" 
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
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-700" />
                        <h4 className="text-sm font-black text-amber-950">Mode informations individuelles actif</h4>
                      </div>
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

                {/* MODE 3 : Aucune information (les champs disparaissent, bouton immédiatement actif) */}
                {infoMode === 'none' && (
                  <div className="mt-4 bg-emerald-50/80 border-2 border-emerald-600 rounded-2xl p-4 sm:p-5 text-emerald-950 shadow-[2px_2px_0px_0px_#059669] space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <h4 className="text-sm font-black">Mode sans information complémentaire</h4>
                    </div>
                    <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                      Tous les champs sont masqués. Le nom réel de chaque fichier sera automatiquement enregistré comme titre du document. Vous pouvez directement cliquer sur le bouton <strong>« Valider ({selectedFiles.length}) »</strong> en haut à droite pour publier.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
                <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> Titre du document <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
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
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Catégorie <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={modalCategory}
                    onChange={(e) => setModalCategory(e.target.value)}
                    className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none cursor-pointer"
                  >
                    {['Cours', 'TD', 'TP', 'Examen', 'Résumé', 'Projet'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" /> Matière <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
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
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Niveau <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={modalLevel}
                    onChange={(e) => setModalLevel(e.target.value)}
                    placeholder="Ex: BTS 1, Licence 2..."
                    className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                      !modalLevel.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    École <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={modalSchool}
                    onChange={(e) => setModalSchool(e.target.value)}
                    placeholder="Provenance de l'école..."
                    className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                      !modalSchool.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                    }`}
                  />
                </div>
              </div>

              {/* Filière & Pays */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Filière <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={modalFiliere}
                    onChange={(e) => setModalFiliere(e.target.value)}
                    placeholder="Nom de la filière..."
                    className={`w-full bg-white border-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none ${
                      !modalFiliere.trim() ? 'border-red-400 bg-red-50/20' : 'border-stone-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Pays <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
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
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Description <span className="text-stone-400 text-[10px] font-normal">(Optionnel)</span>
                </label>
                <input
                  type="text"
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  placeholder="Courte description de ce document..."
                  className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-900 shadow-[2px_2px_0px_0px_#1c1917] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Tags <span className="text-stone-400 text-[10px] font-normal">(Optionnel, séparés par virgules)</span>
                </label>
                <input
                  type="text"
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

      {/* Publishing loading modal overlay with compression info and progress */}
      {isPublishing && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FDFBF7] border-2 border-stone-900 rounded-2xl p-6 sm:p-7 text-center space-y-4 shadow-[5px_5px_0px_0px_#1c1917] max-w-sm w-full animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 border-2 border-stone-900 flex items-center justify-center mx-auto text-emerald-800 shadow-[2px_2px_0px_0px_#1c1917]">
              <RefreshCw className="w-7 h-7 text-emerald-700 animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-stone-900">Compression & Publication</h3>
              <p className="text-xs text-stone-600">
                {publishingProgress 
                  ? `Traitement du document ${publishingProgress.current}/${publishingProgress.total} :`
                  : "Optimisation et stockage en cours..."}
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
              ⚡ Compression intelligente R2 : vos documents sont allégés en arrière-plan sans perte de qualité.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
