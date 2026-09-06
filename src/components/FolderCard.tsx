import React, { useState } from 'react';
import { Folder, FileText, Download, Share2, QrCode, Copy, Check, Lock, Unlock, Globe, Eye, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { SharedFolder } from '../types';
import { FileIconBadge } from './FileIconBadge';

interface FolderCardProps {
  folder: SharedFolder;
  onSelect: (folder: SharedFolder) => void;
  onOpenQR: (folder: SharedFolder) => void;
  onDelete: (folderId: string) => void;
  onUpdateFolder?: (folder: SharedFolder) => void;
  isPublicView?: boolean;
}

export const FolderCard: React.FC<FolderCardProps> = ({ folder, onSelect, onOpenQR, onDelete, onUpdateFolder, isPublicView = false }) => {
  const [copied, setCopied] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [commentInput, setCommentInput] = useState(folder.description || '');
  const [commentError, setCommentError] = useState(false);
  const [publishingState, setPublishingState] = useState<'idle' | 'loading' | 'success'>('idle');

  const shareUrl = `${window.location.origin}/#share=${folder.id}`;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 o';
    const k = 1024;
    const sizes = ['o', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const fileNamesSummary = folder.files.map((f) => f.name).join(', ');

  const genericPrefixes = [
    'Dossier partagé contenant',
    'Dossier partagé par un étudiant'
  ];

  const handlePublish = () => {
    const trimmed = commentInput.trim();
    const isGeneric = genericPrefixes.some(prefix => trimmed.startsWith(prefix));

    if (!trimmed || isGeneric) {
      setCommentError(true);
      return;
    }
    setPublishingState('loading');
    setTimeout(() => {
      setPublishingState('success');
      setTimeout(() => {
        const updated: SharedFolder = {
          ...folder,
          description: commentInput.trim(),
          isPasswordProtected: false,
        };
        if (onUpdateFolder) {
          onUpdateFolder(updated);
        }
        setPublishingState('idle');
        setShowPublishModal(false);
      }, 1000);
    }, 3000);
  };

  const isPublic = !folder.isPasswordProtected;

  return (
    <div
      className="bg-[#FDFBF7] border-3 border-stone-800 rounded-2xl p-5 shadow-[4px_4px_0px_0px_#1c1917] hover:shadow-[6px_6px_0px_0px_#1c1917] transition-all flex flex-col justify-between group relative overflow-hidden"
    >
      {/* Delete Confirmation Menu Overlay */}
      {showDeleteMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-20 bg-[#FDFBF7]/95 backdrop-blur-sm p-5 flex flex-col items-center justify-center text-center animate-fadeIn"
        >
          <div className="w-12 h-12 bg-red-100 border-2 border-stone-800 rounded-2xl flex items-center justify-center text-red-600 mb-3 shadow-[2px_2px_0px_0px_#1c1917]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-extrabold text-stone-900 mb-1">
            Voulez-vous supprimer ce lien ?
          </h4>
          <p className="text-xs text-stone-600 mb-4 px-2">
            Cette action est irréversible et supprimera le partage de ce dossier.
          </p>
          <div className="flex items-center gap-3 w-full max-w-xs">
            <button
              onClick={() => setShowDeleteMenu(false)}
              className="flex-1 bg-white hover:bg-stone-100 text-stone-800 text-xs font-bold py-2.5 px-3 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                onDelete(folder.id);
                setShowDeleteMenu(false);
              }}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            >
              Oui
            </button>
          </div>
        </div>
      )}

      {/* Publish / Make Public Modal Overlay */}
      {showPublishModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-20 bg-[#FDFBF7]/98 backdrop-blur-sm p-4 flex flex-col justify-between animate-fadeIn overflow-y-auto"
        >
          {publishingState === 'loading' ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-orange-100 border-3 border-stone-800 rounded-2xl flex items-center justify-center text-orange-600 shadow-[4px_4px_0px_0px_#1c1917]">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <p className="text-xs font-extrabold text-stone-950">Publication en cours...</p>
            </div>
          ) : publishingState === 'success' ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 animate-scaleUp">
              <div className="w-16 h-16 bg-emerald-100 border-3 border-stone-800 rounded-2xl flex items-center justify-center text-emerald-600 shadow-[4px_4px_0px_0px_#1c1917]">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <p className="text-xs font-extrabold text-emerald-700">Publié avec succès !</p>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-extrabold text-stone-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    <span>Rendre ce lien public</span>
                  </h4>
                  <button
                    onClick={() => setShowPublishModal(false)}
                    className="text-stone-500 hover:text-stone-800 text-xs font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-stone-700 font-medium mb-3">
                  Voulez-vous rendre ce lien public ? Tout le monde le verra !
                </p>
                <div className="mb-2">
                  <label className="block text-[11px] font-extrabold text-stone-800 mb-1">
                    Commentaire (obligatoire) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={commentInput}
                    onChange={(e) => {
                      setCommentInput(e.target.value);
                      const val = e.target.value.trim();
                      const isGeneric = genericPrefixes.some(prefix => val.startsWith(prefix));
                      if (val && !isGeneric) setCommentError(false);
                    }}
                    placeholder="Écrivez un commentaire ou une description..."
                    rows={3}
                    className={`w-full bg-white border-2 ${
                      commentError ? 'border-red-500 bg-red-50/30' : 'border-stone-800'
                    } rounded-xl p-2 text-xs font-medium outline-none shadow-[2px_2px_0px_0px_#1c1917] resize-none`}
                  />
                  {commentError && (
                    <p className="text-[10px] font-bold text-red-600 mt-1">
                      {commentInput.trim() && genericPrefixes.some(p => commentInput.trim().startsWith(p))
                        ? "Veuillez compléter ou modifier la description générique avant de publier."
                        : "Le commentaire est obligatoire pour publier."}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                {isPublic && (
                  <button
                    onClick={() => {
                      const updated: SharedFolder = {
                        ...folder,
                        isPasswordProtected: true,
                      };
                      if (onUpdateFolder) {
                        onUpdateFolder(updated);
                      }
                      setShowPublishModal(false);
                    }}
                    className="w-full bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold py-2 px-3 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    Repasser en privé
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPublishModal(false)}
                    className="flex-1 bg-white hover:bg-stone-100 text-stone-800 text-xs font-bold py-2 px-3 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handlePublish}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2 px-3 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    {isPublic ? 'Mettre à jour' : 'Publier'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div>
        {/* Top badges */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold px-3 py-1 bg-orange-100 border-2 border-stone-800 rounded-lg text-orange-700 shadow-[2px_2px_0px_0px_#1c1917] truncate max-w-[200px]" title={folder.title}>
              {folder.title}
            </span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-xs font-mono text-stone-600 font-bold mt-1">
              {formatSize(folder.totalSize)}
            </span>
            {!isPublicView && (
              <div className="flex flex-col items-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCommentInput(folder.description || '');
                    setCommentError(false);
                    setShowPublishModal(true);
                  }}
                  className={`p-1.5 border-2 border-stone-800 rounded-lg shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer ${
                    isPublic
                      ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                      : 'bg-[#FFF3D6] hover:bg-[#ffe8b3] text-amber-800'
                  }`}
                  title={isPublic ? 'Lien public (Cliquer pour modifier)' : 'Rendre ce lien public'}
                >
                  {isPublic ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                </button>
                <span className="text-[10px] font-extrabold text-stone-700 mt-0.5 tracking-tight">
                  {isPublic ? 'Public' : 'Privé'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Description / Comment */}
        {folder.description && folder.description.trim() !== '' && (
          <p className="text-xs text-stone-600 line-clamp-2 mb-3 leading-relaxed">
            {folder.description}
          </p>
        )}

        {/* Clean files summary box (without checkboxes) */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelect(folder);
          }}
          className="bg-[#F5F1E9] hover:bg-[#efe9df] border-2 border-stone-800 rounded-xl p-3 mb-4 shadow-[2px_2px_0px_0px_#1c1917] flex items-center gap-3 cursor-pointer transition-colors group/box"
        >
          <div className="shrink-0 flex items-center justify-center">
            <FileIconBadge isFolder={true} size={40} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-stone-900 group-hover/box:text-orange-600 transition-colors">
              {folder.files.length} fichier{folder.files.length > 1 ? 's' : ''} inclus
            </p>
            <p className="text-[11px] text-stone-600 truncate font-medium">
              {fileNamesSummary || 'Aucun fichier'}
            </p>
          </div>
        </div>
      </div>

      <div>
        {/* Analytics stats */}
        <div className="flex items-center justify-center text-xs text-stone-600 pt-3 border-t-2 border-dashed border-stone-300 mb-3">
          <div className="flex items-center gap-1.5 font-medium">
            <Download className="w-3.5 h-3.5 text-orange-600" />
            <span>{folder.downloadsCount} téléchargements</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className={`grid ${isPublicView ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
          <button
            onClick={handleCopyLink}
            className="bg-white hover:bg-stone-100 text-stone-800 text-xs font-bold py-2 px-2 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-center gap-1 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            title="Copier le lien sécurisé"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-700" />}
            <span className="truncate">{copied ? 'Copié' : 'Lien'}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenQR(folder);
            }}
            className="bg-white hover:bg-stone-100 text-stone-800 text-xs font-bold py-2 px-2 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-center gap-1 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            title="Générer QR Code mobile"
          >
            <QrCode className="w-3.5 h-3.5 text-stone-700" />
            <span>QR Code</span>
          </button>

          {!isPublicView && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteMenu(true);
              }}
              className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-2 px-2 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-center gap-1 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              title="Supprimer le dossier"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
