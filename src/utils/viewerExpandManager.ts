import React from 'react';

export type ViewerExpandLevel = 0 | 1 | 2 | 3;

let currentViewerExpandLevel: ViewerExpandLevel = 0;

/**
 * Définit le niveau d'agrandissement du lecteur :
 * - Niveau 0 : Mode normal / split screen (barres visibles)
 * - Niveau 1 : Agrandissement standard (liste de fichiers masquée)
 * - Niveau 2 : Agrandissement vertical (barre supérieure masquée, lecteur monte à top:0)
 * - Niveau 3 : Plein écran total (barre supérieure ET barre latérale gauche masquées, lecteur prend 100% de l'écran)
 */
export const setViewerExpandLevel = (level: ViewerExpandLevel): void => {
  currentViewerExpandLevel = level;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('studycloud_viewer_expand_change', {
        detail: { level }
      })
    );
  }
};

export const getViewerExpandLevel = (): ViewerExpandLevel => currentViewerExpandLevel;

export const resetViewerExpand = (): void => {
  if (currentViewerExpandLevel !== 0) {
    setViewerExpandLevel(0);
  }
};

/**
 * Hook React pour écouter en direct les changements du niveau d'agrandissement
 */
export const useViewerExpandLevel = (): ViewerExpandLevel => {
  const [level, setLevel] = React.useState<ViewerExpandLevel>(() => getViewerExpandLevel());

  React.useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ level: ViewerExpandLevel }>;
      const nextLevel = customEvent.detail?.level ?? 0;
      setLevel(nextLevel);
    };

    window.addEventListener('studycloud_viewer_expand_change', handleEvent);
    return () => {
      window.removeEventListener('studycloud_viewer_expand_change', handleEvent);
    };
  }, []);

  return level;
};

