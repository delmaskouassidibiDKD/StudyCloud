import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, X, Trash2, Image as ImageIcon, Pin, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { triggerDebouncedCloudBackup } from '../services/userSync';
import { StudyCloudAPI } from '../services/api';

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
}

const DEFAULT_NOTES: NoteItem[] = [
  {
    id: 'note-1',
    title: 'Est-ce que pour le Web ça c\'est la bonne solution',
    content: '1. La classification par extension (Le routeur de fichiers)\nPour que ton application sache quoi faire selon le fichier, le réflexe est de ...',
    createdAt: new Date().toISOString(),
    color: '#25272C'
  },
  {
    id: 'note-2',
    title: '1. Dans quel langage l\'application est-elle développée ?',
    content: 'L\'application est développée en TypeScript (un sur-ensemble de JavaScript qui ajoute un système de types stricts) avec la bibliothèque Re...',
    createdAt: new Date().toISOString(),
    color: '#25272C'
  },
  {
    id: 'note-3',
    title: 'Bouton de navigation et clavier collé',
    content: 'Le CSS pur atteint ses limites sur les navigateurs mobiles (surtout sur Android) car l\'ouverture du clavier virtuel réduit le layout viewport du navigateur, ce qui force les éléments en fixed ou sticky à se repositionner ou à flotter au-dessus d...',
    createdAt: new Date().toISOString(),
    color: '#25272C'
  },
  {
    id: 'note-4',
    title: 'Important',
    content: 'C\'est une excellente question, et c\'est exactement ce qui sépare une simple maquette visuelle d\'un véritable IDE professionnel (comme VS Code).\nDerrière les grands IDE, il y a un système de communication en temp...',
    createdAt: new Date().toISOString(),
    color: '#25272C'
  },
  {
    id: 'note-5',
    title: 'comme la recherche asymétrique ou l\'intégration Google Maps) pour voir comment il réagit ?',
    content: 'Super IA DKD\nClé pour lia;',
    createdAt: new Date().toISOString(),
    color: '#25272C'
  }
];

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
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    const saved = localStorage.getItem('unifolder_keep_notes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: NoteItem) => ({
            ...item,
            color: item.color && item.color !== '#FDFBF7' ? item.color : '#25272C'
          }));
        }
      } catch (e) {}
    }
    return DEFAULT_NOTES;
  });

  // Mode: 'list' or 'editor'
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  // Editor form state
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorColor, setEditorColor] = useState('#25272C');
  const [editorPinned, setEditorPinned] = useState(false);
  const [editorImage, setEditorImage] = useState<string | undefined>(undefined);

  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('unifolder_keep_notes', JSON.stringify(notes));
    triggerDebouncedCloudBackup();
  }, [notes]);

  // Synchronisation avec Cloudflare D1
  useEffect(() => {
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    StudyCloudAPI.getNotes(userId)
      .then((res: any) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped: NoteItem[] = res.data.map((row: any) => ({
            id: row.id,
            title: row.title || '',
            content: row.content || '',
            color: row.color && row.color !== '#FDFBF7' ? row.color : '#25272C',
            isPinned: Boolean(row.is_pinned),
            imageUrl: row.image_url || undefined,
            createdAt: row.created_at || new Date().toISOString(),
          }));
          setNotes(mapped);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleRestore = () => {
      const saved = localStorage.getItem('unifolder_keep_notes');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setNotes(parsed);
        } catch (e) {}
      } else {
        setNotes([]);
      }
    };
    window.addEventListener('unifolder_data_restored', handleRestore);
    return () => window.removeEventListener('unifolder_data_restored', handleRestore);
  }, []);

  const listContainerRef = useRef<HTMLDivElement>(null);

  // Sync ref
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  // Prevent browser default touch action during active drag
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

  // Global Pointer Events for smooth drag and reorder with Long-Press
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      const p = pointerDownRef.current;
      if (!p) return;

      p.currentX = e.clientX;
      p.currentY = e.clientY;

      const deltaX = Math.abs(e.clientX - p.x);
      const deltaY = Math.abs(e.clientY - p.y);

      // If finger/mouse moves more than 5px before long press fires
      if (!p.isDragging && (deltaX > 5 || deltaY > 5)) {
        if (e.pointerType === 'mouse') {
          // Immediately start drag for mouse
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
          // Touch device: user is scrolling page, cancel long press
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }
      }

      if (p.isDragging) {
        setDragState(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);

        // Auto-scroll list container when dragging near top or bottom screen boundaries
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
        // Cooldown between swaps to prevent flickering
        if (now - lastSwapTimeRef.current > 160) {
          // Find element under cursor/finger
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

        // Only open note if it wasn't dragging AND user didn't move finger
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
    // Only primary button or touch
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

    // Require holding down (Long-press ~380ms) to trigger drag mode
    longPressTimerRef.current = setTimeout(() => {
      const p = pointerDownRef.current;
      if (p && !p.isDragging) {
        const deltaX = Math.abs(p.currentX - p.x);
        const deltaY = Math.abs(p.currentY - p.y);

        // Make sure user didn't move away (scrolling)
        if (deltaX < 10 && deltaY < 10) {
          p.isDragging = true;

          // Optional haptic vibration on mobile
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
    setViewMode('editor');
  };

  const openEditNote = (note: NoteItem) => {
    setActiveNote(note);
    setEditorTitle(note.title);
    setEditorContent(note.content);
    setEditorColor(note.color || '#25272C');
    setEditorPinned(!!note.isPinned);
    setEditorImage(note.imageUrl);
    setViewMode('editor');
  };

  const handleSaveAndBack = () => {
    if (editorTitle.trim() || editorContent.trim() || editorImage) {
      const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
      if (activeNote) {
        // Update existing note
        const updatedNote = {
          ...activeNote,
          title: editorTitle,
          content: editorContent,
          color: editorColor,
          isPinned: editorPinned,
          imageUrl: editorImage
        };
        setNotes(prev => prev.map(n => n.id === activeNote.id ? updatedNote : n));
        StudyCloudAPI.saveNote({
          id: updatedNote.id,
          userId,
          title: updatedNote.title,
          content: updatedNote.content,
          color: updatedNote.color,
          isPinned: updatedNote.isPinned,
          imageUrl: updatedNote.imageUrl
        }).catch(() => {});
      } else {
        // Create new note
        const newNote: NoteItem = {
          id: 'note-' + Math.random().toString(36).substring(2, 9),
          title: editorTitle,
          content: editorContent,
          color: editorColor,
          isPinned: editorPinned,
          imageUrl: editorImage,
          createdAt: new Date().toISOString()
        };
        setNotes(prev => [newNote, ...prev]);
        StudyCloudAPI.saveNote({
          id: newNote.id,
          userId,
          title: newNote.title,
          content: newNote.content,
          color: newNote.color,
          isPinned: newNote.isPinned,
          imageUrl: newNote.imageUrl
        }).catch(() => {});
      }
    }
    setViewMode('list');
  };

  const handleDeleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    StudyCloudAPI.deleteNote(id).catch(() => {});
    setViewMode('list');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setEditorImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const pinnedNotes = notes.filter(n => n.isPinned);
  const unpinnedNotes = notes.filter(n => !n.isPinned);

  // ---------------- RENDER MAIN NOTES LIST VIEW & FULL NOTE EDITOR PAGE ----------------
  return (
    <>
      <div 
        style={{ backgroundColor: editorColor }}
        className={`absolute inset-x-0 bottom-0 top-[72px] md:top-[76px] md:left-64 w-full md:w-[calc(100%-16rem)] text-white overflow-y-auto flex-col min-h-[calc(100vh-76px)] select-none transition-all duration-300 ease-in-out flex ${viewMode === 'editor' ? 'opacity-100 z-30 visible' : 'opacity-0 -z-50 invisible pointer-events-none'}`}
      >
        {/* Floating Fixed Buttons (No background bar) */}
        <div className="fixed top-[84px] md:top-[88px] left-4 right-4 md:left-[17.5rem] flex items-center justify-between z-50 pointer-events-none">
          <button
            onClick={handleSaveAndBack}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] font-bold text-xs rounded-lg border-2 border-[#2D4A3E] shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="pointer-events-auto p-2 rounded-xl bg-red-500/80 text-white border-2 border-red-700 shadow-[1px_1px_0px_0px_#1c1917] hover:bg-red-600 transition-colors cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
            title="Supprimer la note"
          >
            <Trash2 className="w-4 h-4" />
          </button>
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
                  Cette action est irrémédiable. Tout le contenu du bloc sera effacé et vous serez redirigé.
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
                      setNotes(prev => prev.filter(n => n.id !== activeNote.id));
                      StudyCloudAPI.deleteNote(activeNote.id).catch(() => {});
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
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Title Textarea (Auto-resizing) */}
          <div className="relative w-full">
            {!editorTitle && (
              <span 
                className="absolute top-0 left-0 pointer-events-none font-black text-xl sm:text-2xl text-stone-400 tracking-wide select-none"
                dangerouslySetInnerHTML={{ __html: 'Titre' }}
              />
            )}
            <textarea
              value={editorTitle}
              maxLength={120}
              onChange={(e) => {
                setEditorTitle(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              rows={1}
              className="w-full bg-transparent font-black text-xl sm:text-2xl text-white focus:outline-none tracking-wide resize-none overflow-hidden"
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
              className="w-full flex-1 bg-transparent text-sm sm:text-base text-stone-100 font-normal focus:outline-none resize-none leading-relaxed h-full"
            />
          </div>
        </div>
      </div>

      {/* ---------------- RENDER MAIN NOTES LIST VIEW ---------------- */}
      <div 
        ref={listContainerRef} 
        className={`absolute inset-x-0 bottom-0 top-[72px] md:top-[76px] md:left-64 w-full md:w-[calc(100%-16rem)] bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 overflow-y-auto flex-col min-h-[calc(100vh-76px)] select-none transition-all duration-300 ease-in-out flex ${viewMode !== 'editor' ? 'opacity-100 z-30 visible' : 'opacity-0 -z-50 invisible pointer-events-none'}`}
      >
      
      {/* Fixed 3D Header - Solid Dark #070a13 */}
      <div className="fixed top-[84px] md:top-[88px] left-4 right-4 md:left-[17.5rem] flex items-center justify-between z-40 pointer-events-none">
        <button
          onClick={onBack}
          className="pointer-events-auto flex items-center gap-1 px-2.5 py-1 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-[10px] rounded-lg border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-3 h-3 text-[#2D4A3E] dark:text-white" />
          <span>Retour</span>
        </button>

        <h1 
          className="pointer-events-auto font-sans text-xs sm:text-sm font-bold text-[#2D4A3E] dark:text-white bg-[#E8DFD0] dark:bg-[#070a13] px-3 py-1 rounded-lg border-2 border-[#2D4A3E] dark:border-[#1e293b] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none text-center"
          dangerouslySetInnerHTML={{ __html: 'Bloc-notes' }}
        />

        <div className="w-16"></div>
      </div>

      {/* Main Content Area */}
      <div className="w-full px-3 sm:px-6 pt-20 sm:pt-24">
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
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#2D4A3E] mb-3 px-1">
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
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#2D4A3E] mb-3 px-1">
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

      {/* Floating Drag Overlay Card (Google Keep blue border style) */}
      {dragState && (
        <div
          style={{
            position: 'fixed',
            left: dragState.x - dragState.offsetX,
            top: dragState.y - dragState.offsetY,
            width: dragState.width,
            backgroundColor: dragState.note.color || '#25272C',
            zIndex: 9999,
            pointerEvents: 'none',
            touchAction: 'none',
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
            <h4 className="font-extrabold text-xs sm:text-sm text-white mb-2 leading-snug line-clamp-3 pr-4 tracking-wide">
              {note.title}
            </h4>
          )}

          {note.content && (
            <p className="text-[11px] sm:text-xs text-stone-100 font-normal leading-relaxed whitespace-pre-line line-clamp-10 opacity-95">
              {note.content}
            </p>
          )}
        </div>
      </motion.div>
    );
  }
};
