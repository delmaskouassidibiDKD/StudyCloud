import React, { useState } from 'react';
import { X, Copy, Check, Share2, Download, Smartphone, Sparkles, CheckCircle2 } from 'lucide-react';

interface PromotionModalProps {
  onClose: () => void;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const officialUrl = 'https://studycloud.dkd-technologies.com';
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(officialUrl)}&margin=10`;

  const shareText = "Salut ! Découvre StudyCloud, la plateforme d'étude et de stockage cloud tout-en-un : cours, révisions, outils scientifiques et intelligence artificielle Delmas IA 🚀📚";

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
      <div className="bg-[#FDFBF7] dark:bg-[#070a13] border-3 border-stone-800 dark:border-white/20 rounded-3xl shadow-[8px_8px_0px_0px_#1c1917] dark:shadow-none max-w-xl w-full p-6 md:p-8 text-stone-900 dark:text-white relative my-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-300 dark:border-white/10 mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 text-xs font-black">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Faire découvrir</span>
          </div>

          <h2 className="text-lg md:text-xl font-extrabold tracking-tight">Partager StudyCloud</h2>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-stone-200 dark:hover:bg-slate-800 rounded-xl transition-colors text-stone-700 dark:text-white border-2 border-stone-800 dark:border-white/20 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center space-y-5">
          <p className="text-xs md:text-sm text-stone-600 dark:text-slate-300">
            Invite tes camarades et amis à rejoindre StudyCloud pour étudier, stocker et collaborer facilement ensemble.
          </p>

          {/* QR Code */}
          <div className="bg-white p-3 rounded-2xl border-2 border-stone-200 shadow-inner">
            <img
              src={qrImageUrl}
              alt="QR Code StudyCloud"
              className="w-44 h-44 md:w-52 md:h-52 object-contain rounded-xl select-none"
              loading="eager"
            />
          </div>

          <div className="flex items-center gap-2 text-stone-600 dark:text-slate-300 text-xs font-semibold">
            <Smartphone className="w-4 h-4 text-orange-500 shrink-0" />
            <span>Scannez avec votre smartphone pour ouvrir StudyCloud</span>
          </div>

          <button
            onClick={handleDownloadQR}
            disabled={downloading}
            className="w-full max-w-sm py-2 px-3 rounded-xl border-2 border-stone-800 dark:border-white/20 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 text-stone-900 dark:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? 'Téléchargement...' : 'Télécharger l\'image QR'}</span>
          </button>

          {/* Copier le lien */}
          <div className="w-full max-w-sm flex items-center gap-2 p-1.5 bg-white dark:bg-slate-900 border-2 border-stone-800 dark:border-white/20 rounded-2xl">
            <input
              type="text"
              readOnly
              value={officialUrl}
              className="flex-1 px-3 py-1.5 text-xs font-mono font-semibold bg-transparent text-stone-900 dark:text-white outline-none select-all"
            />
            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded-xl border-2 border-stone-800 dark:border-white/20 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-stone-900 text-white shadow-sm active:scale-95'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copié' : 'Copier'}</span>
            </button>
          </div>

          {/* Boutons WhatsApp / Telegram / Partage */}
          <div className="w-full max-w-sm space-y-2.5 pt-2">
            <button
              onClick={handleWhatsAppShare}
              className="w-full py-3 px-4 rounded-xl border-2 border-stone-800 dark:border-white/20 bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-xs md:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[2px_2px_0px_0px_#1c1917]"
            >
              <Share2 className="w-4 h-4" />
              <span>Partager sur WhatsApp</span>
            </button>

            <button
              onClick={handleTelegramShare}
              className="w-full py-3 px-4 rounded-xl border-2 border-stone-800 dark:border-white/20 bg-[#0088cc] hover:bg-[#0077b5] text-white font-black text-xs md:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[2px_2px_0px_0px_#1c1917]"
            >
              <Share2 className="w-4 h-4" />
              <span>Partager sur Telegram</span>
            </button>

            <button
              onClick={handleNativeShare}
              className="w-full py-3 px-4 rounded-xl border-2 border-stone-800 dark:border-white/20 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs md:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[2px_2px_0px_0px_#1c1917]"
            >
              <Share2 className="w-4 h-4" />
              <span>Partager via votre appareil</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionModal;
