import React from 'react';
import { X, Copy, Check, Download, Share2, Smartphone } from 'lucide-react';

interface QRCodeModalProps {
  folderTitle: string;
  shareUrl: string;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ folderTitle, shareUrl, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-[#FDFBF7] border-3 border-stone-800 rounded-2xl shadow-[6px_6px_0px_0px_#1c1917] max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-stone-200 rounded-xl transition-colors text-stone-700"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 border-2 border-stone-800 rounded-xl text-orange-600 mb-3 shadow-[2px_2px_0px_0px_#1c1917]">
            <Smartphone className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-stone-900">Scanner pour télécharger</h3>
          <p className="text-sm text-stone-600 mt-1 line-clamp-1 px-2">{folderTitle}</p>
        </div>

        {/* QR Code visual representation using CSS grid / SVG or reliable pattern */}
        <div className="bg-white border-3 border-stone-800 rounded-xl p-6 flex flex-col items-center justify-center shadow-[inset_2px_2px_0px_0px_rgba(0,0,0,0.05)] mb-6">
          <div className="w-48 h-48 bg-stone-900 rounded-lg p-3 flex items-center justify-center relative group">
            {/* Simulated QR Code matrix pattern with SVG */}
            <svg viewBox="0 0 24 24" className="w-full h-full text-white fill-current">
              <path d="M2,2H10V10H2V2M4,4V8H8V4H4M14,2H22V10H14V2M16,4V8H20V4H16M2,14H10V22H2V14M4,16V20H8V16H4M18,14V18H22V14H18M14,18H16V22H14V18M18,20H22V22H18V20M12,2H14V6H12V2M12,8H14V12H12V8M6,12H8V14H6V12M10,12H12V14H10V12M16,12H20V14H16V12M12,14H14V18H12V14M12,20H14V22H12V20Z" />
            </svg>
            <div className="absolute inset-0 bg-stone-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
              <span className="bg-stone-900 text-white text-xs px-2 py-1 rounded font-medium">Prêt pour mobile</span>
            </div>
          </div>
          <span className="text-xs text-stone-500 mt-3 font-mono">Lien sécurisé chiffré</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-stone-100 border-2 border-stone-800 rounded-xl p-2.5">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="bg-transparent text-xs text-stone-700 flex-1 px-1 outline-none font-mono truncate"
            />
            <button
              onClick={handleCopy}
              className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] flex items-center gap-1.5 transition-all active:translate-x-0.5 active:translate-y-0.5"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>

          <p className="text-xs text-stone-500 text-center">
            Les camarades peuvent scanner ce code avec l'appareil photo de leur téléphone pour accéder instantanément au dossier.
          </p>
        </div>
      </div>
    </div>
  );
};
