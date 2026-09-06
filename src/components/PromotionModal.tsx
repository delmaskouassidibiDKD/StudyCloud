import React, { useState } from 'react';
import { X, Copy, Check, Share2, Trophy } from 'lucide-react';

interface PromotionModalProps {
  onClose: () => void;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({ onClose }) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn overflow-y-auto">
      <div className="bg-[#FDFBF7] border-3 border-stone-800 rounded-3xl shadow-[8px_8px_0px_0px_#1c1917] max-w-lg w-full p-6 text-stone-900 relative my-auto max-h-[90vh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-300 mb-6">
          <button
            onClick={() => alert("Record de promotion")}
            className="text-xs text-stone-700 hover:text-stone-900 transition-colors font-bold px-3 py-1.5 bg-stone-100 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]"
          >
            Record
          </button>
          <h2 className="text-xl font-extrabold tracking-tight text-stone-900">Promotion</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-200 rounded-xl transition-colors text-stone-700 border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Déjà promu */}
        <div className="text-center mb-6">
          <p className="text-stone-800 font-bold text-lg">
            Déjà promu <span className="text-orange-600 font-extrabold text-xl">9</span> personne(s)
          </p>
        </div>

        {/* QR Code Card */}
        <div className="bg-white border-3 border-stone-800 rounded-2xl p-6 flex flex-col items-center justify-center shadow-[4px_4px_0px_0px_#1c1917] mb-6">
          <div className="w-48 h-48 bg-stone-900 rounded-xl p-3 flex items-center justify-center relative group">
            <svg viewBox="0 0 24 24" className="w-full h-full text-white fill-current">
              <path d="M2,2H10V10H2V2M4,4V8H8V4H4M14,2H22V10H14V2M16,4V8H20V4H16M2,14H10V22H2V14M4,16V20H8V16H4M18,14V18H22V14H18M14,18H16V22H14V18M18,20H22V22H18V20M12,2H14V6H12V2M12,8H14V12H12V8M6,12H8V14H6V12M10,12H12V14H10V12M16,12H20V14H16V12M12,14H14V18H12V14M12,20H14V22H12V20Z" />
            </svg>
          </div>
          <p className="text-xs text-stone-700 mt-3 font-mono font-bold">
            Mon code d'invitation: <span className="text-orange-600">{invitationCode}</span>
          </p>
          <div className="mt-4 flex items-center gap-2 w-full">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="bg-stone-100 border-2 border-stone-800 rounded-xl text-xs px-3 py-2.5 text-stone-700 font-mono flex-1 outline-none"
            />
            <button
              onClick={handleCopy}
              className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] flex items-center gap-1.5 transition-all active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
        </div>

        {/* Partager maintenant button */}
        <div className="mb-6">
          <button
            onClick={handleShare}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-base py-3.5 px-6 rounded-2xl border-3 border-stone-800 shadow-[4px_4px_0px_0px_#1c1917] flex items-center justify-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
          >
            <Share2 className="w-5 h-5" />
            <span>Partager maintenant</span>
          </button>
        </div>

        {/* Informations promotionnelles */}
        <div className="bg-stone-100 border-2 border-stone-800 rounded-2xl p-5 shadow-inner space-y-3">
          <div className="flex items-center gap-2 mb-2">
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
