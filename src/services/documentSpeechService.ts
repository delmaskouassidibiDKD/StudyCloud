// src/services/documentSpeechService.ts
// Service global et persistant de synthèse vocale pour les documents (PDF, Word, Excel, Texte, PPTX)
// Assure la continuité en arrière-plan, lors de la navigation entre menus, après rechargement d'écran et écran éteint.

import React from 'react';

export interface SpeechSegment {
  text: string;
  page?: number;
  lineIndex?: number;
  slide?: number;
  bulletIdx?: number;
  rowIdx?: number;
  isTitle?: boolean;
}

export type DocumentSpeechState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped';

export interface DocumentSpeechSnapshot {
  state: DocumentSpeechState;
  activeFile: any | null;
  segments: SpeechSegment[];
  currentSegmentIdx: number;
  activePage: number;
  activeLineIndex: number;
  spokenWordCharIndex: number;
  spokenWordLength: number;
  autoScrollEnabled: boolean;
}

export interface DocumentSpeechSession {
  file: any;
  segments: SpeechSegment[];
  currentSegmentIdx: number;
  state: DocumentSpeechState;
  activePage: number;
  activeLineIndex: number;
  spokenWordCharIndex: number;
  spokenWordLength: number;
  autoScrollEnabled: boolean;
  wasPlaying: boolean;
  timestamp: number;
}

const STORAGE_SESSION_KEY = 'studycloud_active_speech_session';
const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

class DocumentSpeechService {
  private state: DocumentSpeechState = 'idle';
  private activeFile: any | null = null;
  private segments: SpeechSegment[] = [];
  private currentSegmentIdx: number = 0;
  private activePage: number = 1;
  private activeLineIndex: number = -1;
  private spokenWordCharIndex: number = -1;
  private spokenWordLength: number = 0;
  private autoScrollEnabled: boolean = true;

  private isExplicitlyStopped: boolean = false;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private speechWatchdogTimeout: any = null;
  private heartbeatInterval: any = null;

