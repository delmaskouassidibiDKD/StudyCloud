import React, { useState, useEffect } from 'react';
import { X, Loader2, Share2, FileText, Image as ImageIcon, Music, File as FileIcon, Copy, Check, Globe, QrCode } from 'lucide-react';
import { SharedFolder } from '../types';

interface CreateShareLinkModalProps {
  uploadedItems: {
    id: string;
    name: string;
    /** Peut être un nombre (octets) ou une chaîne formatée ("108 Ko") */
    size?: number | string;
    /** Peut être absent sur les FileItem du cloud */
    type?: string;
    url?: string;
    isImage?: boolean;
    /** category présent sur les FileItem cloud */
    category?: string;
    extension?: string;
  }[];
  onClose: (wasCreated?: boolean) => void;
  /** Nom initial pré-rempli dans le champ (facultatif) */
  initialLinkName?: string;
  onStartBackgroundCreation: (
    linkName: string,
    comment: string,
    items: any[],
    onComplete?: (folder: SharedFolder | null, error?: string) => void,
    isPublic?: boolean
  ) => void;
}

// Détermine si un item est de type image, audio, PDF ou autre
function detectItemType(item: CreateShareLinkModalProps['uploadedItems'][number]): 'pdf' | 'image' | 'audio' | 'other' {
  const lower = (item.name || '').toLowerCase();
  const type = (item.type || '').toLowerCase();
  const cat = (item.category || '').toLowerCase();
  const ext = (item.extension || lower.split('.').pop() || '').toLowerCase();

  if (lower.endsWith('.pdf') || type.includes('pdf') || ext === 'pdf') return 'pdf';
  if (
    item.isImage ||
    cat === 'images' ||
    type.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|svg|bmp|avif)$/i.test(lower)
  ) return 'image';
  if (
    cat === 'audio' ||
    type.startsWith('audio/') ||
    /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba|amr)$/i.test(lower)
  ) return 'audio';
  return 'other';
}

