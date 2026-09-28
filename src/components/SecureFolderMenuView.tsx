import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  Plus,
  Trash2,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  BookOpen,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';
import { storeFileBlob, getFileBlobUrl, deleteFileBlob } from '../services/localFileStorage';
import { compressFile } from '../utils/fileCompressor';
import { FileItem } from './Page1FilesMenuView';
import { UploadQueue } from '../services/uploadQueue';

interface SecureFolderMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[]) => void;
}

export const SecureFolderMenuView: React.FC<SecureFolderMenuViewProps> = ({ onBack, onOpenStudySpace }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [securePinInput, setSecurePinInput] = useState('');
  const [securePinConfirmInput, setSecurePinConfirmInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const [secureFiles, setSecureFiles] = useState<FileItem[]>(() => {
    return CloudDataStore.getSecureFolder();
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getStoredPin = () => localStorage.getItem('studycloud_secure_folder_pin');

  // Déverrouillage ou configuration initiale du code secret
  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const stored = getStoredPin();

    if (!stored) {
      const trimmed = securePinInput.trim();
      if (trimmed.length <= 4) {
        setPinError('Le code secret doit comporter plus de 4 caractères.');
        return;
      }
      if (trimmed !== securePinConfirmInput.trim()) {
        setPinError('La confirmation ne correspond pas au code saisi.');
        return;
      }
      localStorage.setItem('studycloud_secure_folder_pin', trimmed);
      CloudStorageAPI.setSecurePin(trimmed).catch(() => {});
      setIsUnlocked(true);
      setPinError(null);
      setSecurePinInput('');
      setSecurePinConfirmInput('');
      showToast('Code secret configuré avec succès ! Coffre déverrouillé.');
    } else {
      const isLocalOk = securePinInput.trim() === stored.trim();
      let isWorkerOk = false;
      try {
        isWorkerOk = await CloudStorageAPI.verifySecurePin(securePinInput.trim());
      } catch {}

      if (isLocalOk || isWorkerOk) {
        setIsUnlocked(true);
        setPinError(null);
        setSecurePinInput('');
        showToast('Dossier sécurisé déverrouillé ✅');
      } else {
        setPinError('Code incorrect. Veuillez réessayer.');
      }
    }
  };

  // Chargement des fichiers protégés une fois déverrouillé
  useEffect(() => {
    if (!isUnlocked) return;
    CloudStorageAPI.getSecureFilesList()
      .then((data) => {
        if (data && Array.isArray(data)) {
          setSecureFiles(data);
          CloudDataStore.setSecureFolder(data as any);
        }
      })
      .catch(() => {});
  }, [isUnlocked]);

  // Import dans le dossier sécurisé
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    showToast(`Chiffrement et ajout de ${files.length} fichier(s)...`);

    const newItemsWithFiles = await Promise.all(
      files.map(async (f, idx) => {
        const ext = f.name.includes('.') ? f.name.split('.').pop()?.toLowerCase() || '' : '';
        let category: FileItem['category'] = 'documents';
        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) category = 'images';
        else if (['mp4', 'webm', 'mov'].includes(ext)) category = 'videos';
        else if (['mp3', 'wav', 'ogg'].includes(ext)) category = 'audio';

        const comp = await compressFile(f, category);
        const fileId = `sec-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
        const localBlobUrl = URL.createObjectURL(comp.file);

        await storeFileBlob(fileId, comp.file as any).catch(() => {});

        const item: FileItem = {
          id: fileId,
          name: f.name,
          category,
          source: 'Dossier sécurisé',
          size: comp.originalSizeFormatted,
          sizeBytes: comp.originalSizeBytes,
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
          extension: ext.toUpperCase(),
          url: localBlobUrl,
          previewUrl: localBlobUrl,
          isSecure: true
        };

        return { file: comp.file, item };
      })
    );

    const newItems = newItemsWithFiles.map(x => x.item);
    setSecureFiles(prev => [...newItems, ...prev]);
    CloudDataStore.setSecureFolder([...newItems, ...secureFiles] as any);

    UploadQueue.enqueueExisting(newItemsWithFiles, { category: 'secure-folder' });
    showToast(`${newItems.length} fichier(s) protégé(s) avec succès !`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Suppression
  const handleDelete = async (file: FileItem) => {
    setSecureFiles(prev => prev.filter(f => f.id !== file.id));
    CloudDataStore.removeFile(file.id, 'secure-folder');
    deleteFileBlob(file.id).catch(() => {});
    await CloudStorageAPI.deleteSecureFile(file.id).catch(() => {});
    showToast(`"${file.name}" supprimé du dossier sécurisé`);
  };

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return secureFiles;
    const q = searchQuery.toLowerCase().trim();
    return secureFiles.filter(f => f.name.toLowerCase().includes(q));
  }, [secureFiles, searchQuery]);

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-[#070A12] text-white select-none animate-in fade-in duration-200">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImport}
        multiple
        className="hidden"
      />

      {/* EN-TÊTE FIXE DU MENU DOSSIER SÉCURISÉ */}
      <header className="sticky top-0 z-30 w-full bg-[#0A0E1A]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-white/10 shadow-lg">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-white border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm font-bold text-xs"
              title="Retour au gestionnaire de fichiers"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
              <span className="hidden xs:inline">Retour</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-black border border-white/10 text-blue-400">
                {isUnlocked ? <Unlock className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" /> : <Lock className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />}
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-white leading-tight">
                  Dossier sécurisé
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-blue-400/80 leading-tight">
                  {isUnlocked ? `${secureFiles.length} fichier(s) protégé(s)` : 'Coffre-fort verrouillé'}
                </p>
              </div>
            </div>
          </div>

          {isUnlocked && (
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-blue-400 border border-blue-500/40 text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Ajouter un fichier</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsUnlocked(false);
                  showToast('Dossier sécurisé verrouillé 🔒');
                }}
                className="p-2 rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30"
                title="Verrouiller le coffre"
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* CONTENU : ÉCRAN DE VERROUILLAGE OU FICHIERS PROTÉGÉS */}
      {!isUnlocked ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#0D1222] border border-blue-500/30 p-6 sm:p-8 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mx-auto shadow-xl">
              <KeyRound className="w-8 h-8 stroke-[2]" />
            </div>

            <div>
              <h2 className="text-lg font-black text-white">
                {getStoredPin() ? 'Déverrouiller le Dossier Sécurisé' : 'Créer votre code secret'}
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {getStoredPin()
                  ? 'Entrez votre code secret à plus de 4 caractères pour accéder à vos fichiers protégés.'
                  : 'Définissez un code secret à plus de 4 caractères pour protéger vos fichiers confidentiels.'}
              </p>
            </div>

            <form onSubmit={handleUnlock} className="space-y-3 text-left">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={securePinInput}
                  onChange={(e) => {
                    setSecurePinInput(e.target.value);
                    setPinError(null);
                  }}
                  placeholder="Code secret (> 4 caractères)"
                  className="w-full bg-[#050812] border border-white/10 focus:border-blue-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {!getStoredPin() && (
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={securePinConfirmInput}
                  onChange={(e) => {
                    setSecurePinConfirmInput(e.target.value);
                    setPinError(null);
                  }}
                  placeholder="Confirmez le code secret"
                  className="w-full bg-[#050812] border border-white/10 focus:border-blue-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                />
              )}

              {pinError && (
                <p className="text-xs font-semibold text-rose-400">{pinError}</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-black font-black text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                {getStoredPin() ? 'Déverrouiller' : 'Enregistrer le code'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <main className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-4 pb-32">
          {filteredFiles.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-20 h-20 rounded-3xl bg-[#121829] border border-blue-500/20 flex items-center justify-center mb-4 shadow-xl">
                <ShieldCheck className="w-10 h-10 text-blue-400 opacity-60 stroke-[1.5]" />
              </div>
              <h3 className="text-lg font-black text-white mb-1.5">Aucun fichier protégé</h3>
              <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
                Glissez ou importez vos documents personnels, relevés ou notes confidentielles ici.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-full bg-blue-500 hover:bg-blue-400 text-black font-black text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer active:scale-95 flex items-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Ajouter un fichier confidentiel</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="group rounded-2xl p-3 bg-[#0B0F1D] hover:bg-[#121828] border border-white/10 hover:border-blue-400/40 shadow-sm transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate" title={file.name}>
                        {file.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {file.size} • {file.date}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onOpenStudySpace && (
                      <button
                        type="button"
                        onClick={() => onOpenStudySpace(file, 'Dossier sécurisé')}
                        className="p-1.5 rounded-lg border border-white/10 text-emerald-400 hover:bg-emerald-500/10"
                        title="Ouvrir dans l'Espace d'étude"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(file)}
                      className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-red-400 hover:border-red-400"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* TOAST FLOTTANT */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F1424] border border-blue-500/40 text-blue-300 px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