  private silentAudioEl: HTMLAudioElement | null = null;
  private wakeLock: any = null;
  private listeners: Set<() => void> = new Set();
  private isAwaitingGestureFlag: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initBackgroundHandlers();
    }
  }

  private initBackgroundHandlers() {
    // 1. Initialiser le son silencieux de maintien en arrière-plan
    try {
      this.silentAudioEl = document.createElement('audio');
      this.silentAudioEl.setAttribute('playsinline', '');
      this.silentAudioEl.setAttribute('webkit-playsinline', '');
      this.silentAudioEl.loop = true;
      this.silentAudioEl.volume = 0.001;
      this.silentAudioEl.src = SILENT_AUDIO_URI;
    } catch (e) {
      console.warn('[DocSpeech] Impossible de créer audio silencieux:', e);
    }

    // 2. Gestionnaire de visibilité (veille, verrouillage d'écran)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // L'écran est verrouillé ou l'application est passée en tâche de fond
        if (this.state === 'playing') {
          this.ensureSilentAudioPlaying();
        }
      } else {
        // Retour au premier plan : rafraîchir l'interface
        this.notifyListeners();
      }
    });

    // 3. Heartbeat périodique : relancer la synthèse si Chrome suspend l'audio sans erreur
    this.heartbeatInterval = setInterval(() => {
      if (this.state === 'playing' && !this.isExplicitlyStopped) {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending && !this.activeUtterance) {
            console.warn('[DocSpeechHeartbeat] Pause inopinée détectée en arrière-plan, reprise...');
            this.speakSentence(this.currentSegmentIdx);
          }
        }
      }
    }, 2500);
  }

  private ensureSilentAudioPlaying() {
    if (!this.silentAudioEl) return;
    try {
      if (this.silentAudioEl.paused) {
        const playPromise = this.silentAudioEl.play();
        if (playPromise) {
          playPromise.catch(() => {});
        }
      }
    } catch {}
  }

  private stopSilentAudio() {
    if (!this.silentAudioEl) return;
    try {
      this.silentAudioEl.pause();
      this.silentAudioEl.currentTime = 0;
    } catch {}
  }

  private async requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock?.request) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
      } catch {}
    }
  }

  private releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
      } catch {}
      this.wakeLock = null;
    }
  }

  private setupMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const fileName = this.activeFile?.name || 'Document StudyCloud';
      navigator.mediaSession.metadata = new MediaMetadata({
        title: fileName,
        artist: 'StudyCloud - Synthèse vocale',
        album: 'Lecture automatique',
        artwork: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      });
      navigator.mediaSession.playbackState = this.state === 'playing' ? 'playing' : 'paused';

      navigator.mediaSession.setActionHandler('play', () => {
        this.resume();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.pause();
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        this.stop();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.prevSentence();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.nextSentence();
      });
    } catch (e) {
      console.warn('[DocSpeech] MediaSession setup notice:', e);
    }
  }

  private clearMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = 'none';
    } catch {}
  }

  private clearWatchdogs() {
    if (this.speechWatchdogTimeout) {
      clearTimeout(this.speechWatchdogTimeout);
      this.speechWatchdogTimeout = null;
    }
  }

  private saveSession() {
    if (typeof window === 'undefined') return;
    try {
      if ((this.state === 'playing' || this.state === 'paused') && this.activeFile) {
        const session: DocumentSpeechSession = {
          file: {
            id: this.activeFile.id,
            name: this.activeFile.name,
            size: this.activeFile.size,
            type: this.activeFile.type,
            url: this.activeFile.url,
            audioUrl: this.activeFile.audioUrl,
            previewUrl: this.activeFile.previewUrl,
            r2Key: this.activeFile.r2Key,
            category: this.activeFile.category,
            isImage: this.activeFile.isImage,
            isVideo: this.activeFile.isVideo,
            isAudio: this.activeFile.isAudio,
            folderName: this.activeFile.folderName,
            textContent: this.activeFile.textContent,
            content: this.activeFile.content,
            noteTitle: this.activeFile.noteTitle,
          },
          segments: this.segments,
          currentSegmentIdx: this.currentSegmentIdx,
          state: this.state,
          activePage: this.activePage,
          activeLineIndex: this.activeLineIndex,
          spokenWordCharIndex: this.spokenWordCharIndex,
          spokenWordLength: this.spokenWordLength,
          autoScrollEnabled: this.autoScrollEnabled,
          wasPlaying: this.state === 'playing',
          timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
      } else if (this.state === 'stopped' || this.state === 'idle') {
        localStorage.removeItem(STORAGE_SESSION_KEY);
      }
    } catch (e) {}
  }

  public getSavedSession(): DocumentSpeechSession | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as DocumentSpeechSession;
      if (data && data.file && (Date.now() - (data.timestamp || 0) < 3 * 3600 * 1000)) {
        return data;
      }
    } catch (e) {}
    return null;
  }

  public restoreSession(session: DocumentSpeechSession) {
    this.activeFile = session.file;
    this.segments = session.segments || [];
    this.currentSegmentIdx = session.currentSegmentIdx || 0;
    this.activePage = session.activePage || 1;
    this.activeLineIndex = session.activeLineIndex ?? -1;
    this.autoScrollEnabled = session.autoScrollEnabled ?? true;
    this.state = 'paused';
    this.isExplicitlyStopped = false;
    this.notifyListeners();
  }

  public startSpeech(file: any, segments: SpeechSegment[], startIdx: number = 0) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert("La synthèse vocale n'est pas prise en charge sur ce navigateur.");
      return;
    }

    this.isExplicitlyStopped = false;
    this.clearWatchdogs();
    try {
      window.speechSynthesis.cancel();
    } catch {}

    this.activeFile = file;
    this.segments = segments;
    this.currentSegmentIdx = Math.max(0, Math.min(segments.length - 1, startIdx));
    const currentSeg = segments[this.currentSegmentIdx];
    if (currentSeg?.page) this.activePage = currentSeg.page;
    if (typeof currentSeg?.lineIndex === 'number') this.activeLineIndex = currentSeg.lineIndex;

    this.state = 'playing';
    this.ensureSilentAudioPlaying();
    this.requestWakeLock();
    this.setupMediaSession();
    this.saveSession();
    this.notifyListeners();

    setTimeout(() => {
      this.speakSentence(this.currentSegmentIdx);
    }, 50);
  }

  public speakSentence(index: number) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.state = 'stopped';
      this.notifyListeners();
      return;
    }

    this.clearWatchdogs();

    if (!this.segments || this.segments.length === 0 || index >= this.segments.length) {
      this.stop();
      return;
    }

    const segment = this.segments[index];
    const sentence = segment?.text?.trim();

    // Passer les segments vides
    if (!sentence || sentence.replace(/[^\w\d\u00C0-\u017F]/g, '').length === 0) {
      if (index < this.segments.length - 1) {
        setTimeout(() => {
          if (!this.isExplicitlyStopped && this.state === 'playing') {
            this.speakSentence(index + 1);
          }
        }, 25);
        return;
      } else {
        this.stop();
        return;
      }
    }

    this.currentSegmentIdx = index;
    this.spokenWordCharIndex = -1;
    this.spokenWordLength = 0;

    if (segment?.page) {
      this.activePage = segment.page;
    }
    if (typeof segment?.lineIndex === 'number') {
      this.activeLineIndex = segment.lineIndex;
    }

    this.saveSession();
    this.notifyListeners();

    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.10;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Online')))
      || voices.find(v => v.lang.startsWith('fr') || v.lang.includes('fr'));
    if (frVoice) {
      utterance.voice = frVoice;
    }

    this.activeUtterance = utterance;
    (window as any).__studyCloudUtterance = utterance;
    if (!(window as any).__studyCloudActiveUtterances) {
      (window as any).__studyCloudActiveUtterances = new Set();
    }
    (window as any).__studyCloudActiveUtterances.add(utterance);

    utterance.onboundary = (event) => {
      if (event.name === 'word' || typeof event.charIndex === 'number') {
        this.spokenWordCharIndex = event.charIndex;
        this.spokenWordLength = event.charLength || 0;
        this.notifyListeners();
      }
    };

    let hasEnded = false;
    const safeEndSentence = (nextIndex: number) => {
      if (hasEnded) return;
      hasEnded = true;

      if (this.speechWatchdogTimeout) {
        clearTimeout(this.speechWatchdogTimeout);
        this.speechWatchdogTimeout = null;
      }

      if ((window as any).__studyCloudActiveUtterances) {
        (window as any).__studyCloudActiveUtterances.delete(utterance);
      }
      this.activeUtterance = null;

      if (this.isExplicitlyStopped || this.state === 'stopped' || this.state === 'paused') {
        return;
      }

      if (nextIndex < this.segments.length) {
        setTimeout(() => {
          if (!this.isExplicitlyStopped && this.state === 'playing') {
            this.speakSentence(nextIndex);
          }
        }, 50);
      } else {
        this.stop();
      }
    };

    utterance.onend = () => {
      safeEndSentence(index + 1);
    };

    utterance.onerror = (e) => {
      if (this.isExplicitlyStopped || this.state === 'stopped' || this.state === 'paused') {
        return;
      }
      console.warn(`[DocSpeech] Événement onerror sur phrase #${index}:`, e.error);
      safeEndSentence(index + 1);
    };

    // Watchdog de sécurité par phrase
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;
    const maxExpectedDurationMs = Math.max(3500, Math.round((wordCount / 2.0) * 1000 + 4000));

    this.speechWatchdogTimeout = setTimeout(() => {
      if (!hasEnded && this.state === 'playing' && this.currentSegmentIdx === index) {
        console.warn(`[DocSpeech] Phrase #${index} dépasse le délai (${maxExpectedDurationMs}ms), passage automatique...`);
        safeEndSentence(index + 1);
      }
    }, maxExpectedDurationMs);

    this.state = 'playing';

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {}

    window.speechSynthesis.speak(utterance);
  }

  // MISE EN PAUSE SANS BLOCAGE : annule l'utterance courante pour éviter le gel V8/Chrome
  public pause() {
    if (this.state !== 'playing') return;
    this.isExplicitlyStopped = true;
    this.clearWatchdogs();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.stopSilentAudio();
    this.releaseWakeLock();
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
    this.state = 'paused';
    this.saveSession();
    this.notifyListeners();
  }

  // REPRISE INSTANTANÉE ET FLUIDE : relance immédiatement la phrase en cours
  public resume() {
    if (this.state !== 'paused' && this.state !== 'stopped') return;
    this.isExplicitlyStopped = false;
    this.ensureSilentAudioPlaying();
    this.requestWakeLock();
    this.setupMediaSession();
    this.state = 'playing';
    this.saveSession();
    this.notifyListeners();
    this.speakSentence(this.currentSegmentIdx || 0);
  }

  public togglePlayPause() {
    if (this.state === 'playing') {
      this.pause();
    } else if (this.state === 'paused') {
      this.resume();
    } else if (this.state === 'stopped' || this.state === 'idle') {
      this.resume();
    }
  }

  public stop() {
    this.isExplicitlyStopped = true;
    this.clearWatchdogs();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.stopSilentAudio();
    this.releaseWakeLock();
    this.clearMediaSession();
    this.state = 'stopped';
    this.activeUtterance = null;
    this.saveSession();
    this.notifyListeners();
  }

  public restart() {
    this.isExplicitlyStopped = false;
    this.clearWatchdogs();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.currentSegmentIdx = 0;
    this.state = 'playing';
    this.ensureSilentAudioPlaying();
    this.requestWakeLock();
    this.setupMediaSession();
    this.saveSession();
    this.notifyListeners();
    this.speakSentence(0);
  }

  public nextSentence() {
    if (this.currentSegmentIdx < this.segments.length - 1) {
      this.seekToSentence(this.currentSegmentIdx + 1);
    }
  }

  public prevSentence() {
    if (this.currentSegmentIdx > 0) {
      this.seekToSentence(this.currentSegmentIdx - 1);
    }
  }

  public seekToSentence(index: number) {
    if (index < 0 || index >= this.segments.length) return;
    this.isExplicitlyStopped = false;
    this.clearWatchdogs();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.currentSegmentIdx = index;
    if (this.state === 'playing') {
      this.speakSentence(index);
    } else {
      const seg = this.segments[index];
      if (seg?.page) this.activePage = seg.page;
      if (typeof seg?.lineIndex === 'number') this.activeLineIndex = seg.lineIndex;
      this.saveSession();
      this.notifyListeners();
    }
  }

  public setAutoScrollEnabled(enabled: boolean) {
    this.autoScrollEnabled = enabled;
    this.saveSession();
    this.notifyListeners();
  }

  public setActivePage(page: number) {
    this.activePage = page;
    this.saveSession();
    this.notifyListeners();
  }

  public clearSession() {
    this.stop();
    this.activeFile = null;
    this.segments = [];
    this.currentSegmentIdx = 0;
    this.activePage = 1;
    this.activeLineIndex = -1;
    this.state = 'idle';
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_SESSION_KEY);
      } catch (e) {}
    }
    this.notifyListeners();
  }

  public isPlaying(): boolean {
    return this.state === 'playing';
  }

  public isPaused(): boolean {
    return this.state === 'paused';
  }

  public hasActiveSession(): boolean {
    return (this.state === 'playing' || this.state === 'paused') && Boolean(this.activeFile);
  }

  public getActiveFile(): any | null {
    return this.activeFile;
  }

  public getState(): DocumentSpeechState {
    return this.state;
  }

  public getSnapshot(): DocumentSpeechSnapshot {
    return {
      state: this.state,
      activeFile: this.activeFile,
      segments: this.segments,
      currentSegmentIdx: this.currentSegmentIdx,
      activePage: this.activePage,
      activeLineIndex: this.activeLineIndex,
      spokenWordCharIndex: this.spokenWordCharIndex,
      spokenWordLength: this.spokenWordLength,
      autoScrollEnabled: this.autoScrollEnabled,
    };
  }

  public setSegmentsIfEmpty(fileId: string, segs: SpeechSegment[]) {
    // Si la session active correspond déjà au fichier et a des segments, ne pas écraser
    if (this.activeFile?.id === fileId && this.segments.length > 0) {
      return;
    }
    if (segs.length > 0) {
      this.segments = segs;
      this.notifyListeners();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('[DocSpeech] Erreur listener:', e);
      }
    });
  }
}

// Instance globale singleton
export const documentSpeechService = new DocumentSpeechService();

// Hook React pratique pour s'abonner en direct à l'état du service
export function useDocumentSpeech() {
  const [snapshot, setSnapshot] = React.useState<DocumentSpeechSnapshot>(() => documentSpeechService.getSnapshot());

  React.useEffect(() => {
    setSnapshot(documentSpeechService.getSnapshot());
    const unsubscribe = documentSpeechService.subscribe(() => {
      setSnapshot(documentSpeechService.getSnapshot());
    });
    return unsubscribe;
  }, []);

  return snapshot;
}

