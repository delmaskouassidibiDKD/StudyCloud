import React, { useState } from 'react';
import { ArrowLeft, Copy, Check, Share2, Trophy } from 'lucide-react';

interface PromotionViewProps {
  onBack: () => void;
}

export const PromotionView: React.FC<PromotionViewProps> = ({ onBack }) => {
  const [copied, setCopied] = useState(false);
  const invitationCode = "171765542";
  const shareUrl = `https://unifolder.app/invite/${invitationCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Promotion UniFolder',
        text: `Rejoins-moi sur UniFolder avec mon code d'invitation : ${invitationCode}`,
        url: shareUrl,
      }).catch(() => {});
    } else {
      handleCopy();
      alert("Lien de parrainage copié dans le presse-papier !");
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 z-30 w-full bg-[#FDFBF7] text-stone-900 overflow-y-auto animate-fadeIn">
      {/* Sticky Fixed Back Button at the very top */}
      <div className="sticky top-0 left-0 right-0 z-40 bg-[#FDFBF7]/95 backdrop-blur-xs px-4 py-2 flex items-center justify-start border-b border-stone-200/60">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FDFBF7] hover:bg-orange-50 text-stone-900 font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </button>
      </div>

      <div className="w-full max-w-md mx-auto px-4 pt-4 pb-16 flex flex-col items-center text-center space-y-6">
        <h1 className="text-3xl font-serif font-normal text-stone-900 mb-1">Promotion</h1>

        {/* Déjà promu */}
        <div className="w-full pt-1">
          <p className="text-stone-800 font-bold text-lg">
            Déjà promu <span className="text-orange-600 font-extrabold text-xl">9</span> personne(s)
          </p>
        </div>

        {/* QR Code Section */}
        <div className="w-full flex flex-col items-center py-2 space-y-3">
          <div className="w-48 h-48 bg-white border-3 border-stone-800 rounded-2xl p-4 flex items-center justify-center shadow-[4px_4px_0px_0px_#1c1917]">
            <svg viewBox="0 0 24 24" className="w-full h-full text-stone-900 fill-current">
              <path d="M2,2H10V10H2V2M4,4V8H8V4H4M14,2H22V10H14V2M16,4V8H20V4H16M2,14H10V22H2V14M4,16V20H8V16H4M18,14V18H22V14H18M14,18H16V22H14V18M18,20H22V22H18V20M12,2H14V6H12V2M12,8H14V12H12V8M6,12H8V14H6V12M10,12H12V14H10V12M16,12H20V14H16V12M12,14H14V18H12V14M12,20H14V22H12V20Z" />
            </svg>
          </div>
          <p className="text-xs text-stone-700 font-mono font-bold tracking-wider">
            Mon code d'invitation: <span className="text-orange-600">{invitationCode}</span>
          </p>
        </div>

        {/* Action Buttons: Copier and Partager maintenant */}
        <div className="w-full space-y-3 pt-2">
          <button
            onClick={handleCopy}
            className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm py-3.5 px-6 rounded-xl border-2 border-stone-800 shadow-[4px_4px_0px_0px_#1c1917] flex items-center justify-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
            <span>{copied ? 'Lien copié !' : 'Copier le lien'}</span>
          </button>

          <button
            onClick={handleShare}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-base py-3.5 px-6 rounded-xl border-2 border-stone-800 shadow-[4px_4px_0px_0px_#1c1917] flex items-center justify-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
          >
            <Share2 className="w-5 h-5" />
            <span>Partager maintenant</span>
          </button>
        </div>

        {/* Informations promotionnelles */}
        <div className="w-full text-left pt-2 pb-8 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-600" />
            <h3 className="font-extrabold text-base text-stone-900">Informations promotionnelles</h3>
          </div>
          <ol className="text-xs text-stone-700 space-y-2.5 list-decimal pl-4 leading-relaxed font-medium">
            <li>
              Chaque fois que vous promouvez avec succès une personne, vous bénéficierez de 5 jours de publicité gratuite, qui peuvent être accumulés de manière illimitée~
            </li>
            <li>
              A total of 3 people have been promoted, and an extra 5 days of free advertising~
            </li>
            <li>
              A total of 5 people have been promoted, and an extra 10 days of free advertising~
            </li>
            <li>
              A total of 7 people have been promoted, and an extra 15 days of free advertising~
            </li>
            <li>
              A total of 10 people have been promoted, and an extra 3650 days of free advertising~
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};
