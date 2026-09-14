import React from 'react';
import { X, Copy, Check, Download, Smartphone, Globe, Lock, QrCode } from 'lucide-react';
import { getWorkerApiUrl } from '../services/api';

interface QRCodeModalProps {
  folderTitle: string;
  shareUrl: string;
  shareCode?: string;
  country?: string;
  isPublic?: boolean;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  folderTitle,
  shareUrl,
  shareCode,
  country = "Côte d'Ivoire",
  isPublic = true,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);
  const workerBase = getWorkerApiUrl().replace(/\/+$/, '');
  const realDirectUrl = (shareCode || shareUrl?.includes('/s/'))
    ? (shareUrl?.includes('/s/') ? shareUrl : `${workerBase}/s/${shareCode}`)
    : (shareUrl || `${workerBase}/s/share`);

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(realDirectUrl)}&margin=8`;

  const handleCopy = () => {
    navigator.clipboard.writeText(realDirectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const link = document.createElement('a');
    link.href = qrImageUrl;
    link.download = `QRCode-${shareCode || 'Share'}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-[#FDFBF7] border-3 border-stone-800 rounded-3xl shadow-[8px_8px_0px_0px_#1c1917] max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-stone-200 rounded-xl transition-colors text-stone-700 border-2 border-stone-800 bg-[#F5F1E9] shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 border-2 border-stone-800 rounded-2xl text-orange-600 mb-3 shadow-[3px_3px_0px_0px_#1c1917]">
            <QrCode className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-extrabold text-stone-900">Scanner pour accéder & télécharger</h3>
          <p className="text-xs text-stone-600 mt-1 line-clamp-1 px-2 font-medium">{folderTitle}</p>

          <div className="flex items-center justify-center gap-2 mt-2.5">
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg border border-emerald-400 flex items-center gap-1">
              <span>🔒</span> Lien sécurisé
            </span>
            <span className="text-[10px] font-bold bg-white text-stone-700 px-2 py-0.5 rounded-lg border border-stone-400 flex items-center gap-1">
              <span>📍</span> {country}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
              isPublic
                ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                : 'bg-amber-100 text-amber-800 border-amber-400'
            }`}>
              {isPublic ? '🌐 Public' : '🔒 Privé'}
            </span>
          </div>
        </div>

        {/* Real QR Code Generator View */}
        <div className="bg-white border-3 border-stone-800 rounded-2xl p-5 flex flex-col items-center justify-center shadow-[4px_4px_0px_0px_#1c1917] mb-5">
          <div className="w-52 h-52 bg-white rounded-xl p-2 flex items-center justify-center border-2 border-stone-200">
            <img
              src={qrImageUrl}
              alt="Code QR de partage"
              className="w-full h-full object-contain"
              loading="lazy"
            />
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs font-mono font-bold text-stone-700">
            <Smartphone className="w-3.5 h-3.5 text-orange-600" />
            <span>Scan instantané via appareil photo</span>
          </div>
        </div>

        <div className="space-y-3">

          <div className="flex items-center gap-2 bg-stone-100 border-2 border-stone-800 rounded-xl p-2.5 shadow-[2px_2px_0px_0px_#1c1917]">
            <input
              type="text"
              readOnly
              value={realDirectUrl}
              className="bg-transparent text-xs text-stone-800 flex-1 px-1 outline-none font-mono truncate font-medium"
            />
            <button
              onClick={handleCopy}
              className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] flex items-center gap-1.5 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copié !' : 'Copier le lien'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleDownloadQR}
              className="w-full bg-white hover:bg-stone-50 text-stone-900 font-bold text-xs py-2.5 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-center gap-2 transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
            >
              <Download className="w-4 h-4 text-orange-600" />
              <span>Télécharger l'image QR</span>
            </button>
          </div>

          <p className="text-[11px] text-stone-500 text-center font-medium">
            Scannable par n'importe quel smartphone avec appareil photo ou application de QR code.
          </p>
        </div>
      </div>
    </div>
  );
};
