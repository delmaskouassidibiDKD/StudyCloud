import React, { useEffect, useCallback, useRef } from 'react';

/**
 * Largeur standard du panneau de menu contextuel (256px = w-64).
 */
export const SMART_MENU_WIDTH = 256;

/**
 * Marge de sécurité minimale par rapport aux bords du viewport ou de la sidebar (px).
 */
export const SMART_SAFE_MARGIN = 10;

/**
 * Détermine dynamiquement la position droite de la barre latérale (sidebar).
 * Si la sidebar desktop est affichée, le menu ne doit JAMAIS empiéter dessus.
 */
export function getSidebarRightBoundary(): number {
  if (typeof document === 'undefined') return 0;
  
  // Cherche l'élément aside ou .sidebar-desktop
  const sidebar = document.querySelector('.sidebar-desktop') || document.querySelector('aside');
  if (sidebar) {
    const rect = sidebar.getBoundingClientRect();
    // Si la sidebar a une largeur visible (mode desktop) et est présente à l'écran
    if (rect.width > 20 && rect.right > 0) {
      return Math.max(0, rect.right);
    }
  }
  
  // Fallback desktop standard (16rem = 256px sur écran >= 768px si la sidebar existe dans l'app)
  if (typeof window !== 'undefined' && window.innerWidth >= 768) {
    const hasSidebarInDoc = Boolean(document.querySelector('aside') || document.querySelector('.sidebar-desktop'));
    if (hasSidebarInDoc) return 256;
  }
  
  return 0;
}

/**
 * Détermine dynamiquement la limite inférieure du header supérieur pour éviter tout chevauchement.
 */
export function getHeaderBottomBoundary(): number {
  if (typeof document === 'undefined') return 0;
  
  const headers = document.querySelectorAll('header');
  let maxBottom = 0;
  headers.forEach((h) => {
    const rect = h.getBoundingClientRect();
    if (rect.height > 0 && rect.top <= 20 && rect.bottom > maxBottom && rect.bottom < 250) {
      maxBottom = rect.bottom;
    }
  });
  return maxBottom;
}

export interface SmartMenuStyle {
  /** Positionnement CSS inline pour le panneau de menu */
  style: React.CSSProperties;
  /** Classes tailwind pour le style visuel de base */
  baseClass: string;
}

/**
 * Calcule intelligemment la position optimale d'un menu contextuel 3-traits
 * en respectant TOUTES les limites environnantes :
 * - Ne déborde JAMAIS sur la barre latérale gauche (sidebar) : left >= sidebarRight + marge
 * - Ne déborde JAMAIS à droite de l'écran : left + width <= viewportWidth - marge
 * - Ne déborde JAMAIS en dessous de l'écran : s'ouvre vers le haut ou restreint sa hauteur
 * - Ne déborde JAMAIS au-dessus ou sous le header : top >= headerBottom + marge
 * - Active un défilement fluide interne si la hauteur de l'écran est restreinte
 *
 * @param triggerRect - DOMRect du bouton déclencheur (obtenu via getBoundingClientRect())
 * @param menuHeight - hauteur estimée ou max du menu (par défaut 420px)
 * @param menuWidth - largeur du menu (par défaut 256px)
 */
