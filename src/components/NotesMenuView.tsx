import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, X, Trash2, Image as ImageIcon, Pin, Palette, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { triggerDebouncedCloudBackup, getCurrentUserId } from '../services/userSync';
import { StudyCloudAPI } from '../services/api';
import { useNotesQuery } from '../hooks/useCloudQueries';
import { invalidateCloudQueries } from '../services/queryClient';
import { safeLocalStorageSet, safeLocalStorageGet } from '../utils/safeStorage';
import { compressNoteImage } from '../services/imageUtils';

interface NotesMenuViewProps {
  onBack: () => void;
}

interface NoteItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  isPinned?: boolean;
  color?: string;
  imageUrl?: string;
  date?: string;
}

const COLOR_OPTIONS = [
  { id: 'dark-gray', bg: '#25272C', label: 'Noir/Gris' },
  { id: 'dark-blue', bg: '#1E293B', label: 'Bleu' },
  { id: 'dark-green', bg: '#14532D', label: 'Vert' },
  { id: 'dark-red', bg: '#7F1D1D', label: 'Rouge' },
  { id: 'dark-purple', bg: '#581C87', label: 'Violet' },
  { id: 'amber', bg: '#78350F', label: 'Ambre' },
];

interface DragState {
  note: NoteItem;
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export const NotesMenuView: React.FC<NotesMenuViewProps> = ({ onBack }) => {
  const userId = getCurrentUserId() || (typeof window !== 'undefined' ? localStorage.getItem('unifolder_user_id') : null) || 'default-user';

  // Synchronisation TanStack Query avec Cloudflare D1
  const { data: serverNotes } = useNotesQuery(userId);

  // État local des notes (avec fallback sécurisé sans QuotaExceededError)
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    const saved = safeLocalStorageGet<NoteItem[]>('unifolder_keep_notes', []);
    if (Array.isArray(saved) && saved.length > 0) {
      return saved.map((item: NoteItem) => ({
        ...item,
        color: item.color && item.color !== '#FDFBF7' ? item.color : '#25272C'
      }));
    }
    return [];
  });

  // Mode: 'list' ou 'editor'
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Mémorisation de l'état initial lors de l'ouverture pour détecter les changements exacts
  const originalNoteRef = useRef<{
    title: string;
    content: string;
    color: string;
    isPinned: boolean;
    imageUrl?: string;
  } | null>(null);

  // Drag and Drop state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const longPressTimerRef = useRef<any>(null);
  const lastSwapTimeRef = useRef<number>(0);
  const pointerDownRef = useRef<{
    x: number;
    y: number;
    currentX: number;
    currentY: number;
    note: NoteItem;
    cardRect: DOMRect;
    isDragging: boolean;
  } | null>(null);

  // Formulaire d'édition
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorColor, setEditorColor] = useState('#25272C');
  const [editorPinned, setEditorPinned] = useState(false);
  const [editorImage, setEditorImage] = useState<string | undefined>(undefined);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Mise à jour de l'état local dès que TanStack Query charge les données serveur
  useEffect(() => {
    if (serverNotes && Array.isArray(serverNotes) && viewMode !== 'editor') {
      const mapped: NoteItem[] = serverNotes.map((row: any) => ({
        id: row.id,
        title: row.title || '',
        content: row.content || '',
        color: row.color && row.color !== '#FDFBF7' ? row.color : '#25272C',
        isPinned: Boolean(row.is_pinned),
        imageUrl: row.image_url || undefined,
        createdAt: row.created_at || new Date().toISOString(),
      }));
      setNotes(mapped);
      safeLocalStorageSet('unifolder_keep_notes', mapped);
    }
  }, [serverNotes, viewMode]);

  // Synchronisation ref
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  // Empêcher le scroll intempestif pendant le drag
  useEffect(() => {
    const preventTouchScroll = (e: TouchEvent) => {
      if (pointerDownRef.current?.isDragging) {
        if (e.cancelable) e.preventDefault();
      }
    };

    window.addEventListener('touchmove', preventTouchScroll, { passive: false });
    return () => {
      window.removeEventListener('touchmove', preventTouchScroll);
    };
  }, []);

  // Gestion du pointer global pour le réarrangement fluide
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      const p = pointerDownRef.current;
      if (!p) return;

      p.currentX = e.clientX;
      p.currentY = e.clientY;

      const deltaX = Math.abs(e.clientX - p.x);
      const deltaY = Math.abs(e.clientY - p.y);

      if (!p.isDragging && (deltaX > 5 || deltaY > 5)) {
        if (e.pointerType === 'mouse') {
          p.isDragging = true;
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          setDragState({
            note: p.note,
            x: p.currentX,
            y: p.currentY,
            width: p.cardRect.width,
            height: p.cardRect.height,
            offsetX: p.x - p.cardRect.left,
            offsetY: p.y - p.cardRect.top,
          });
        } else {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }
      }

      if (p.isDragging) {
        setDragState(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);

        if (listContainerRef.current) {
          const container = listContainerRef.current;
          const viewportHeight = window.innerHeight;
          const threshold = 110;
          if (e.clientY > viewportHeight - threshold) {
            container.scrollTop += 12;
          } else if (e.clientY < threshold) {
            container.scrollTop -= 12;
          }
        }

        const now = Date.now();
        if (now - lastSwapTimeRef.current > 160) {
          const element = document.elementFromPoint(e.clientX, e.clientY);
          const cardElement = element?.closest('[data-note-id]');
          if (cardElement) {
            const targetId = cardElement.getAttribute('data-note-id');
            if (targetId && targetId !== p.note.id) {
              const rect = cardElement.getBoundingClientRect();
              const cursorY = e.clientY;

              setNotes(prevNotes => {
                const fromIndex = prevNotes.findIndex(n => n.id === p.note.id);
                const toIndex = prevNotes.findIndex(n => n.id === targetId);
                if (fromIndex < 0 || toIndex < 0) return prevNotes;

                const isMovingDown = fromIndex < toIndex;
                const isMovingUp = fromIndex > toIndex;

                if (isMovingDown && cursorY < rect.top + rect.height * 0.25) {
                  return prevNotes;
                }
                if (isMovingUp && cursorY > rect.bottom - rect.height * 0.25) {
                  return prevNotes;
                }

                lastSwapTimeRef.current = Date.now();
                const newNotes = [...prevNotes];
                const [movedItem] = newNotes.splice(fromIndex, 1);
                newNotes.splice(toIndex, 0, movedItem);
                safeLocalStorageSet('unifolder_keep_notes', newNotes);
                return newNotes;
              });
            }
          }
        }
      }
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const p = pointerDownRef.current;
      if (p) {
        const deltaX = Math.abs(p.currentX - p.x);
        const deltaY = Math.abs(p.currentY - p.y);

        if (!p.isDragging && deltaX < 8 && deltaY < 8) {
          openEditNote(p.note);
        }
      }
      pointerDownRef.current = null;
      setDragState(null);
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);

    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, []);

  const handlePointerDownCard = (e: React.PointerEvent, note: NoteItem) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const cardElem = e.currentTarget as HTMLElement;
    const rect = cardElem.getBoundingClientRect();

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    const initialInfo = {
      x: e.clientX,
      y: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      note,
      cardRect: rect,
      isDragging: false,
    };

    pointerDownRef.current = initialInfo;

    longPressTimerRef.current = setTimeout(() => {
      const p = pointerDownRef.current;
      if (p && !p.isDragging) {
        const deltaX = Math.abs(p.currentX - p.x);
        const deltaY = Math.abs(p.currentY - p.y);

        if (deltaX < 10 && deltaY < 10) {
          p.isDragging = true;
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(35); } catch (e) {}
          }

          const initialDragState: DragState = {
            note: p.note,
            x: p.currentX,
            y: p.currentY,
            width: p.cardRect.width,
            height: p.cardRect.height,
            offsetX: p.x - p.cardRect.left,
            offsetY: p.y - p.cardRect.top,
          };
          setDragState(initialDragState);
        }
      }
    }, 380);
  };

  const openCreateNote = () => {
    setActiveNote(null);
    setEditorTitle('');
    setEditorContent('');
    setEditorColor('#25272C');
    setEditorPinned(false);
    setEditorImage(undefined);
    setShowColorPicker(false);
    originalNoteRef.current = null;
    setViewMode('editor');
  };

  const openEditNote = (note: NoteItem) => {
    setActiveNote(note);
    setEditorTitle(note.title);
    setEditorContent(note.content);
    const initialColor = note.color || '#25272C';
    setEditorColor(initialColor);
    const initialPinned = !!note.isPinned;
    setEditorPinned(initialPinned);
    setEditorImage(note.imageUrl);
    setShowColorPicker(false);

    // Mémoriser l'état d'ouverture pour comparaison lors de la sortie
    originalNoteRef.current = {
      title: note.title,
      content: note.content,
      color: initialColor,
      isPinned: initialPinned,
      imageUrl: note.imageUrl,
    };

    setViewMode('editor');
  };

  /**
   * Sortie du bloc-notes : Détecte précisément s'il y a eu des changements.
   * Si OUI -> Enregistrement / mise à jour dans la base de données D1.
   * Si NON -> Aucun enregistrement superflu dans la base de données.
   */
  const handleSaveAndBack = () => {
    setShowColorPicker(false);

    if (activeNote) {
      // Vérifier s'il y a eu des modifications par rapport à l'ouverture
      const hasChanged =
        !originalNoteRef.current ||
        originalNoteRef.current.title !== editorTitle ||
        originalNoteRef.current.content !== editorContent ||
        originalNoteRef.current.color !== editorColor ||
        originalNoteRef.current.isPinned !== editorPinned ||
        originalNoteRef.current.imageUrl !== editorImage;

      if (hasChanged) {
        const updatedNote: NoteItem = {
          ...activeNote,
          title: editorTitle,
          content: editorContent,
          color: editorColor,
          isPinned: editorPinned,
          imageUrl: editorImage,
        };

        const updatedList = notes.map((n) => (n.id === activeNote.id ? updatedNote : n));
        setNotes(updatedList);
        safeLocalStorageSet('unifolder_keep_notes', updatedList);

        // Mise à jour dans la base de données Cloudflare D1
        StudyCloudAPI.saveNote({
          id: updatedNote.id,
          userId,
          title: updatedNote.title,
          content: updatedNote.content,
          color: updatedNote.color,
          isPinned: updatedNote.isPinned,
          imageUrl: updatedNote.imageUrl,
        })
          .then(() => {
            invalidateCloudQueries.notes();
          })
          .catch((err) => console.error('[Notes] Erreur lors de la mise à jour D1:', err));
      }
      // Si aucun changement : pas d'enregistrement, retour direct
    } else {
      // Création d'une nouvelle note : enregistrer uniquement si du contenu a été saisi
      const hasContent = Boolean(editorTitle.trim() || editorContent.trim() || editorImage);
      if (hasContent) {
        const newNote: NoteItem = {
          id: 'note-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8),
          title: editorTitle,
          content: editorContent,
          color: editorColor,
          isPinned: editorPinned,
          imageUrl: editorImage,
          createdAt: new Date().toISOString(),
        };

        const updatedList = [newNote, ...notes];
        setNotes(updatedList);
        safeLocalStorageSet('unifolder_keep_notes', updatedList);

        // Enregistrement dans la base de données Cloudflare D1
        StudyCloudAPI.saveNote({
          id: newNote.id,
          userId,
          title: newNote.title,
          content: newNote.content,
          color: newNote.color,
          isPinned: newNote.isPinned,
          imageUrl: newNote.imageUrl,
        })
          .then(() => {
            invalidateCloudQueries.notes();
          })
          .catch((err) => console.error('[Notes] Erreur lors de la création D1:', err));
      }
    }

    setViewMode('list');
  };

  const deleteNoteAndSendToTrash = (id: string) => {
    const noteToDelete = notes.find((n) => n.id === id);
    if (noteToDelete) {
      try {
        const trashList = safeLocalStorageGet<any[]>('studycloud_trash_files', []);
        const trashItem = {
          id: noteToDelete.id,
          name: `${noteToDelete.title || 'Note sans titre'}.txt`,
          size: `${Math.max(1, Math.round((noteToDelete.content || '').length / 100))} Ko`,
          date: noteToDelete.date || "Aujourd'hui",
          source: 'Bloc-notes',
          category: 'documents',
          extension: 'txt',
          isNotepad: true,
          content: noteToDelete.content,
        };
        safeLocalStorageSet('studycloud_trash_files', [
          trashItem,
          ...trashList.filter((t: any) => t.id !== id),
        ]);
      } catch {}
    }

    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    safeLocalStorageSet('unifolder_keep_notes', updated);

    // Suppression dans la base de données D1
    StudyCloudAPI.deleteNote(id)
      .then(() => {
        invalidateCloudQueries.notes();
      })
      .catch((e) => console.error('[Notes] Erreur suppression D1:', e));
  };

  const handleDeleteNote = (id: string) => {
    deleteNoteAndSendToTrash(id);
    setViewMode('list');
  };

  // Téléversement d'image avec compression automatique (résolution adaptée et poids < 50 Ko)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const compressed = await compressNoteImage(file, 800, 800, 0.75);
        setEditorImage(compressed);
      } catch (err) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setEditorImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const pinnedNotes = notes.filter((n) => n.isPinned);
  const unpinnedNotes = notes.filter((n) => !n.isPinned);

  // ---------------- RENDER MAIN NOTES LIST VIEW & FULL NOTE EDITOR PAGE ----------------
  return (
    <>
      <div 
        style={{ backgroundColor: editorColor }}
        className={`absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 w-full md:w-[calc(100%-16rem)] text-white overflow-y-auto flex-col min-h-[calc(100vh-66px)] select-none transition-all duration-300 ease-in-out flex ${viewMode === 'editor' ? 'opacity-100 z-30 visible' : 'opacity-0 -z-50 invisible pointer-events-none'}`}
      >
        {/* Floating Fixed Buttons Toolbar */}
        <div className="fixed top-[66px] md:top-[70px] left-4 right-4 md:left-[17.5rem] flex items-center justify-between z-50 pointer-events-none">
          <button
            onClick={handleSaveAndBack}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] font-bold text-xs rounded-lg border-2 border-[#2D4A3E] shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>

          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-xl border border-white/10 shadow-lg relative">
            {/* Bouton Épingler */}
            <button
              type="button"
              onClick={() => setEditorPinned((p) => !p)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                editorPinned
                  ? 'bg-amber-500 text-stone-900 font-bold shadow-xs'
                  : 'text-stone-300 hover:text-white hover:bg-white/10'
              }`}
              title={editorPinned ? 'Détacher la note' : 'Épingler en haut'}
            >
              <Pin className={`w-4 h-4 ${editorPinned ? 'fill-current' : ''}`} />
            </button>

            {/* Bouton Palette de couleurs */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColorPicker((prev) => !prev)}
                className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Changer la couleur du bloc"
              >
                <Palette className="w-4 h-4" />
              </button>

              {/* Menu déroulant des couleurs */}
              {showColorPicker && (
                <div className="absolute right-0 top-10 z-50 bg-[#1c1917] border-2 border-stone-700 rounded-xl p-2 shadow-2xl flex items-center gap-2">
                  {COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setEditorColor(opt.bg);
                        setShowColorPicker(false);
                      }}
                      style={{ backgroundColor: opt.bg }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                        editorColor === opt.bg
                          ? 'border-white scale-110 shadow-md ring-2 ring-white/50'
                          : 'border-stone-600 hover:scale-105'
                      }`}
                      title={opt.label}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Bouton Image */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Ajouter une image"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={imageInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            {/* Bouton Supprimer */}
            {activeNote && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer"
                title="Supprimer la note"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Confirmation de Suppression */}
        {showDeleteConfirm && (
          <div 
            className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn pointer-events-auto"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div 
              className="bg-[#222326] text-white rounded-2xl p-6 w-full max-w-xs sm:max-w-sm shadow-2xl border-2 border-stone-700 space-y-4 text-center relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 bg-red-500/20 text-red-400 border border-red-500/40 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-white">Supprimer cette note ?</h3>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Cette action est irrémédiable. Tout le contenu du bloc sera effacé.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl border border-stone-600 transition-colors cursor-pointer active:scale-95"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (activeNote) {
                      deleteNoteAndSendToTrash(activeNote.id);
                    }
                    setShowDeleteConfirm(false);
                    setViewMode('list');
                  }}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg border border-red-500 transition-colors cursor-pointer active:scale-95"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Editor Main Canvas Body */}
        <div className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 pt-16 flex flex-col space-y-4 pb-20">
          {/* Image Attachment Preview */}
          {editorImage && (
            <div className="relative rounded-2xl overflow-hidden max-h-72 border border-white/20 bg-black/30">
              <img src={editorImage} alt="Attachment" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setEditorImage(undefined)}
                className="absolute top-2 right-2 p-1.5 bg-black/80 text-white rounded-full transition-colors cursor-pointer hover:bg-black"
                title="Retirer l'image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Title Textarea */}
          <div className="relative w-full">
            {!editorTitle && (
              <span 
                className="absolute top-0 left-0 pointer-events-none font-black text-xl sm:text-2xl text-stone-400 tracking-wide select-none uppercase"
                dangerouslySetInnerHTML={{ __html: 'TITRE' }}
              />
            )}
            <textarea
              value={editorTitle}
              rows={2}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                const lines = val.split('\n');
                const limitedVal = lines.slice(0, 2).join('\n');
                setEditorTitle(limitedVal);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const currentLines = editorTitle.split('\n');
                  if (currentLines.length >= 2) {
                    e.preventDefault();
                  }
                }
              }}
              className="w-full bg-transparent font-black text-xl sm:text-2xl text-white focus:outline-none tracking-wide resize-none overflow-hidden uppercase break-all [overflow-wrap:anywhere] [word-break:break-word] leading-snug"
              style={{
                maxHeight: '4.5rem'
              }}
            />
          </div>

          {/* Content Textarea */}
          <div className="relative w-full flex-1 flex flex-col min-h-[450px]">
            {!editorContent && (
              <span 
                className="absolute top-0 left-0 pointer-events-none text-sm sm:text-base text-stone-400 font-normal select-none"
                dangerouslySetInnerHTML={{ __html: 'Note...' }}
              />
            )}
            <textarea
              value={editorContent}
              maxLength={10000}
              onChange={(e) => setEditorContent(e.target.value)}
              className="w-full flex-1 bg-transparent text-sm sm:text-base text-stone-100 font-normal focus:outline-none resize-none leading-relaxed h-full break-all [overflow-wrap:anywhere] [word-break:break-word]"
            />
          </div>
        </div>
      </div>

      {/* ---------------- RENDER MAIN NOTES LIST VIEW ---------------- */}
      <div 
        ref={listContainerRef} 
        className={`absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 w-full md:w-[calc(100%-16rem)] bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 overflow-y-auto flex-col min-h-[calc(100vh-66px)] select-none transition-all duration-300 ease-in-out flex ${viewMode !== 'editor' ? 'opacity-100 z-30 visible' : 'opacity-0 -z-50 invisible pointer-events-none'}`}
      >
      
      {/* Fixed 3D Header */}
      <div className="fixed top-[66px] md:top-[70px] left-4 right-4 md:left-[17.5rem] flex items-center justify-between z-40 pointer-events-none">
        <button
          onClick={onBack}
          className="pointer-events-auto flex items-center gap-1 px-2.5 py-1 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-[10px] rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-3 h-3 text-[#2D4A3E] dark:text-white" />
          <span>Retour</span>
        </button>

        <h1 
          className="pointer-events-auto font-sans text-xs sm:text-sm font-bold text-[#2D4A3E] dark:text-white bg-[#E8DFD0] dark:bg-[#070a13] px-3 py-1 rounded-lg border-2 border-dashed border-stone-600/60 dark:border-stone-400/60 shadow-xs text-center"
          dangerouslySetInnerHTML={{ __html: 'Bloc-notes' }}
        />

        <div className="w-16"></div>
      </div>

      {/* Main Content Area */}
      <div className="w-full px-3 sm:px-6 pt-11 sm:pt-12">
        <div className="pt-1 pb-32 max-w-4xl mx-auto">
          {notes.length === 0 ? (
            <div className="text-center py-20 text-[#5C6B5A]">
              <p className="text-sm font-medium mb-2">Aucune note enregistrée</p>
              <p className="text-xs">Cliquez sur le bouton ci-dessous pour créer votre première note.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pinned Section */}
              {pinnedNotes.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#2D4A3E] dark:text-emerald-400 mb-3 px-1">
                    Épinglées
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {pinnedNotes.map((note) => renderNoteCard(note))}
                  </div>
                </div>
              )}

              {/* Others Section */}
              <div>
                {pinnedNotes.length > 0 && (
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#2D4A3E] dark:text-emerald-400 mb-3 px-1">
                    Autres notes
                  </h3>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {unpinnedNotes.map((note) => renderNoteCard(note))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Drag Overlay Card */}
      {dragState && (
        <div
          style={{
            position: 'fixed',
            left: dragState.x - dragState.offsetX,
            top: dragState.y - dragState.offsetY,
            width: dragState.width,
            height: dragState.height,
            pointerEvents: 'none',
            zIndex: 9999,
            backgroundColor: dragState.note.color || '#25272C',
          }}
          className="rounded-2xl p-4 border-2 border-blue-500 ring-4 ring-blue-500/80 shadow-[0_20px_50px_rgba(0,0,0,0.6)] scale-105 transition-transform select-none text-white overflow-hidden"
        >
          {dragState.note.isPinned && (
            <div className="absolute top-3 right-3 text-amber-400">
              <Pin className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            </div>
          )}
          <div>
            {dragState.note.imageUrl && (
              <div className="mb-3 -mx-4 -mt-4 rounded-t-xl overflow-hidden max-h-36 bg-black/40 border-b border-stone-800">
                <img src={dragState.note.imageUrl} alt={dragState.note.title} className="w-full h-full object-cover" />
              </div>
            )}
            {dragState.note.title && (
              <h4 className="font-extrabold text-xs sm:text-sm text-white mb-2 leading-snug line-clamp-3 pr-4 tracking-wide">
                {dragState.note.title}
              </h4>
            )}
            {dragState.note.content && (
              <p className="text-[11px] sm:text-xs text-stone-100 font-normal leading-relaxed whitespace-pre-line line-clamp-10 opacity-95">
                {dragState.note.content}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Floating Create Button */}
      <div className="fixed bottom-20 right-4 sm:right-8 z-40">
        <button
          onClick={openCreateNote}
          className="bg-[#2D4A3E] hover:bg-[#1e332a] text-white font-bold rounded-2xl px-4 sm:px-5 py-3 border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917] transition-all cursor-pointer flex items-center gap-2 active:translate-x-0.5 active:translate-y-0.5"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span className="text-xs sm:text-sm font-bold tracking-wide" dangerouslySetInnerHTML={{ __html: 'Créer une note' }} />
        </button>
      </div>
    </div>
    </>
  );

  function renderNoteCard(note: NoteItem) {
    const cardBg = note.color || '#25272C';
    const isBeingDragged = dragState?.note.id === note.id;

    return (
      <motion.div
        key={note.id}
        layout
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        data-note-id={note.id}
        onPointerDown={(e) => handlePointerDownCard(e, note)}
        style={{ backgroundColor: cardBg }}
        className={`group relative rounded-2xl p-4 border-2 border-stone-900 shadow-[3px_3px_0px_0px_#1c1917] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-grab active:cursor-grabbing flex flex-col justify-between overflow-hidden select-none touch-pan-y ${
          isBeingDragged ? 'opacity-20 scale-95 border-dashed border-stone-600' : ''
        }`}
      >
        {/* Pin Icon indicator */}
        {note.isPinned && (
          <div className="absolute top-3 right-3 text-amber-400">
            <Pin className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          </div>
        )}

        {/* Card Content */}
        <div className="pointer-events-none notranslate">
          {note.imageUrl && (
            <div className="mb-3 -mx-4 -mt-4 rounded-t-xl overflow-hidden max-h-36 bg-black/40 border-b border-stone-800">
              <img src={note.imageUrl} alt={note.title} className="w-full h-full object-cover" />
            </div>
          )}

          {note.title && (
            <h4 className="font-extrabold text-xs sm:text-sm text-white mb-2 leading-snug line-clamp-2 pr-4 tracking-wide uppercase break-all [overflow-wrap:anywhere]">
              {note.title}
            </h4>
          )}

          {note.content && (
            <p className="text-[11px] sm:text-xs text-stone-100 font-normal leading-relaxed whitespace-pre-line line-clamp-10 opacity-95 break-all [overflow-wrap:anywhere]">
              {note.content}
            </p>
          )}
        </div>
      </motion.div>
    );
  }
};
