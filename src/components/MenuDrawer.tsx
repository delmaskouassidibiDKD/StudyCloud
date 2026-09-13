import React, { useState } from 'react';
import { Menu, X, Search, Upload, Home, MoreVertical } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { DnaLogo } from './DnaLogo';

interface MenuDrawerProps {
  onNavigateHome: () => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  onOpenUpload?: () => void;
  onImportFile?: () => void;
  onOpenPublishView?: () => void;
  matieres?: { name: string; coefficient: string; color?: string }[];
  onDeleteMatiere?: (index: number) => void;
  onEditMatiere?: (index: number, name: string, coefficient: string) => void;
  onUpdateMatiereColor?: (index: number, color: string) => void;
  onSelectMatiere?: (matiereName: string) => void;
}

const COLOR_OPTIONS = [
  // Verts
  { name: 'Vert Forêt', class: 'bg-[#0a4d3c] text-white border-[#063327]' },
  { name: 'Vert Émeraude', class: 'bg-[#10785c] text-white border-[#0a4d3c]' },
  { name: 'Vert Sauge', class: 'bg-[#4a9f7e] text-white border-[#387f62]' },
  { name: 'Vert Menthe', class: 'bg-[#82c49d] text-stone-950 border-[#65b081]' },
  { name: 'Vert Pastel', class: 'bg-[#bdf3cc] text-stone-950 border-[#9fe4b1]' },
  
  // Oranges & Jaunes
  { name: 'Orange Brûlé', class: 'bg-[#e65c00] text-white border-[#b84900]' },
  { name: 'Orange Vif', class: 'bg-[#f27a1a] text-white border-[#d4640d]' },
  { name: 'Orange Doux', class: 'bg-[#f8a145] text-stone-950 border-[#e08b2c]' },
  { name: 'Jaune Soleil', class: 'bg-[#fcd269] text-stone-950 border-[#e6bd4b]' },
  { name: 'Jaune Crème', class: 'bg-[#ffe699] text-stone-950 border-[#f0d47b]' },
  { name: 'Pêche', class: 'bg-[#ffc299] text-stone-950 border-[#f0a671]' },

  // Rouges & Roses
  { name: 'Rouge Tomate', class: 'bg-[#d93838] text-white border-[#b52a2a]' },
  { name: 'Rouge Corail', class: 'bg-[#e86161] text-white border-[#cc4343]' },
  { name: 'Rouge Profond', class: 'bg-[#b31b1b] text-white border-[#8c1212]' },
  { name: 'Rose Poudré', class: 'bg-[#f5b3b3] text-stone-950 border-[#e09494]' },
  { name: 'Rose Magenta', class: 'bg-[#d81b60] text-white border-[#ad1457]' },
  { name: 'Rose Pastel', class: 'bg-[#f8bbd0] text-stone-950 border-[#f48fb1]' },

  // Bleus & Teals
  { name: 'Bleu Nuit', class: 'bg-[#1f4e79] text-white border-[#153757]' },
  { name: 'Bleu Océan', class: 'bg-[#286090] text-white border-[#1d486e]' },
  { name: 'Bleu Azur', class: 'bg-[#337ab7] text-white border-[#275c8a]' },
  { name: 'Bleu Ciel', class: 'bg-[#5bc0de] text-stone-950 border-[#31b0d5]' },
  { name: 'Cyan Profond', class: 'bg-[#17a2b8] text-white border-[#117a8b]' },
  { name: 'Turquoise', class: 'bg-[#20c997] text-stone-950 border-[#129c74]' },
  { name: 'Teal', class: 'bg-[#008080] text-white border-[#005959]' },

  // Violets & Indigos
  { name: 'Violet Améthyste', class: 'bg-[#8e44ad] text-white border-[#6c3483]' },
  { name: 'Violet Orchidée', class: 'bg-[#9b59b6] text-white border-[#884ea0]' },
  { name: 'Lavande', class: 'bg-[#c39bd3] text-stone-950 border-[#af7ac5]' },
  { name: 'Lilas', class: 'bg-[#e8daef] text-stone-950 border-[#d2b4de]' },

  // Marrons, Gris & Neutres
  { name: 'Chocolat', class: 'bg-[#6e2c00] text-white border-[#4d1f00]' },
  { name: 'Cannelle', class: 'bg-[#a04000] text-white border-[#7e3200]' },
  { name: 'Gris Acier', class: 'bg-[#7f8c8d] text-white border-[#626c6d]' },
  { name: 'Gris Perle', class: 'bg-[#bdc3c7] text-stone-950 border-[#95a5a6]' },
  { name: 'Anthracite', class: 'bg-[#2c3e50] text-white border-[#1a252f]' },
  { name: 'Noir Profond', class: 'bg-[#111111] text-white border-[#000000]' },
  { name: 'Blanc Écru', class: 'bg-[#fdfefe] text-stone-950 border-[#d5dbdb]' },
];

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
  onNavigateHome,
  searchQuery = '',
  setSearchQuery = (_q: string) => {},
  onOpenUpload = () => {},
  onImportFile = () => {},
  onOpenPublishView,
  matieres = [],
  onDeleteMatiere,
  onEditMatiere,
  onUpdateMatiereColor,
  onSelectMatiere,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);
  const [colorPickerIndex, setColorPickerIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const drawerPortal = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Drawer Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9998] bg-black/30 backdrop-blur-xs"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', ease: 'easeOut', duration: 0.25 }}
            className="fixed top-0 left-0 bottom-0 z-[9999] w-80 md:w-96 bg-[#FDFBF7] dark:bg-[#070a13] border-r-3 border-stone-800 dark:border-[#1e293b] px-6 pt-4 pb-6 flex flex-col shadow-2xl"
          >
            {/* Brand Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-stone-200 dark:border-[#1e293b]">
              <div className="flex items-center gap-2 notranslate">
                <DnaLogo className="w-8 h-8 drop-shadow-[0_0_2px_rgba(0,0,0,1)]" glow={true} />
                <div className="flex flex-col truncate text-left leading-none mt-0.5">
                  <h1 className="font-extrabold text-[18px] md:text-[20px] tracking-tight truncate leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    <span className="text-orange-600 dark:text-orange-500">Study</span><span className="text-blue-600 dark:text-blue-500">Cloud</span>
                  </h1>
                  <p className="text-[8px] md:text-[8.5px] font-bold text-orange-400/90 dark:text-amber-400 uppercase tracking-widest leading-none truncate mt-[2px]">
                    DKD Technologies
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-stone-200 dark:hover:bg-[#283852] rounded-lg transition-colors text-stone-700 dark:text-white border-2 border-stone-800 dark:border-[#334155] bg-[#F5F1E9] dark:bg-[#1e293b] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none shrink-0 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                title="Fermer"
              >
                <X className="w-4 h-4 text-stone-800 dark:text-white" />
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full mb-3">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery?.(e.target.value)}
                placeholder="Rechercher..."
                className="w-full bg-white dark:bg-[#111a2e] border-2 border-stone-800 dark:border-[#334155] rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-stone-900 dark:text-white outline-none shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none focus:ring-0"
              />
            </div>

            {/* Action buttons */}
            <div className="space-y-2 mb-2">
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenPublishView) {
                    onOpenPublishView();
                  } else if (onImportFile) {
                    onImportFile();
                  } else if (onOpenUpload) {
                    onOpenUpload();
                  }
                }}
                className="w-full bg-[#2D4A3E] hover:bg-[#1e332a] text-white font-bold text-xs py-2.5 px-3 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all flex items-center justify-center gap-2 cursor-pointer active:translate-x-0.5 active:translate-y-0.5 text-center leading-tight"
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span className="text-[11px]">Publier un fichier ( sujet, documents..) dans la bibliothèque</span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigateHome();
                }}
                className="w-full bg-orange-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all flex items-center justify-center gap-2 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
              >
                <Home className="w-4 h-4" />
                <span>Accueil</span>
              </button>
            </div>

            {/* Navigation area */}
            <nav className="flex flex-col gap-2 flex-1 overflow-y-auto">
              {matieres && matieres.length > 0 && (
                <div className="space-y-2 mt-2">
                  <div className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider px-1">Matières créées ou autres</div>
                  {matieres
                    .map((m, originalIdx) => ({ m, originalIdx }))
                    .filter(({ m }) => m.name.trim() && m.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(({ m, originalIdx }) => (
                      <div 
                        key={originalIdx} 
                        onClick={() => {
                          setIsOpen(false);
                          if (onSelectMatiere) onSelectMatiere(m.name);
                        }}
                        className={`flex items-center justify-between p-3 ${m.color || 'bg-white text-stone-900'} hover:opacity-95 border-2 border-stone-800 rounded-xl shadow-[2px_2px_0px_0px_#1c1917] relative cursor-pointer transition-all ${activeMenuIndex === originalIdx ? 'z-50' : 'z-0'}`}
                      >
                        <span className="text-xs font-bold">{m.name}</span>
                        <div className="flex items-center gap-2 relative">
                          {m.coefficient && (
                            <span className="bg-orange-100 text-orange-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-orange-300">
                              Coeff: {m.coefficient}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuIndex(activeMenuIndex === originalIdx ? null : originalIdx);
                              setColorPickerIndex(null);
                            }}
                            className="p-1 hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4 opacity-70 hover:opacity-100" />
                          </button>

                          {activeMenuIndex === originalIdx && (
                            <>
                              <div
                                className="fixed inset-0 z-[9995] bg-transparent"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setActiveMenuIndex(null);
                                  setColorPickerIndex(null);
                                  setDeleteConfirmIndex(null);
                                }}
                              />
                              <div className="absolute right-0 top-8 z-[9996] w-56 bg-white border-2 border-stone-800 rounded-2xl shadow-2xl py-2 text-left animate-in fade-in duration-150" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-between px-3 pb-2 mb-1 border-b border-stone-100">
                                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                    {colorPickerIndex === originalIdx ? 'Choisir une couleur' : deleteConfirmIndex === originalIdx ? 'Confirmation' : 'Options'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuIndex(null);
                                      setColorPickerIndex(null);
                                      setDeleteConfirmIndex(null);
                                    }}
                                    className="p-1 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-stone-900 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {colorPickerIndex === originalIdx ? (
                                  <div className="px-3 py-2 space-y-2">
                                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                                      {COLOR_OPTIONS.map((col, idx) => (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={() => {
                                            if (onUpdateMatiereColor) {
                                              onUpdateMatiereColor(originalIdx, col.class);
                                            }
                                            setColorPickerIndex(null);
                                            setActiveMenuIndex(null);
                                          }}
                                          className={`w-10 h-10 rounded-xl border-2 border-stone-800 ${col.class.split(' ')[0]} cursor-pointer hover:scale-105 transition-transform shadow-sm`}
                                          title={col.name}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ) : deleteConfirmIndex === originalIdx ? (
                                  <div className="px-3.5 py-2 space-y-3">
                                    <div className="text-xs font-bold text-stone-900 leading-snug">
                                      Confirmer la suppression ?
                                    </div>
                                    <div className="text-[11px] text-stone-600 leading-normal">
                                      Attention : tout fichier dans cette matière sera effacé aussi.
                                    </div>
                                    <div className="flex items-center gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDeleteConfirmIndex(null);
                                        }}
                                        className="flex-1 py-1 px-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-lg border border-stone-300 cursor-pointer"
                                      >
                                        Annuler
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDeleteConfirmIndex(null);
                                          setActiveMenuIndex(null);
                                          if (onDeleteMatiere) {
                                            onDeleteMatiere(originalIdx);
                                          }
                                        }}
                                        className="flex-1 py-1 px-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-sm"
                                      >
                                        Supprimer
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuIndex(null);
                                        if (onEditMatiere) {
                                          onEditMatiere(originalIdx, m.name, m.coefficient);
                                        }
                                      }}
                                      className="w-full px-4 py-2.5 text-xs font-bold text-stone-800 hover:bg-stone-100 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                      <span>✏️ Modifier</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setColorPickerIndex(originalIdx);
                                        setDeleteConfirmIndex(null);
                                      }}
                                      className="w-full px-4 py-2.5 text-xs font-bold text-stone-800 hover:bg-stone-100 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-stone-100"
                                    >
                                      <span>🎨 Couleur</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeleteConfirmIndex(originalIdx);
                                        setColorPickerIndex(null);
                                      }}
                                      className="w-full px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-stone-100"
                                    >
                                      <span>🗑️ Supprimer</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative inline-block">
      {/* 3 traits hamburger button - Solide rempli */}
      <button
        id="menu-drawer-toggle-btn"
        onClick={() => setIsOpen(true)}
        className="bg-[#F5F1E9] dark:bg-[#1e293b] hover:bg-orange-100 dark:hover:bg-[#283852] text-stone-900 dark:text-white p-1.5 sm:p-2 rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-sm flex items-center justify-center transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
        title="Ouvrir le menu"
      >
        <Menu className="w-4 h-4 text-stone-900 dark:text-white" />
      </button>

      {createPortal(drawerPortal, document.body)}
    </div>
  );
};