export function computeSmartMenuStyle(
  triggerRect: DOMRect | { top: number; bottom: number; left: number; right: number; width?: number; height?: number } | null | undefined,
  menuHeight = 420,
  menuWidth = SMART_MENU_WIDTH,
): SmartMenuStyle {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;

  const sidebarRight = getSidebarRightBoundary();
  const headerBottom = getHeaderBottomBoundary();

  // Limites strictes absolues
  const minLeft = Math.max(SMART_SAFE_MARGIN, sidebarRight + SMART_SAFE_MARGIN);
  const maxRight = Math.max(minLeft + 160, vw - SMART_SAFE_MARGIN);
  const minTop = Math.max(SMART_SAFE_MARGIN, headerBottom + 6);
  const maxBottom = Math.max(minTop + 160, vh - SMART_SAFE_MARGIN);

  // Largeur finale garantie
  const availableWidth = Math.max(160, maxRight - minLeft);
  const finalWidth = Math.min(menuWidth, availableWidth);

  // Fallback sécurisé si triggerRect n'est pas encore disponible
  if (!triggerRect) {
    const safeLeft = Math.max(minLeft, Math.min(minLeft + 40, maxRight - finalWidth));
    const safeTop = Math.max(minTop, Math.min(minTop + 60, maxBottom - 300));
    return {
      style: {
        position: 'fixed',
        top: `${Math.round(safeTop)}px`,
        left: `${Math.round(safeLeft)}px`,
        width: `${Math.round(finalWidth)}px`,
        maxHeight: `${Math.round(Math.min(menuHeight, maxBottom - safeTop))}px`,
        zIndex: 99999,
      },
      baseClass:
        'studycloud-file-menu-panel bg-[#0B101D] border-2 border-slate-600/90 shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_25px_rgba(59,130,246,0.25)] text-slate-200 rounded-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150',
    };
  }

  // ── 1. Position horizontale (X) ──────────────────────────────────────────
  // Essayer d'aligner le bord gauche du menu sur le bord gauche du bouton
  let left = triggerRect.left;

  // Si aligner à gauche dépasse le bord droit du viewport :
  if (left + finalWidth > maxRight) {
    // Aligner le bord droit du menu sur le bord droit du bouton
    left = triggerRect.right - finalWidth;
  }

  // Clamping STRICT absolu :
  // Le menu ne peut JAMAIS être plus à gauche que minLeft (bord droit de la barre latérale + marge)
  // et ne peut JAMAIS dépasser maxRight à droite
  left = Math.max(minLeft, Math.min(left, maxRight - finalWidth));

  // ── 2. Position verticale (Y) ────────────────────────────────────────────
  const spaceBelow = maxBottom - (triggerRect.bottom + 4);
  const spaceAbove = (triggerRect.top - 4) - minTop;

  let top: number;
  let finalMaxHeight: number;

  if (spaceBelow >= menuHeight) {
    // Il y a largement la place en-dessous
    top = triggerRect.bottom + 4;
    finalMaxHeight = Math.min(menuHeight, spaceBelow);
  } else if (spaceAbove >= menuHeight) {
    // Pas assez de place en dessous, mais il y a la place au-dessus
    top = triggerRect.top - 4 - menuHeight;
    finalMaxHeight = menuHeight;
  } else if (spaceBelow >= spaceAbove) {
    // Aucune des deux directions ne contient 100% de menuHeight,
    // mais le bas a PLUS d'espace disponible que le haut
    top = triggerRect.bottom + 4;
    finalMaxHeight = Math.max(160, spaceBelow);
  } else {
    // Le haut a plus d'espace que le bas
    finalMaxHeight = Math.max(160, spaceAbove);
    top = (triggerRect.top - 4) - finalMaxHeight;
  }

  // Clamping STRICT absolu vertical :
  top = Math.max(minTop, Math.min(top, maxBottom - finalMaxHeight));
  finalMaxHeight = Math.min(finalMaxHeight, maxBottom - top);

  return {
    style: {
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${Math.round(finalWidth)}px`,
      maxHeight: `${Math.round(finalMaxHeight)}px`,
      zIndex: 99999,
    },
    baseClass:
      'studycloud-file-menu-panel bg-[#0B101D] border-2 border-slate-600/90 shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_25px_rgba(59,130,246,0.25)] text-slate-200 rounded-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150',
  };
}

/**
 * Hook utilitaire fermant automatiquement le menu contextuel lors d'un clic extérieur,
 * lors du défilement de la page (hors du menu lui-même) ou de la touche Escape.
 */
export function useSmartContextMenuClose(
  isOpen: boolean,
  onClose: () => void,
  panelSelector = '.studycloud-file-menu-panel',
  triggerSelector = '.studycloud-menu-trigger',
) {
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(panelSelector) || target.closest(triggerSelector)) {
        return;
      }
      onClose();
    };

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.closest && target.closest(panelSelector)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, panelSelector, triggerSelector]);
}
