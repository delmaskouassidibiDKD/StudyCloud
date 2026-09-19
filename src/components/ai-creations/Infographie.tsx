import { useState } from 'react';
import { Download, ZoomIn, ZoomOut, RotateCcw, Check } from 'lucide-react';
import infographicImg from '../../assets/infographie.png';

export default function Infographie() {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = infographicImg;
    link.download = 'infographie_5_steps.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  return (
    <div id="module-infographie" className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-16 flex flex-col items-center">
      {/* Barre d'outils d'action et zoom */}
      <div
        id="infographie-toolbar"
        className="w-full max-w-2xl flex items-center justify-between gap-3 mb-6 p-2 rounded-xl bg-white border border-stone-200 shadow-xs"
      >
        <span className="text-xs font-semibold text-stone-600 pl-2 truncate">
          Infographie : 5 étapes clés
        </span>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center bg-stone-100 rounded-lg p-0.5 border border-stone-200 text-xs">
            <button
              id="btn-infographie-zoom-out"
              onClick={() => setZoomLevel((z) => Math.max(70, z - 15))}
              className="p-1.5 hover:bg-stone-200 rounded text-stone-700 transition-colors"
              title="Zoom arrière"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono font-medium text-stone-700 min-w-[36px] text-center">
              {zoomLevel}%
            </span>
            <button
              id="btn-infographie-zoom-in"
              onClick={() => setZoomLevel((z) => Math.min(160, z + 15))}
              className="p-1.5 hover:bg-stone-200 rounded text-stone-700 transition-colors"
              title="Zoom avant"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoomLevel !== 100 && (
              <button
                id="btn-infographie-zoom-reset"
                onClick={() => setZoomLevel(100)}
                className="p-1.5 hover:bg-stone-200 rounded text-stone-500 hover:text-stone-800 transition-colors border-l border-stone-200"
                title="Réinitialiser le zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Bouton Télécharger */}
          <button
            id="btn-download-infographie"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-all shadow-xs active:scale-95"
            title="Télécharger l'infographie"
          >
            {downloaded ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Téléchargé !</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Affichage de l'infographie */}
      <div className="w-full flex justify-center overflow-auto py-2">
        <div
          id="infographie-image-wrapper"
          style={{
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out'
          }}
          className="max-w-2xl w-full"
        >
          <img
            id="infographie-image"
            src={infographicImg}
            alt="Infographie en 5 étapes"
            className="w-full h-auto rounded-xl shadow-lg border border-stone-200 object-contain mx-auto select-none"
          />
        </div>
      </div>
    </div>
  );
}
