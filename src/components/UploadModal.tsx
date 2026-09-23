import React, { useState } from 'react';
import { X, Upload, Folder, File, Lock, Sparkles, Check, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { SharedFolder, SharedFile } from '../types';
import { CATEGORIES } from '../data/initialData';

interface UploadModalProps {
  onClose: () => void;
  onAddFolder: (folder: SharedFolder) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ onClose, onAddFolder }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[1]);
  const [school, setSchool] = useState('');
  const [isPasswordProtected, setIsPasswordProtected] = useState(true);
  const [password, setPassword] = useState('');
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Handle mock file addition (from simulated phone/computer selection)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = e.target.files;
      const newFiles: SharedFile[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        newFiles.push({
          id: `file-${Date.now()}-${i}`,
          name: f.name,
          size: f.size,
          type: f.type || 'application/octet-stream'
        });
      }
      setFiles((prev) => [...prev, ...newFiles]);
      if (!title && fileList[0]) {
        const defaultName = fNameWithoutExt(fileList[0].name);
        setTitle(defaultName);
      }
    }
  };

  const fNameWithoutExt = (filename: string) => {
    return filename.substring(0, filename.lastIndexOf('.')) || filename;
  };

  const addSimulatedFile = () => {
    const sampleNames = [
      'TP4_Algorithme_Avance.pdf',
      'Notes_De_Cours_Amphi.docx',
      'Schema_Architecture_Reseau.png',
      'Exercices_Corriges_Examen.pdf'
    ];
    const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
    const newFile: SharedFile = {
      id: `file-${Date.now()}`,
      name: randomName,
      size: Math.floor(Math.random() * 5000000) + 500000,
      type: 'application/pdf'
    };
    setFiles((prev) => [...prev, newFile]);
    if (!title) {
      setTitle('Dossier Cours - ' + category);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Veuillez donner un nom à votre dossier.');
      return;
    }
    if (files.length === 0) {
      alert('Veuillez ajouter au moins un fichier à partager.');
      return;
    }

    setUploading(true);
    let currentProg = 0;
    const interval = setInterval(() => {
      currentProg += 20;
      setUploadProgress(currentProg);
      if (currentProg >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          const totalSize = files.reduce((acc, f) => acc + f.size, 0);
          const authorName = localStorage.getItem('unifolder_user_name') || 'Étudiant';
          const newFolder: SharedFolder = {
            id: 'folder-' + Math.random().toString(36).substring(2, 9),
            title: title.trim(),
            description: description.trim() || 'Dossier partagé par un étudiant.',
            category,
            school: school.trim() || undefined,
            author: authorName,
            createdAt: new Date().toISOString(),
            files,
            totalSize,
            downloadsCount: 0,
            isPasswordProtected,
            password: isPasswordProtected ? password : undefined,
            viewsCount: 0
          };
          onAddFolder(newFolder);
          onClose();
        }, 500);
      }
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn overflow-y-auto">
      <div className="bg-[#FDFBF7] border-3 border-stone-800 rounded-2xl shadow-[6px_6px_0px_0px_#1c1917] max-w-2xl w-full p-6 md:p-8 relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-stone-200 rounded-xl transition-colors text-stone-700"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-orange-500 border-2 border-stone-800 rounded-xl flex items-center justify-center text-white shadow-[3px_3px_0px_0px_#1c1917]">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-stone-900">Créer & Partager un Dossier</h2>
            <p className="text-xs md:text-sm text-stone-600">
              Importez des fichiers depuis votre téléphone ou PC et générez un lien unique de téléchargement direct.
            </p>
          </div>
        </div>

        {uploading ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-orange-100 border-3 border-stone-800 rounded-2xl flex items-center justify-center mx-auto text-orange-600 animate-bounce shadow-[4px_4px_0px_0px_#1c1917]">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-stone-900">Création du lien sécurisé...</h3>
            <p className="text-sm text-stone-600">Compression et envoi des fichiers en cours ({uploadProgress}%)</p>
            <div className="w-full max-w-md mx-auto bg-stone-200 border-2 border-stone-800 rounded-full h-4 overflow-hidden shadow-[inset_2px_2px_0px_0px_rgba(0,0,0,0.1)]">
              <div
                className="bg-orange-500 h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Folder title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                Titre du Dossier / Cours *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Cours de Thermodynamique & TD Corrigés"
                className="w-full bg-[#F5F1E9] border-2 border-stone-800 rounded-xl px-4 py-3 text-sm text-stone-900 placeholder:text-stone-500 outline-none focus:bg-white focus:shadow-[3px_3px_0px_0px_#1c1917] transition-all font-medium"
              />
            </div>

            {/* Category and Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                  Catégorie / Matière *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#F5F1E9] border-2 border-stone-800 rounded-xl px-4 py-3 text-sm text-stone-900 outline-none focus:bg-white focus:shadow-[3px_3px_0px_0px_#1c1917] transition-all font-medium"
                >
                  {CATEGORIES.filter((c) => c !== 'Tous').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                  Description (optionnel)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Partagé pour le groupe de TD 3"
                  className="w-full bg-[#F5F1E9] border-2 border-stone-800 rounded-xl px-4 py-3 text-sm text-stone-900 placeholder:text-stone-500 outline-none focus:bg-white focus:shadow-[3px_3px_0px_0px_#1c1917] transition-all font-medium"
                />
              </div>
            </div>

            {/* School / Institution (Optional) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                École / Université (optionnel)
              </label>
              <input
                type="text"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="Ex: Université Paris-Saclay / École Polytechnique"
                className="w-full bg-[#F5F1E9] border-2 border-stone-800 rounded-xl px-4 py-3 text-sm text-stone-900 placeholder:text-stone-500 outline-none focus:bg-white focus:shadow-[3px_3px_0px_0px_#1c1917] transition-all font-medium"
              />
            </div>

            {/* File Upload Box */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Fichiers du Dossier ({files.length}) *
                </label>
                <button
                  type="button"
                  onClick={addSimulatedFile}
                  className="text-xs font-bold text-orange-600 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter un fichier test rapide
                </button>
              </div>

              <div
                className={`border-3 border-dashed rounded-2xl p-6 text-center transition-all ${
                  isDragging ? 'border-orange-500 bg-orange-50' : 'border-stone-800 bg-[#F5F1E9]'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) {
                    const droppedFiles = e.dataTransfer.files;
                    const newFiles: SharedFile[] = [];
                    for (let i = 0; i < droppedFiles.length; i++) {
                      const f = droppedFiles[i];
                      newFiles.push({
                        id: `file-drop-${Date.now()}-${i}`,
                        name: f.name,
                        size: f.size,
                        type: f.type || 'application/octet-stream'
                      });
                    }
                    setFiles((prev) => [...prev, ...newFiles]);
                  }
                }}
              >
                <div className="w-12 h-12 bg-white border-2 border-stone-800 rounded-xl flex items-center justify-center mx-auto text-orange-500 mb-3 shadow-[2px_2px_0px_0px_#1c1917]">
                  <Folder className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-stone-900 mb-1">
                  Glissez-déposez vos fichiers ici ou sélectionnez depuis votre téléphone
                </p>
                <p className="text-xs text-stone-500 mb-4">
                  PDF, Word, Images, Archives ZIP, Vidéos (Compatible mobile & PC)
                </p>
                <label className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all">
                  <Upload className="w-4 h-4" />
                  <span>Parcourir les fichiers du téléphone</span>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Uploaded files list */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-1">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between bg-white border-2 border-stone-800 rounded-xl px-3 py-2 shadow-[2px_2px_0px_0px_#1c1917]"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <File className="w-4 h-4 text-orange-600 shrink-0" />
                        <span className="text-xs font-bold text-stone-800 truncate">{file.name}</span>
                        <span className="text-[10px] text-stone-500 font-mono shrink-0">
                          ({(file.size / (1024 * 1024)).toFixed(1)} Mo)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="p-1 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Security Options */}
            <div className="bg-[#EBE5DA] border-2 border-stone-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-bold text-stone-900">Protéger par mot de passe</span>
                </div>
                <input
                  type="checkbox"
                  checked={isPasswordProtected}
                  onChange={(e) => setIsPasswordProtected(e.target.checked)}
                  className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                />
              </div>

              {isPasswordProtected && (
                <div>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Entrez votre mot de passe"
                    className="w-full bg-white border-2 border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-900 outline-none font-mono"
                  />
                </div>
              )}
            </div>

            {/* Submit button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border-2 border-stone-800 font-bold text-xs text-stone-700 hover:bg-stone-100 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-6 py-2.5 rounded-xl border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Générer le lien de partage unique</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