export const CreateShareLinkModal: React.FC<CreateShareLinkModalProps> = ({
  uploadedItems,
  onClose,
  initialLinkName = '',
  onStartBackgroundCreation,
}) => {
  const [linkName, setLinkName] = useState(initialLinkName);
  const [comment, setComment] = useState('');
  // Décoché par défaut : le lien ne devient public que si l'utilisateur coche explicitement
  const [isPublic, setIsPublic] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdFolder, setCreatedFolder] = useState<SharedFolder | null>(null);
  const [copied, setCopied] = useState(false);

  const handleClose = () => {
    onClose(Boolean(createdFolder));
  };

  // Mettre à jour le nom si la prop change (ex : ouverture successive)
  useEffect(() => {
    setLinkName(initialLinkName);
  }, [initialLinkName]);

  const country = localStorage.getItem('unifolder_user_country') || "Côte d'Ivoire";

  // Comptage par type (robuste, sans crash si `type` est absent)
  const counts = { pdf: 0, image: 0, audio: 0, other: 0 };
  const extensionCounts: { [ext: string]: number } = {};

  (uploadedItems || []).forEach((item) => {
    const kind = detectItemType(item);
    if (kind === 'other') {
      const ext = (item.extension || (item.name || '').split('.').pop() || 'FILE').toUpperCase();
      extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
    } else {
      counts[kind]++;
    }
  });

  const totalItems = (uploadedItems || []).length;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkName.trim()) {
      setErrorMsg('Le nom du lien est obligatoire.');
      return;
    }
    if (totalItems === 0) {
      setErrorMsg('Impossible de créer un lien de partage sans aucun fichier. Veuillez sélectionner au moins 1 fichier.');
      return;
    }
    setErrorMsg('');
    setIsCreating(true);

    onStartBackgroundCreation(linkName, comment, uploadedItems, (folder, error) => {
      setIsCreating(false);
      if (!folder) {
        setErrorMsg(error || "Le lien n'a pas pu être créé. Veuillez réessayer.");
        return;
      }
      setCreatedFolder(folder);
    }, isPublic);
  };

  const shareableUrl = createdFolder?.shareUrl || (createdFolder ? `${window.location.origin}/#share=${createdFolder.id}` : '');

  const handleCopy = () => {
    if (shareableUrl) {
      navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto p-4 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#FDFBF7] border-3 border-stone-800 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-[8px_8px_0px_0px_#1c1917] relative my-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-stone-200 rounded-lg text-stone-700 border-2 border-stone-800 bg-[#F5F1E9] shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {isCreating ? (
          <div className="py-10 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
              <div className="w-16 h-16 bg-orange-100 border-3 border-stone-800 rounded-2xl flex items-center justify-center text-orange-600 shadow-[4px_4px_0px_0px_#1c1917]">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-stone-900">Lien en cours de création</h3>
              <p className="text-xs text-stone-600">Génération du lien unique, code QR et configuration de l'accès...</p>
            </div>
            <div className="bg-orange-50 border-2 border-stone-800 rounded-2xl p-3 text-xs text-orange-900 font-medium shadow-[2px_2px_0px_0px_#1c1917]">
              💡 Vous pouvez continuer vos activités, un message vous notifiera une fois terminé.
            </div>
          </div>
        ) : createdFolder ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-stone-300">
              <div className="w-10 h-10 bg-emerald-500 border-2 border-stone-800 rounded-xl flex items-center justify-center text-white shadow-[2px_2px_0px_0px_#1c1917]">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-stone-900">Lien créé avec succès !</h3>
                <p className="text-xs text-stone-600">Votre partage est rattaché à votre compte</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-black bg-stone-900 text-amber-400 px-2.5 py-1 rounded-xl border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917]">
                Code : {createdFolder.shareCode || 'DKD-SHARE'}
              </span>
              <span className="text-xs font-bold bg-white text-stone-800 px-2.5 py-1 rounded-xl border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] flex items-center gap-1">
                <span>📍</span> {createdFolder.country || country}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] ${
                createdFolder.isPublic !== false ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
              }`}>
                {createdFolder.isPublic !== false ? '🌐 Public à tous' : '🔒 Privé'}
              </span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-800">Nom du lien</label>
              <input
                type="text"
                value={createdFolder.title}
                readOnly
                className="w-full bg-stone-100 border-2 border-stone-800 rounded-xl px-3.5 py-2 text-sm font-bold text-stone-800 outline-none select-all"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-800">Lien de partage unique</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareableUrl}
                  readOnly
                  className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-2 text-xs font-medium text-stone-700 outline-none select-all"
                />
                <button
                  onClick={handleCopy}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
            </div>

            <div className="bg-[#F5F1E9] border-2 border-stone-800 rounded-2xl p-3 text-xs text-stone-700 shadow-[2px_2px_0px_0px_#1c1917] flex items-center gap-2">
              <QrCode className="w-5 h-5 text-orange-600 shrink-0" />
              <span>Retrouvez ce lien et son <strong>Code QR</strong> dans le menu <strong>Partagés (stock de liens)</strong>.</span>
            </div>

            <button
              onClick={handleClose}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-3 rounded-xl border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
            >
              Terminer
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-stone-300">
              <div className="w-10 h-10 bg-orange-500 border-2 border-stone-800 rounded-xl flex items-center justify-center text-white shadow-[2px_2px_0px_0px_#1c1917]">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-stone-900">Créer un lien de partage unique</h3>
                <p className="text-xs text-stone-600">Total : {totalItems} élément{totalItems > 1 ? 's' : ''} lié{totalItems > 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Nom du lien */}
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-800">
                Nom du lien <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={linkName}
                onChange={(e) => {
                  setLinkName(e.target.value);
                  if (e.target.value.trim()) setErrorMsg('');
                }}
                placeholder="Ex: TD Électrotechnique & Schémas..."
                className="w-full bg-white border-2 border-stone-800 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none shadow-[2px_2px_0px_0px_#1c1917]"
              />
              {errorMsg && <p className="text-xs text-red-600 font-bold">{errorMsg}</p>}
            </div>

            {/* Commentaire */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-800">
                  Commentaire <span className="text-stone-500 font-normal normal-case">(facultatif)</span>
                </label>
                <span className={`text-[10px] font-bold ${comment.length === 30 ? 'text-red-600' : 'text-stone-500'}`}>
                  {comment.length}/30 car.
                </span>
              </div>
              <input
                type="text"
                maxLength={30}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ex: Important, à lire..."
                className="w-full bg-white border-2 border-stone-800 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none shadow-[2px_2px_0px_0px_#1c1917]"
              />
            </div>

            {/* Visibilité publique */}
            <label className="flex items-center justify-between p-3 bg-white hover:bg-stone-50 border-2 border-stone-800 rounded-xl shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer transition-colors">
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="block text-xs font-extrabold text-stone-900">Rendre ce lien public à tous</span>
                  <span className="block text-[10px] text-stone-500 font-medium">Visible par tous les étudiants ({country})</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4 accent-orange-600 rounded cursor-pointer"
              />
            </label>

            {/* Récapitulatif */}
            <div className="bg-stone-100 border-2 border-stone-800 rounded-2xl p-3 space-y-1 shadow-[2px_2px_0px_0px_#1c1917]">
              <p className="text-xs font-bold text-stone-800 uppercase tracking-wider">Récapitulatif détaillé</p>
              <p className="text-xs text-stone-700">
                Ce lien liera <strong className="text-stone-900">{totalItems} éléments</strong> au total.
              </p>
            </div>

            {/* Résumé des types */}
            <div className="bg-[#F5F1E9] border-2 border-stone-800 rounded-2xl p-3 shadow-[2px_2px_0px_0px_#1c1917] space-y-1.5">
              <p className="text-xs font-bold text-stone-800 uppercase tracking-wider">Résumé des types</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-stone-700 font-medium">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-red-600" />
                  <span>{counts.pdf} PDF{counts.pdf > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{counts.image} Image{counts.image > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-purple-600" />
                  <span>{counts.audio} Audio{counts.audio > 1 ? 's' : ''}</span>
                </div>
                {Object.entries(extensionCounts).map(([ext, count]) => (
                  <div key={ext} className="flex items-center gap-1.5">
                    <FileIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>{count} {ext}{count > 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs py-3 rounded-xl border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={totalItems === 0 || isCreating}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs py-3 rounded-xl border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                {totalItems === 0 ? 'Aucun fichier sélectionné' : isCreating ? 'Création en cours...' : 'Créer le lien'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
