import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize,
  Minimize,
  Download,
  RefreshCw,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { getFileBlobUrl, getFileBlob } from '../services/localFileStorage';

interface ModernImageViewerProps {
  src?: string;
  alt?: string;
  fileId?: string;
  fileName?: string;
  fileSize?: string | number;
  className?: string;
}

export const ModernImageViewer: React.FC<ModernImageViewerProps> = ({
  src,
  alt = 'Image',
  fileId,
  fileName = 'Image',
  fileSize,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Résolution de l'image (source directe ou IndexedDB)
  const resolveImage = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);

    if (src && typeof src === 'string' && src.trim()) {
      setResolvedSrc(src);
      return;
    }

    if (fileId) {
      try {
        const blobUrl = await getFileBlobUrl(fileId);
        if (blobUrl) {
          setResolvedSrc(blobUrl);
          return;
        }
      } catch (err) {
        console.warn('[ModernImageViewer] Erreur lecture IndexedDB:', err);
      }
    }

    setHasError(true);
    setIsLoading(false);
  }, [src, fileId]);

  useEffect(() => {
    resolveImage();
  }, [resolveImage]);

  // Zoom avec molette
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom(prev => Math.min(5, Math.max(0.2, prev + delta)));
  };

  // Déplacement au clic-glisser (Pan/Drag)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetTransform = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const rotate = (deg: number) => {
    setRotation(prev => (prev + deg) % 360);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`relative w-full h-full flex flex-col items-center justify-center bg-zinc-950 overflow-hidden select-none rounded-2xl ${className}`}
    >
      {/* ZONE D'AFFICHAGE DE L'IMAGE */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {resolvedSrc && !hasError && (
          <img
            src={resolvedSrc}
            alt={alt || fileName}
            onLoad={() => setIsLoading(false)}
            onError={async () => {
              if (fileId && !resolvedSrc.startsWith('blob:')) {
                const b = await getFileBlob(fileId);
                if (b) {
                  setResolvedSrc(URL.createObjectURL(b));
                  return;
                }
              }
              setHasError(true);
              setIsLoading(false);
            }}
            draggable={false}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
            className={`max-w-full max-h-full object-contain ${
              zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
          />
        )}

        {/* Chargement */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs z-10">
            <div className="w-10 h-10 rounded-full border-3 border-white/20 border-t-amber-400 animate-spin" />
          </div>
        )}

        {/* Erreur */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-zinc-300 z-20">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
              <AlertCircle className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-white mb-1">Impossible de charger cette image</p>
            <p className="text-xs text-zinc-400 max-w-sm mb-4">Le fichier image est inaccessible ou a été déplacé.</p>
            <button
              type="button"
              onClick={resolveImage}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Réessayer</span>
            </button>
          </div>
        )}
      </div>

      {/* BARRE D'OUTILS FLOTTANTE EN HAUT (Informations) */}
      <div className="absolute top-3 inset-x-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white pointer-events-auto">
          <ImageIcon className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-bold truncate max-w-[200px] sm:max-w-xs">{fileName}</span>
          {fileSize && <span className="text-[10px] text-zinc-400 font-mono">({fileSize})</span>}
        </div>

        <div className="bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[10px] text-zinc-300 font-bold pointer-events-auto">
          {Math.round(zoom * 100)}% {rotation !== 0 && `• ${rotation}°`}
        </div>
      </div>

      {/* BARRE D'OUTILS FLOTTANTE EN BAS (Contrôles Zoom, Rotation, Téléchargement) */}
      <div className="absolute bottom-4 inset-x-0 flex items-center justify-center z-10 pointer-events-none">
        <div className="flex items-center gap-1 sm:gap-2 bg-black/80 backdrop-blur-md p-1.5 sm:p-2 rounded-2xl border border-white/15 shadow-2xl text-white pointer-events-auto">
          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => setZoom(prev => Math.max(0.2, prev - 0.25))}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 text-zinc-300 hover:text-white cursor-pointer transition-colors"
            title="Zoom arrière (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Reset Zoom */}
          <button
            type="button"
            onClick={resetTransform}
            className="px-2.5 py-1 rounded-xl hover:bg-white/15 text-xs font-bold text-zinc-300 hover:text-white cursor-pointer transition-colors font-mono"
            title="Réinitialiser (100%)"
          >
            100%
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={() => setZoom(prev => Math.min(5, prev + 0.25))}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 text-zinc-300 hover:text-white cursor-pointer transition-colors"
            title="Zoom avant (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-white/20 mx-0.5" />

          {/* Rotation anti-horaire */}
          <button
            type="button"
            onClick={() => rotate(-90)}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 text-zinc-300 hover:text-white cursor-pointer transition-colors"
            title="Pivoter à gauche (-90°)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Rotation horaire */}
          <button
            type="button"
            onClick={() => rotate(90)}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 text-zinc-300 hover:text-white cursor-pointer transition-colors"
            title="Pivoter à droite (+90°)"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-white/20 mx-0.5" />

          {/* Téléchargement */}
          {resolvedSrc && (
            <a
              href={resolvedSrc}
              download={fileName || 'image.jpg'}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 text-zinc-300 hover:text-white cursor-pointer transition-colors"
              title="Télécharger l'image"
            >
              <Download className="w-4 h-4" />
            </a>
          )}

          {/* Plein écran */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 text-zinc-300 hover:text-white cursor-pointer transition-colors"
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
