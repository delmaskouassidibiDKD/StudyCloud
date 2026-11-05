import React from 'react';

export type MediaFitMode = 'contain' | 'cover' | 'fill';

let currentMediaFitMode: MediaFitMode =
  typeof window !== 'undefined'
    ? ((localStorage.getItem('studycloud_video_fit') as MediaFitMode) || 'contain')
    : 'contain';

/**
 * Définit le mode de cadrage d'affichage du média (vidéo, image, etc.) :
 * - contain : Mode d'origine ajusté (avec éventuelles bandes noires latérales)
 * - cover : Plein cadre immersif (agrandi pour occuper tout l'espace sans bandes noires)
 * - fill : Étiré à 100% de la largeur et hauteur
 */
export const setMediaFitMode = (mode: MediaFitMode): void => {
  currentMediaFitMode = mode;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('studycloud_video_fit', mode);
    } catch (e) {}
    window.dispatchEvent(
      new CustomEvent('studycloud_media_fit_change', {
        detail: { mode }
      })
    );
  }
};

/**
 * Bascule entre les 3 modes de cadrage (contain -> cover -> fill -> contain)
 */
export const toggleMediaFitMode = (): MediaFitMode => {
  const nextMode: MediaFitMode =
    currentMediaFitMode === 'contain'
      ? 'cover'
      : currentMediaFitMode === 'cover'
      ? 'fill'
      : 'contain';
  setMediaFitMode(nextMode);
  return nextMode;
};

export const getMediaFitMode = (): MediaFitMode => currentMediaFitMode;

/**
 * Hook React pour synchroniser en direct le mode de cadrage dans les composants
 */
export const useMediaFitMode = (): MediaFitMode => {
  const [mode, setMode] = React.useState<MediaFitMode>(() => getMediaFitMode());

  React.useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: MediaFitMode }>;
      const nextMode = customEvent.detail?.mode ?? 'contain';
      setMode(nextMode);
    };

    window.addEventListener('studycloud_media_fit_change', handleEvent);
    return () => {
      window.removeEventListener('studycloud_media_fit_change', handleEvent);
    };
  }, []);

  return mode;
};
