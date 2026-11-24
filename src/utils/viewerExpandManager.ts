import React from 'react';

export type ViewerExpandLevel = 0 | 1 | 2 | 3;

let currentViewerExpandLevel: ViewerExpandLevel = 0;
const listeners = new Set<() => void>();

/**
 * Définit le niveau d'agrandissement du lecteur :
 * - Niveau 0 : Mode normal / split screen (barres visibles)
 * - Niveau 1 : Agrandissement standard (barre supérieure masquée, lecteur monte à top:0)
 * - Niveau 2 : Super agrandissement (barre supérieure ET barre latérale gauche desktop masquées, plein écran)
 * - Niveau 3 : Plein écran total (barre supérieure, barre latérale gauche ET barre basse mobile masquées)
 */
export const setViewerExpandLevel = (level: ViewerExpandLevel): void => {
  if (currentViewerExpandLevel === level) return;
  currentViewerExpandLevel = level;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('studycloud_viewer_expand_change', {
        detail: { level }
      })
    );
  }
};

export const getViewerExpandLevel = (): ViewerExpandLevel => currentViewerExpandLevel;

export const subscribeViewerExpandLevel = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const resetViewerExpand = (): void => {
  if (currentViewerExpandLevel !== 0) {
    setViewerExpandLevel(0);
  }
};

/**
 * Hook React basé sur useSyncExternalStore pour garantir une synchronisation atomique
 * sans aucun décalage entre parents (App, FoldersView, Sidebar) et enfants (TeacherClassesView, tableurs),
 * même lorsqu'un composant enfant restaure viewerExpandLevel dans son effet de montage avant son parent.
 */
export const useViewerExpandLevel = (): ViewerExpandLevel => {
  return React.useSyncExternalStore(
    subscribeViewerExpandLevel,
    getViewerExpandLevel,
    getViewerExpandLevel
  );
};

