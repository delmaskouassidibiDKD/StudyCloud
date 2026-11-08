import React from 'react';

interface SkeletonWaveBoxProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Boîte élémentaire animée avec vague lumineuse transparente (Google-style Shimmer)
 */
export const SkeletonWaveBox: React.FC<SkeletonWaveBoxProps> = ({ className = '', style }) => {
  return (
    <div className={`skeleton-wave-box ${className}`} style={style}>
      <div className="skeleton-wave-shimmer" />
    </div>
  );
};

/**
 * Skeleton professionnel pour le menu Audio (lignes de sons avec vague fluide)
 */
export const SkeletonAudioList: React.FC<{ count?: number }> = ({ count = 6 }) => {
  const items = Array.from({ length: count });
  return (
    <div className="space-y-2.5 sm:space-y-3 py-2 w-full animate-in fade-in duration-300">
      {items.map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white/70 dark:bg-stone-900/60 border border-stone-200/60 dark:border-white/5 shadow-sm"
        >
          {/* Gauche : Pochette carrée + Titre / Artiste */}
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
            <SkeletonWaveBox className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl shrink-0" />
            <div className="space-y-2 flex-1 max-w-xs">
              <SkeletonWaveBox className="h-4 w-3/4 rounded-md" />
              <div className="flex items-center gap-2">
                <SkeletonWaveBox className="h-3 w-20 rounded" />
                <SkeletonWaveBox className="h-3 w-12 rounded" />
              </div>
            </div>
          </div>

          {/* Droite : Bouton Play circulaire + 3 points */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <SkeletonWaveBox className="w-8 h-8 sm:w-9 sm:h-9 rounded-full" />
            <SkeletonWaveBox className="w-7 h-7 rounded-full hidden sm:block" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton professionnel en grille de cartes (Documents, Vidéos, Images, Classeur, Fichiers)
 */
export const SkeletonCardGrid: React.FC<{
  count?: number;
  aspect?: 'card' | 'video' | 'square';
}> = ({ count = 8, aspect = 'card' }) => {
  const items = Array.from({ length: count });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 py-2 w-full animate-in fade-in duration-300">
      {items.map((_, i) => (
        <div
          key={i}
          className="flex flex-col p-2 rounded-2xl bg-white/70 dark:bg-stone-900/60 border border-stone-200/60 dark:border-white/5 shadow-sm overflow-hidden"
        >
          {/* Aperçu média principal */}
          <SkeletonWaveBox
            className={`w-full rounded-xl mb-2.5 ${
              aspect === 'video'
                ? 'aspect-video'
                : aspect === 'square'
                ? 'aspect-square'
                : 'aspect-[3/4]'
            }`}
          />

          {/* Titre et détails */}
          <div className="space-y-1.5 px-1 pb-1">
            <SkeletonWaveBox className="h-3.5 w-4/5 rounded-md" />
            <div className="flex items-center justify-between pt-1">
              <SkeletonWaveBox className="h-3 w-12 rounded" />
              <SkeletonWaveBox className="h-3 w-10 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

