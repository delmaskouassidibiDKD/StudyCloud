import React, { useState } from 'react';
import { Folder, FileText, Download, Lock, Check, ShieldCheck, ArrowLeft, Package, Sparkles } from 'lucide-react';
import { SharedFolder } from '../types';
import JSZip from 'jszip';

interface SharePortalViewProps {
  folder: SharedFolder;
  onBackToApp: () => void;
  onIncrementDownload: (folderId: string) => void;
}

export const SharePortalView: React.FC<SharePortalViewProps> = ({ folder, onBackToApp, onIncrementDownload }) => {
  const [unlocked, setUnlocked] = useState(!folder.isPasswordProtected);
  const [inputPassword, setInputPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [zipping, setZipping] = useState(false);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPassword === folder.password) {
      setUnlocked(true);
      setErrorMsg('');
    } else {
      setErrorMsg('Mot de passe incorrect. Veuillez réessayer.');
    }
  };

  const handleDownloadAllZip = async () => {
    setZipping(true);
    onIncrementDownload(folder.id);
    try {
      const zip = new JSZip();
      folder.files.forEach((file) => {
        const content = `Contenu officiel du fichier ${file.name}\nDossier partagé: ${folder.title}\nPartagé via StudyCloud - Plateforme étudiante`;
        zip.file(file.name, content);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folder.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_dossier_complet.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setZipping(false);
    }
  };

  const handleDownloadSingle = (fileName: string) => {
    onIncrementDownload(folder.id);
    const content = `Ceci est le fichier ${fileName} téléchargé depuis le dossier partagé ${folder.title}.`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 o';
    const k = 1024;
    const sizes = ['o', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900 flex flex-col items-center justify-start p-4 md:p-8">
      {/* Top Navbar */}
      <div className="w-full max-w-3xl flex items-center justify-between mb-8 pb-4 border-b-3 border-stone-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 border-2 border-stone-800 rounded-xl flex items-center justify-center text-white shadow-[3px_3px_0px_0px_#1c1917]">
            <Folder className="w-5 h-5 fill-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-stone-900 text-lg">StudyCloud Share</h1>
            <p className="text-xs text-stone-600">Portail de téléchargement direct étudiant</p>
          </div>
        </div>

        <button
          onClick={onBackToApp}
          className="bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs px-4 py-2.5 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] flex items-center gap-2 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Accéder à l'application</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-3xl bg-[#F5F1E9] border-3 border-stone-800 rounded-3xl p-6 md:p-10 shadow-[8px_8px_0px_0px_#1c1917]">
        {!unlocked ? (
          <div className="max-w-md mx-auto py-10 text-center space-y-6">
            <div className="w-16 h-16 bg-amber-100 border-3 border-stone-800 rounded-2xl flex items-center justify-center mx-auto text-amber-700 shadow-[4px_4px_0px_0px_#1c1917]">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-stone-900 mb-2">Dossier Protégé</h2>
              <p className="text-sm text-stone-600">
                Ce dossier partagé par <span className="font-bold text-stone-800">{folder.author}</span> nécessite un mot de passe pour être consulté et téléchargé.
              </p>
            </div>

            <form onSubmit={handleUnlock} className="space-y-4">
              <input
                type="password"
                required
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                placeholder="Entrez le mot de passe..."
                className="w-full bg-white border-2 border-stone-800 rounded-xl px-4 py-3 text-sm text-stone-900 outline-none font-mono text-center shadow-[3px_3px_0px_0px_#1c1917]"
              />
              {errorMsg && <p className="text-xs font-bold text-red-600">{errorMsg}</p>}
              <button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl border-2 border-stone-800 shadow-[4px_4px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                Déverrouiller le dossier
              </button>
            </form>
          </div>
        ) : (
          <div>
            {/* Header info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b-2 border-stone-300 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-3 py-1 bg-orange-100 border-2 border-stone-800 rounded-lg text-orange-700 shadow-[2px_2px_0px_0px_#1c1917]">
                    {folder.category}
                  </span>
                  <span className="text-xs font-mono text-stone-600 font-medium">
                    {formatSize(folder.totalSize)} • {folder.files.length} fichiers
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-stone-900 mb-2">{folder.title}</h2>
                <p className="text-sm text-stone-600 leading-relaxed">{folder.description}</p>
                <div className="flex items-center gap-2 mt-3 text-xs text-stone-500 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Partagé par <strong className="text-stone-800">{folder.author}</strong> • Sécurisé et vérifié</span>
                </div>
              </div>

              {/* Download all button */}
              <button
                onClick={handleDownloadAllZip}
                disabled={zipping}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-6 py-4 rounded-2xl border-3 border-stone-800 shadow-[4px_4px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
              >
                <Package className="w-5 h-5" />
                <span>{zipping ? 'Création de l\'archive...' : 'Télécharger tout (.ZIP)'}</span>
              </button>
            </div>

            {/* Files list */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-3">
                Fichiers disponibles en téléchargement direct ({folder.files.length})
              </h3>
              <div className="space-y-3">
                {folder.files.map((file) => (
                  <div
                    key={file.id}
                    className="bg-white border-3 border-stone-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[3px_3px_0px_0px_#1c1917] hover:shadow-[4px_4px_0px_0px_#1c1917] transition-all"
                  >
                    <div className="flex items-center gap-3.5 truncate">
                      <div className="w-10 h-10 bg-orange-100 border-2 border-stone-800 rounded-xl flex items-center justify-center text-orange-600 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-bold text-stone-900 truncate">{file.name}</p>
                        <p className="text-xs text-stone-500 font-mono">
                          {formatSize(file.size)} • Téléchargement instantané
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDownloadSingle(file.name)}
                      className="bg-[#F5F1E9] hover:bg-orange-100 text-stone-900 font-bold text-xs px-4 py-2.5 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-center gap-2 active:translate-x-0.5 active:translate-y-0.5 transition-all shrink-0"
                    >
                      <Download className="w-4 h-4 text-orange-600" />
                      <span>Télécharger</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t-2 border-stone-300 text-center">
              <p className="text-xs text-stone-500">
                StudyCloud Share • Permet aux étudiants de partager leurs dossiers de téléphone ou PC en toute simplicité.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
