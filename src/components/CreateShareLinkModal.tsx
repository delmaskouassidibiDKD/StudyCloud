import React, { useState, useEffect } from 'react';
import { X, Loader2, Share2, FileText, Image as ImageIcon, Music, File as FileIcon, Copy, Check, Globe, QrCode, ExternalLink, ShieldCheck, Lock } from 'lucide-react';
import { SharedFolder } from '../types';

interface CreateShareLinkModalProps {
  uploadedItems: { id: string; name: string; size: number; type: string; url?: string; isImage?: boolean }[];
  onClose: () => void;
  onStartBackgroundCreation: (
    linkName: string,
    comment: string,
    items: any[],
    onComplete?: (folder: SharedFolder) => void,
    isPublic?: boolean
  ) => void;
  initialLinkName?: string;
}

export const CreateShareLinkModal: React.FC<CreateShareLinkModalProps> = ({
  uploadedItems,
  onClose,
  onStartBackgroundCreation,
  initialLinkName,
}) => {
  const [linkName, setLinkName] = useState(() => {
    if (initialLinkName?.trim()) return initialLinkName.trim();
    if (uploadedItems.length === 1) return uploadedItems[0].name.replace(/\.[^/.]+$/, '');
    return '';
  });
  const [comment, setComment] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdFolder, setCreatedFolder] = useState<SharedFolder | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const country = localStorage.getItem('unifolder_user_country') || "Côte d'Ivoire";

  // Calculate stats by type and extension
  const typeCounts: { [key: string]: { count: number; icon: React.ReactNode; label: string } } = {
    PDF: { count: 0, icon: <FileText className="w-3.5 h-3.5 text-red-600" />, label: 'PDF' },
    Image: { count: 0, icon: <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />, label: 'Image' },
    Audio: { count: 0, icon: <Music className="w-3.5 h-3.5 text-purple-600" />, label: 'Audio' },
  };

  const extensionCounts: { [ext: string]: number } = {};

  uploadedItems.forEach((item) => {
    const lower = item.name.toLowerCase();
    if (lower.endsWith('.pdf') || item.type.includes('pdf')) {
      typeCounts.PDF.count++;
    } else if (item.isImage || item.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(lower)) {
      typeCounts.Image.count++;
    } else if (item.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(lower)) {
      typeCounts.Audio.count++;
    } else {
      const ext = (lower.split('.').pop() || 'FILE').toUpperCase();
      extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
    }
  });

  const totalItems = uploadedItems.length;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkName.trim()) {
      setErrorMsg('Le nom du lien est obligatoire.');
      return;
    }
    setErrorMsg('');
    setIsCreating(true);

    onStartBackgroundCreation(linkName, comment, uploadedItems, (folder) => {
      setIsCreating(false);
      setCreatedFolder(folder);
    }, isPublic);
  };

  const shareableUrl = createdFolder?.shareUrl || (createdFolder ? `${window.location.origin}/s/${createdFolder.shareCode || createdFolder.id}` : '');

  const handleCopyCode = () => {
    if (createdFolder?.shareCode) {
      navigator.clipboard.writeText(createdFolder.shareCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleCopyMessage = () => {
    if (!createdFolder) return;
    const msg = `📚 "${createdFolder.title}" est disponible sur StudyCloud !\nLien d'accès sécurisé : ${shareableUrl}`;
    navigator.clipboard.writeText(msg);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[100000] overflow-y-auto p-4 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#FDFBF7] border-3 border-stone-800 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-[8px_8px_0px_0px_#1c1917] relative my-auto">
        <button
          onClick={onClose}
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
              <p className="text-xs text-stone-600">Génération du jeton cryptographique, page autonome et synchronisation...</p>
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
                <p className="text-xs text-stone-600">Votre lien sécurisé est prêt à être partagé</p>
              </div>
            </div>

            {/* Badges: Country + Public */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold bg-white text-stone-800 px-2.5 py-1 rounded-xl border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] flex items-center gap-1">
                <span>📍</span> {createdFolder.country || country}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] ${
                createdFolder.isPublic !== false
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'bg-amber-100 text-amber-900'
              }`}>
                {createdFolder.isPublic !== false ? '🌐 Public à tous' : '🔒 Privé'}
              </span>
            </div>

            {/* Non-editable link name */}
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-800">
                Document partagé
              </label>
              <input
                type="text"
                value={createdFolder.title}
                readOnly
                className="w-full bg-stone-100 border-2 border-stone-800 rounded-xl px-3.5 py-2 text-sm font-bold text-stone-800 outline-none select-all"
              />
            </div>

            {/* Carte de lien sécurisé chiffré - Code technique masqué et protégé contre toute modification */}
            <div className="bg-stone-900 border-2 border-stone-800 rounded-2xl p-4 space-y-3 shadow-[3px_3px_0px_0px_#1c1917]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Lien de partage sécurisé & chiffré</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/60 flex items-center gap-1">
                  ● Protection active
                </span>
              </div>

              {/* Champ de lien sécurisé cliquable avec bouton Copier */}
              <div className="bg-stone-950 rounded-xl p-2.5 flex items-center justify-between gap-2 border border-stone-800">
                <a
                  href={shareableUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 font-mono font-semibold truncate hover:underline flex-1"
                  title={shareableUrl}
                >
                  {shareableUrl}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (shareableUrl) {
                      navigator.clipboard.writeText(shareableUrl);
                      setCopiedMessage(true);
                      setTimeout(() => setCopiedMessage(false), 2500);
                    }
                  }}
                  className="shrink-0 bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-black px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                  title="Copier le lien sécurisé"
                >
                  {copiedMessage ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMessage ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>

              <div className="flex items-start gap-2 pt-1 text-[11px] text-stone-400 leading-tight">
                <Lock className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
                <span>Ce lien unique est protégé par chiffrement. Le jeton technique est masqué dans le navigateur afin d'empêcher toute modification par un tiers.</span>
              </div>
            </div>

            {/* Actions: Copier invitation & Ouvrir la page */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleCopyMessage}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs py-3 rounded-xl border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
              >
                {copiedMessage ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedMessage ? 'Lien d\'accès copié !' : 'Partager le lien cliquable'}</span>
              </button>

              <a
                href={shareableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-white hover:bg-stone-100 text-stone-800 font-extrabold text-xs py-2.5 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-1.5 text-center no-underline"
              >
                <span>Ouvrir la page de téléchargement</span>
                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              </a>
            </div>

            {/* Footer Information */}
            <div className="bg-[#F5F1E9] border-2 border-stone-800 rounded-2xl p-3 text-xs text-stone-700 shadow-[2px_2px_0px_0px_#1c1917] flex items-center gap-2">
              <QrCode className="w-5 h-5 text-orange-600 shrink-0" />
              <span>Retrouvez ce document et son <strong>Code QR</strong> dans le menu <strong>Partagés</strong>.</span>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs py-2.5 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
            >
              Fermer
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

            {/* Link Name Input */}
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

            {/* Comment Input (max 30 characters) */}
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

            {/* Public Toggle Checkbox */}
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

            {/* Bottom Summary */}
            <div className="bg-stone-100 border-2 border-stone-800 rounded-2xl p-3 space-y-1 shadow-[2px_2px_0px_0px_#1c1917]">
              <p className="text-xs font-bold text-stone-800 uppercase tracking-wider">Récapitulatif détaillé</p>
              <p className="text-xs text-stone-700">
                Ce lien liera <strong className="text-stone-900">{totalItems} éléments</strong> au total.
              </p>
            </div>

            {/* Top Summary */}
            <div className="bg-[#F5F1E9] border-2 border-stone-800 rounded-2xl p-3 shadow-[2px_2px_0px_0px_#1c1917] space-y-1.5">
              <p className="text-xs font-bold text-stone-800 uppercase tracking-wider">Résumé des types</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-stone-700 font-medium">
                <div className="flex items-center gap-1.5">
                  {typeCounts.PDF.icon}
                  <span>{typeCounts.PDF.count} PDF{typeCounts.PDF.count > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {typeCounts.Image.icon}
                  <span>{typeCounts.Image.count} Image{typeCounts.Image.count > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {typeCounts.Audio.icon}
                  <span>{typeCounts.Audio.count} Audio{typeCounts.Audio.count > 1 ? 's' : ''}</span>
                </div>
                {Object.entries(extensionCounts).map(([ext, count]) => (
                  <div key={ext} className="flex items-center gap-1.5">
                    <FileIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>{count} {ext}{count > 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs py-3 rounded-xl border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-3 rounded-xl border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                Créer le lien
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
