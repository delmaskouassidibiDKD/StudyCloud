import React from 'react';
import { X, Smartphone, Cloud, Sparkles, ArrowRight } from 'lucide-react';

export type DownloadDestinationChoice = 'device' | 'studycloud' | 'both';

interface DownloadDestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  filesCount?: number;
  onConfirm: (choice: DownloadDestinationChoice) => void;
}

export const DownloadDestinationModal: React.FC<DownloadDestinationModalProps> = ({
  isOpen,
  onClose,
  title = 'Fichier partagé',
  filesCount = 1,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div
        className="bg-[#FDFBF7] border-3 border-stone-800 rounded-3xl shadow-[8px_8px_0px_0px_#1c1917] max-w-lg w-full p-6 md:p-8 relative text-left"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-white hover:bg-stone-100 border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] text-stone-700 transition-colors cursor-pointer"
          title="Fermer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-6 pr-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 border-2 border-stone-800 text-orange-700 text-xs font-bold mb-2.5 shadow-[2px_2px_0px_0px_#1c1917]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Options de destination</span>
          </div>
          <h3 className="text-xl md:text-2xl font-black text-stone-900 tracking-tight">
            Où souhaitez-vous enregistrer ces fichiers ?
          </h3>
          <p className="text-xs md:text-sm text-stone-600 mt-1 font-medium">
            Pour <span className="font-bold text-stone-800">"{title}"</span> ({filesCount} {filesCount > 1 ? 'fichiers' : 'fichier'}). Choisissez comment vous voulez les récupérer :
          </p>
        </div>

        {/* 3 Choices Cards */}
        <div className="space-y-3">
          {/* Choice 1 : Appareil uniquement */}
          <div
            onClick={() => onConfirm('device')}
            className="group p-4 bg-white hover:bg-orange-50/60 border-2 border-stone-800 rounded-2xl cursor-pointer shadow-[3px_3px_0px_0px_#1c1917] hover:shadow-[4px_4px_0px_0px_#1c1917] transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-stone-100 border-2 border-stone-800 flex items-center justify-center text-stone-800 group-hover:bg-orange-500 group-hover:text-white transition-colors shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-stone-900">
                  Sur cet appareil uniquement
                </h4>
                <p className="text-xs text-stone-500 font-medium leading-relaxed">
                  Téléchargement direct dans les fichiers de votre téléphone ou PC.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-orange-600 shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>

          {/* Choice 2 : StudyCloud uniquement (Mes Fichiers) */}
          <div
            onClick={() => onConfirm('studycloud')}
            className="group p-4 bg-white hover:bg-blue-50/60 border-2 border-stone-800 rounded-2xl cursor-pointer shadow-[3px_3px_0px_0px_#1c1917] hover:shadow-[4px_4px_0px_0px_#1c1917] transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-blue-100 border-2 border-stone-800 flex items-center justify-center text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-stone-900">
                  Dans StudyCloud uniquement (Mes Fichiers)
                </h4>
                <p className="text-xs text-stone-500 font-medium leading-relaxed">
                  Enregistre directement dans votre espace de travail personnel StudyCloud.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-blue-600 shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>

          {/* Choice 3 : Les deux en même temps */}
          <div
            onClick={() => onConfirm('both')}
            className="group p-4 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 hover:from-orange-100 hover:to-amber-100 border-2 border-stone-800 rounded-2xl cursor-pointer shadow-[3px_3px_0px_0px_#1c1917] hover:shadow-[4px_4px_0px_0px_#1c1917] transition-all flex items-center justify-between relative overflow-hidden"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-orange-500 border-2 border-stone-800 flex items-center justify-center text-white shadow-[2px_2px_0px_0px_#1c1917] shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-stone-900">
                    Les deux en même temps
                  </h4>
                  <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-orange-600 text-white shadow-xs">
                    Recommandé
                  </span>
                </div>
                <p className="text-xs text-stone-600 font-medium leading-relaxed">
                  Télécharge sur votre appareil ET sauvegarde dans votre compte StudyCloud.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-orange-600 shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-stone-500 hover:text-stone-800 underline cursor-pointer"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};
