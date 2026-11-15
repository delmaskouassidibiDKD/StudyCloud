import React, { useState } from 'react';
import { ArrowLeft, Copy, Check, Share2, Download, Smartphone, Sparkles, CheckCircle2 } from 'lucide-react';

interface PromotionViewProps {
  onBack: () => void;
}

export const PromotionView: React.FC<PromotionViewProps> = ({ onBack }) => {
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
    <div className="absolute inset-x-0 bottom-0 top-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#FDFBF7] dark:bg-[#070a13] text-stone-900 dark:text-white overflow-y-auto animate-fadeIn">
      {/* Barre de retour supérieure */}
      <div className="sticky top-0 left-0 right-0 z-40 bg-[#FDFBF7]/90 dark:bg-[#070a13]/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-stone-200/80 dark:border-white/10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-[#FDFBF7] dark:bg-slate-900 hover:bg-orange-50 dark:hover:bg-slate-800 text-stone-900 dark:text-white font-bold text-xs rounded-xl border-2 border-stone-800 dark:border-white/20 shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4 text-stone-900 dark:text-white" />
          <span>Retour</span>
        </button>

        <span className="text-xs font-black tracking-wider uppercase text-orange-600 dark:text-orange-400">
          StudyCloud Partage
        </span>
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 pt-6 md:pt-10 pb-20 flex flex-col items-center text-center space-y-6 md:space-y-8">
        {/* Titre & Description */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 text-xs font-extrabold border border-orange-300 dark:border-orange-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Faire découvrir l'application</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-serif font-black text-stone-900 dark:text-white">
            Partager StudyCloud
          </h1>
          <p className="text-xs md:text-sm text-stone-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
            Invite tes camarades de classe, amis et collègues à rejoindre StudyCloud pour étudier, stocker et collaborer facilement ensemble.
          </p>
        </div>

        {/* Carte QR Code */}
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 border-3 border-stone-800 dark:border-white/20 rounded-3xl p-6 shadow-[5px_5px_0px_0px_#1c1917] dark:shadow-none flex flex-col items-center space-y-4">
          <div className="bg-white p-3 rounded-2xl border-2 border-stone-200 shadow-inner">
            <img
              src={qrImageUrl}
              alt="QR Code StudyCloud"
              className="w-48 h-48 md:w-56 md:h-56 object-contain rounded-xl select-none"
              loading="eager"
            />
          </div>

          <div className="flex items-center gap-2 text-stone-600 dark:text-slate-300 text-[11px] md:text-xs font-semibold px-2">
            <Smartphone className="w-4 h-4 text-orange-500 shrink-0" />
            <span>Scannez avec l'appareil photo d'un smartphone pour ouvrir StudyCloud</span>
          </div>

          <button
            onClick={handleDownloadQR}
            disabled={downloading}
            className="w-full py-2.5 px-4 rounded-xl border-2 border-stone-800 dark:border-white/20 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-900 dark:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-stone-700 dark:text-slate-300" />
            <span>{downloading ? 'Téléchargement...' : 'Télécharger le QR Code (Image PNG)'}</span>
          </button>
        </div>

        {/* Boîte Lien Officiel & Copier */}
        <div className="w-full max-w-md space-y-2">
          <label className="block text-left text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-slate-300">
            Lien officiel StudyCloud
          </label>
          <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-slate-900 border-2 border-stone-800 dark:border-white/20 rounded-2xl shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none">
            <input
              type="text"
              readOnly
              value={officialUrl}
              className="flex-1 px-3 py-2 text-xs md:text-sm font-mono font-semibold bg-transparent text-stone-900 dark:text-white outline-none select-all"
            />
            <button
              onClick={handleCopy}
              className={`px-4 py-2 rounded-xl border-2 border-stone-800 dark:border-white/20 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-stone-900 dark:bg-slate-800 hover:bg-stone-800 text-white shadow-sm active:scale-95'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copié !' : 'Copier'}</span>
            </button>
          </div>
        </div>

        {/* Boutons d'action de partage direct */}
        <div className="w-full max-w-md space-y-3 pt-2">
          {/* Partage WhatsApp */}
          <button
            onClick={handleWhatsAppShare}
            className="w-full py-3.5 px-5 rounded-2xl border-2 border-stone-800 dark:border-white/20 bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold text-sm md:text-base shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none flex items-center justify-center gap-3 transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
            </svg>
            <span>Partager sur WhatsApp</span>
          </button>

          {/* Partage Telegram */}
          <button
            onClick={handleTelegramShare}
            className="w-full py-3.5 px-5 rounded-2xl border-2 border-stone-800 dark:border-white/20 bg-[#0088cc] hover:bg-[#0077b5] text-white font-extrabold text-sm md:text-base shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none flex items-center justify-center gap-3 transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.197 1.006.128.832.946z" />
            </svg>
            <span>Partager sur Telegram</span>
          </button>

          {/* Partage système général (SMS, etc.) */}
          <button
            onClick={handleNativeShare}
            className="w-full py-3.5 px-5 rounded-2xl border-2 border-stone-800 dark:border-white/20 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm md:text-base shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none flex items-center justify-center gap-3 transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <Share2 className="w-5 h-5" />
            <span>Partager via votre appareil (SMS, Réseaux...)</span>
          </button>
        </div>

        {/* Section explicative propre et rassurante */}
        <div className="w-full max-w-lg text-left pt-6 pb-4 space-y-3">
          <h3 className="font-serif font-black text-base md:text-lg text-stone-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-orange-500" />
            <span>Pourquoi recommander StudyCloud ?</span>
          </h3>

          <div className="grid grid-cols-1 gap-2.5 text-xs md:text-sm text-stone-700 dark:text-slate-300">
            <div className="p-3 rounded-xl border border-stone-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 flex items-start gap-3">
              <span className="text-lg">📚</span>
              <div>
                <strong className="text-stone-900 dark:text-white block font-bold">Plateforme 100% Tout-en-un</strong>
                Cours, documents, cloud sécurisé, calculatrice scientifique et visionneuse de devoirs réunies en un seul endroit.
              </div>
            </div>

            <div className="p-3 rounded-xl border border-stone-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 flex items-start gap-3">
              <span className="text-lg">🤖</span>
              <div>
                <strong className="text-stone-900 dark:text-white block font-bold">Delmas IA Pédagogique</strong>
                Une intelligence artificielle d'assistance pour expliquer les exercices, résumer les cours et guider l'apprentissage.
              </div>
            </div>

            <div className="p-3 rounded-xl border border-stone-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 flex items-start gap-3">
              <span className="text-lg">⚡</span>
              <div>
                <strong className="text-stone-900 dark:text-white block font-bold">Accès instantané & multiplateforme</strong>
                Utilisable directement sur smartphone, tablette ou ordinateur sans installation obligatoire.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionView;
