import React, { useState } from 'react';
import { X, Copy, Check, Share2, Download, Smartphone, CheckCircle2 } from 'lucide-react';

interface PromotionModalProps {
  onClose: () => void;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const officialUrl = 'https://studycloud.dkd-technologies.com';
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(officialUrl)}&margin=10`;

  const shareText = "Salut ! Découvre StudyCloud, la plateforme d'étude et de stockage cloud tout-en-un : cours, révisions, outils scientifiques et des fonctionnalités IA 🚀📚";

  const handleCopy = () => {
    navigator.clipboard.writeText(officialUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'StudyCloud - Écosystème Tout-en-Un',
          text: shareText,
          url: officialUrl,
        });
      } catch {
        // Annulé par l'utilisateur
      }
    } else {
      handleCopy();
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`${shareText}\n\n👉 Accède gratuitement ici : ${officialUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleTelegramShare = () => {
    const url = encodeURIComponent(officialUrl);
    const text = encodeURIComponent(shareText);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
  };

  const handleDownloadQR = async () => {
    try {
      setDownloading(true);
      const response = await fetch(qrImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'StudyCloud-QRCode.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(qrImageUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn overflow-y-auto">
      <div className="bg-[#FDFBF7] dark:bg-[#070a13] border-3 border-stone-800 dark:border-white/20 rounded-3xl shadow-[8px_8px_0px_0px_#1c1917] dark:shadow-none max-w-3xl w-full p-4 sm:p-6 md:p-8 text-stone-900 dark:text-white relative my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-300 dark:border-white/10 mb-4">
          <h2 className="text-xl md:text-2xl font-serif font-black tracking-tight">Partager StudyCloud</h2>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-stone-200 dark:hover:bg-slate-800 rounded-xl transition-colors text-stone-700 dark:text-white border-2 border-stone-800 dark:border-white/20 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs md:text-sm text-stone-600 dark:text-slate-300 mb-4 text-center max-w-xl mx-auto">
          Invite tes camarades et amis à rejoindre StudyCloud pour étudier, stocker et collaborer facilement ensemble.
        </p>

        {/* Grille 2 colonnes sur tablette/ordinateur */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* QR Code */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="w-full bg-white dark:bg-slate-900 border-2 border-stone-800 dark:border-white/20 rounded-2xl p-4 shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none flex flex-col items-center space-y-2.5">
              <div className="bg-white p-2 rounded-xl border border-stone-200 shadow-inner">
                <img
                  src={qrImageUrl}
                  alt="QR Code StudyCloud"
                  className="w-40 h-40 sm:w-48 sm:h-48 object-contain rounded-lg select-none"
                  loading="eager"
                />
              </div>

              <div className="flex items-center gap-1.5 text-stone-600 dark:text-slate-300 text-[11px] font-semibold text-center">
                <Smartphone className="w-4 h-4 text-orange-500 shrink-0" />
                <span>Scannez avec un smartphone</span>
              </div>

              <button
                onClick={handleDownloadQR}
                disabled={downloading}
                className="w-full py-2 px-3 rounded-xl border-2 border-stone-800 dark:border-white/20 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 text-stone-900 dark:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloading ? 'Téléchargement...' : 'Télécharger l\'image QR'}</span>
              </button>
            </div>
          </div>

          {/* Liens et boutons */}
          <div className="md:col-span-7 flex flex-col space-y-3">
            {/* Copier le lien */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-slate-300">
                Lien officiel
              </label>
              <div className="flex items-center gap-2 p-1 bg-white dark:bg-slate-900 border-2 border-stone-800 dark:border-white/20 rounded-xl">
                <input
                  type="text"
                  readOnly
                  value={officialUrl}
                  className="flex-1 px-3 py-1.5 text-xs font-mono font-semibold bg-transparent text-stone-900 dark:text-white outline-none select-all truncate"
                />
                <button
                  onClick={handleCopy}
                  className={`px-3 py-1.5 rounded-lg border border-stone-800 dark:border-white/20 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    copied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-stone-900 text-white shadow-sm active:scale-95'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
            </div>

            {/* Boutons WhatsApp / Telegram / Partage */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
              <button
                onClick={handleWhatsAppShare}
                className="py-2 px-3 rounded-xl border-2 border-stone-800 dark:border-white/20 bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0px_0px_#1c1917]"
              >
                <span>WhatsApp</span>
              </button>

              <button
                onClick={handleTelegramShare}
                className="py-2 px-3 rounded-xl border-2 border-stone-800 dark:border-white/20 bg-[#0088cc] hover:bg-[#0077b5] text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0px_0px_#1c1917]"
              >
                <span>Telegram</span>
              </button>

              <button
                onClick={handleNativeShare}
                className="py-2 px-3 rounded-xl border-2 border-stone-800 dark:border-white/20 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0px_0px_#1c1917]"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Appareil</span>
              </button>
            </div>

            {/* Atouts */}
            <div className="space-y-1.5 pt-1 text-left">
              <div className="p-2 rounded-xl border border-stone-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 flex items-start gap-2 text-xs">
                <span>📚</span>
                <div>
                  <strong className="block font-bold">Plateforme 100% Tout-en-un</strong>
                  <span className="text-[11px] text-stone-600 dark:text-slate-400">Cours, documents, cloud sécurisé, calculatrice scientifique.</span>
                </div>
              </div>

              <div className="p-2 rounded-xl border border-stone-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 flex items-start gap-2 text-xs">
                <span>🤖</span>
                <div>
                  <strong className="block font-bold">Des fonctionnalités IA</strong>
                  <span className="text-[11px] text-stone-600 dark:text-slate-400">Assistance intelligente pour expliquer et réviser.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionModal;
