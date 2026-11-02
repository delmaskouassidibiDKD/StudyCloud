import { useEffect, useRef } from 'react';

type BackHandler = () => void;

interface HandlerEntry {
  id: string;
  handler: BackHandler;
}

class BackNavigationManager {
  private stack: HandlerEntry[] = [];
  private isHandlingPopstate = false;
  private programmaticBackCount = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this.onPopState);
    }
  }

  /**
   * Enregistre une action de retour et pousse un état dans l'historique du navigateur
   * pour que le bouton matériel / virtuel retour d'Android déclenche l'événement popstate.
   */
  public register(id: string, handler: BackHandler): () => void {
    if (typeof window === 'undefined') return () => {};

    // Si une entrée avec cet ID existe déjà, mettre à jour le handler sans repousser d'état
    const existingIndex = this.stack.findIndex((e) => e.id === id);
    if (existingIndex !== -1) {
      this.stack[existingIndex].handler = handler;
      return () => this.unregister(id);
    }

    try {
      window.history.pushState({ studyCloudBackId: id, t: Date.now() }, '');
    } catch (e) {
      console.warn('[BackNavigation] pushState error', e);
    }

    this.stack.push({ id, handler });

    return () => {
      this.unregister(id);
    };
  }

  /**
   * Désenregistre lorsqu'un modal ou sous-menu est fermé via l'interface (bouton X, fermeture par clic)
   */
  public unregister(id: string) {
    if (typeof window === 'undefined') return;

    const index = this.stack.findIndex((e) => e.id === id);
    if (index === -1) return;

    this.stack.splice(index, 1);

    // Si la fermeture n'a PAS été causée par popstate (bouton Android), consommer l'état d'historique
    if (!this.isHandlingPopstate) {
      this.programmaticBackCount++;
      try {
        window.history.back();
      } catch (e) {
        this.programmaticBackCount = Math.max(0, this.programmaticBackCount - 1);
      }
    }
  }

  private onPopState = (_event: PopStateEvent) => {
    if (this.programmaticBackCount > 0) {
      this.programmaticBackCount--;
      return;
    }

    if (this.stack.length > 0) {
      this.isHandlingPopstate = true;
      try {
        const entry = this.stack.pop();
        if (entry) {
          entry.handler();
        }
      } catch (err) {
        console.error('[BackNavigation] Erreur dans le handler de retour:', err);
      } finally {
        this.isHandlingPopstate = false;
      }
    }
  };
}

export const backNavigation = new BackNavigationManager();

/**
 * Hook React pour enregistrer automatiquement une action de retour Android
 * dès que `isActive` est vrai.
 */
export function useBackHandler(isActive: boolean, onBack: () => void, id: string) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;
    const cleanup = backNavigation.register(id, () => {
      if (onBackRef.current) {
        onBackRef.current();
      }
    });
    return cleanup;
  }, [isActive, id]);
}
