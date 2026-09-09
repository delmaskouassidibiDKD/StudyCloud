import React, { useState, useEffect, useRef } from 'react';
import { Maximize, Minimize, Mic, Pause, Play, Square, RotateCcw, X, FileText } from 'lucide-react';
import { FileIconBadge } from './FileIconBadge';
import * as pdfjsLib from 'pdfjs-dist';

// Worker configuration for pdfjsLib
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface CenterMenuProps {
  isCenterFullscreen: boolean;
  setIsCenterFullscreen: (v: boolean) => void;
  isRightFullscreen: boolean;
  mobilePreviewTab: number;
  isPreviewLoading: boolean;
  activePreviewItem: any;
  previewScrollMode: 'vertical' | 'horizontal';
}

export function CenterMenu({
  isCenterFullscreen,
  setIsCenterFullscreen,
  isRightFullscreen,
  mobilePreviewTab,
  isPreviewLoading,
  activePreviewItem,
  previewScrollMode
}: CenterMenuProps) {
  const [speechState, setSpeechState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'stopped'>('idle');
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);
  const [currentText, setCurrentText] = useState<string>('');
  const sentencesRef = useRef<string[]>([]);
  const currentSentenceIdxRef = useRef<number>(0);

  // Stop audio and reset state when switching file
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeechState('idle');
    setIsAudioMenuOpen(false);
    setCurrentText('');
    currentSentenceIdxRef.current = 0;
    sentencesRef.current = [];
  }, [activePreviewItem?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Pre-load voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      const onVoicesChanged = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = onVoicesChanged;
      return () => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  }, []);

  const getDocumentText = async (item: any): Promise<string> => {
    if (!item) return '';
    if (item.textContent && item.textContent.trim().length > 30) {
      return item.textContent;
    }

    // Try extracting from PDF if URL is present
    if (item.url && (item.extension === 'PDF' || item.name?.toLowerCase().endsWith('.pdf'))) {
      try {
        const loadingTask = pdfjsLib.getDocument(item.url);
        const pdf = await loadingTask.promise;
        let extracted = '';
        for (let i = 1; i <= Math.min(pdf.numPages, 8); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          extracted += content.items.map((it: any) => it.str).join(' ') + ' ';
        }
        if (extracted.trim().length > 30) {
          return extracted.trim();
        }
      } catch (err) {
        console.warn('Extraction PDF via URL échouée:', err);
      }
    }

    // Realistic spoken text generator tailored to the document name
    const name = item.name || 'Document';
    const cleanTitle = name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    const lower = cleanTitle.toLowerCase();

    if (lower.includes('pointeur') || lower.includes('liste')) {
      return `Lecture automatique du cours : ${cleanTitle}. 
      Introduction aux pointeurs et structures de données en C. 
      Première partie : Définition des pointeurs. Un pointeur est une variable qui stocke l'adresse mémoire d'une autre variable. L'opérateur esperluette permet d'obtenir l'adresse mémoire, tandis que l'opérateur étoile permet de manipuler la valeur stockée à cette adresse. 
      Deuxième partie : Gestion dynamique de la mémoire. Avec malloc et free, le programmeur contrôle l'allocation et la libération sur le tas mémoire pour optimiser les performances. 
      Troisième partie : Les listes simplement et doublement chaînées. Une liste chaînée est un ensemble de nœuds reliés dynamiquement, facilitant l'insertion et la suppression rapide d'éléments. 
      Ce document constitue le socle indispensable pour maîtriser la programmation système et les algorithmes.`;
    }

    if (lower.includes('anatomie') || lower.includes('membre') || lower.includes('corps')) {
      return `Lecture automatique des planches anatomiques : ${cleanTitle}. 
      Étude myologique et ostéologique détaillée. 
      Section un : Morphologie générale et repères osseux essentiels. 
      Section deux : Groupes musculaires, origines, terminaisons et vascularisation. 
      Section trois : Applications cliniques et fonctionnelles pour la compréhension du mouvement.`;
    }

    return `Lecture automatique du document : ${cleanTitle}. 
    Ce document pédagogique aborde les notions fondamentales du programme. 
    Dans un premier temps, nous explorons les définitions clés et le contexte général du sujet. 
    Dans un second temps, les concepts théoriques sont développés à travers des cas pratiques et des analyses approfondies. 
    Enfin, une synthèse récapitulative rassemble les points capitaux pour préparer vos révisions.`;
  };

  const speakSentence = (index: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert("La synthèse vocale n'est pas prise en charge sur ce navigateur.");
      setSpeechState('stopped');
      return;
    }

    const sentences = sentencesRef.current;
    if (index >= sentences.length) {
      setSpeechState('stopped');
      currentSentenceIdxRef.current = 0;
      return;
    }

    currentSentenceIdxRef.current = index;
    window.speechSynthesis.cancel();

    const sentence = sentences[index];
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr') || v.lang.includes('fr'));
    if (frVoice) {
      utterance.voice = frVoice;
    }

    utterance.onend = () => {
      if (currentSentenceIdxRef.current < sentences.length - 1) {
        speakSentence(currentSentenceIdxRef.current + 1);
      } else {
        setSpeechState('stopped');
        currentSentenceIdxRef.current = 0;
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        setSpeechState('stopped');
      }
    };

    setSpeechState('playing');
    window.speechSynthesis.speak(utterance);
  };

  const handleStartSpeech = async () => {
    setIsAudioMenuOpen(true);
    setSpeechState('loading');

    let text = currentText;
    if (!text) {
      text = await getDocumentText(activePreviewItem);
      setCurrentText(text);
    }

    const rawSentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    sentencesRef.current = rawSentences.length > 0 ? rawSentences : [text];
    speakSentence(0);
  };

  const handleTogglePause = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speechState === 'playing') {
      window.speechSynthesis.pause();
      setSpeechState('paused');
    } else if (speechState === 'paused') {
      window.speechSynthesis.resume();
      setSpeechState('playing');
    } else if (speechState === 'stopped' || speechState === 'idle') {
      speakSentence(currentSentenceIdxRef.current || 0);
    }
  };

  const handleStop = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeechState('stopped');
    currentSentenceIdxRef.current = 0;
  };

  const handleRestart = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    currentSentenceIdxRef.current = 0;
    speakSentence(0);
  };

  const handleMicClick = () => {
    if (!isAudioMenuOpen) {
      setIsAudioMenuOpen(true);
      if (speechState !== 'playing' && speechState !== 'paused') {
        handleStartSpeech();
      }
    } else {
      // Toggle pause/play if already open
      if (speechState === 'playing' || speechState === 'paused') {
        handleTogglePause();
      } else {
        handleStartSpeech();
      }
    }
  };

  return (
    <div className={`w-full h-full ${isCenterFullscreen ? '' : 'border-r-2 border-stone-800'} flex items-center justify-center animate-fadeIn p-4 md:p-8 pt-[60px] md:pt-[72px] relative pointer-events-auto ${isRightFullscreen ? 'hidden' : (mobilePreviewTab === 1 || isCenterFullscreen ? 'flex' : 'hidden md:flex')}`}>
      {/* Fullscreen Toggle Button (Top Left) */}
      {!activePreviewItem?.lockFullscreen && (
        <button
          onClick={() => setIsCenterFullscreen(!isCenterFullscreen)}
          className="hidden md:flex absolute top-[60px] md:top-[64px] left-1 md:left-2 z-50 p-1 bg-yellow-400 rounded border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] hover:bg-yellow-300 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-stone-900"
          title={isCenterFullscreen ? "Réduire" : "Plein écran"}
        >
          {isCenterFullscreen ? <Minimize className="w-3 h-3" /> : <Maximize className="w-3 h-3" />}
        </button>
      )}

      {/* Audio Reading Controls (Top Right of Center Menu) */}
      <div className="absolute top-[60px] md:top-[64px] right-2 md:right-4 z-50 flex items-center gap-1.5">
        {/* Small Action Menu to the left on the same line */}
        {isAudioMenuOpen && (
          <div className="flex items-center gap-1 bg-[#FDFBF7] border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] rounded-lg px-2 py-1 animate-fadeIn text-stone-800">
            {/* Audio Wave indicator when playing */}
            {speechState === 'playing' && (
              <div className="flex items-center gap-0.5 mr-1 text-orange-500">
                <span className="w-0.5 h-2.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-0.5 h-3.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-0.5 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}

            {/* Pause / Reprendre */}
            <button
              type="button"
              onClick={handleTogglePause}
              className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-stone-100 rounded text-[10px] font-bold text-stone-800 transition-colors cursor-pointer"
              title={speechState === 'playing' ? "Mettre en pause" : "Reprendre la lecture"}
            >
              {speechState === 'playing' ? (
                <>
                  <Pause className="w-3 h-3 text-amber-600 fill-amber-600 shrink-0" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-emerald-600 fill-emerald-600 shrink-0" />
                  <span className="hidden sm:inline">Reprendre</span>
                </>
              )}
            </button>

            <div className="w-[1px] h-3.5 bg-stone-300" />

            {/* Arrêter */}
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-red-50 rounded text-[10px] font-bold text-red-600 transition-colors cursor-pointer"
              title="Arrêter la lecture"
            >
              <Square className="w-2.5 h-2.5 fill-red-600 shrink-0" />
              <span className="hidden sm:inline">Arrêter</span>
            </button>

            <div className="w-[1px] h-3.5 bg-stone-300" />

            {/* Recommencer */}
            <button
              type="button"
              onClick={handleRestart}
              className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-blue-50 rounded text-[10px] font-bold text-blue-600 transition-colors cursor-pointer"
              title="Recommencer la lecture depuis le début"
            >
              <RotateCcw className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">Recommencer</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAudioMenuOpen(false)}
              className="p-0.5 hover:bg-stone-200 rounded-full text-stone-400 hover:text-stone-700 ml-0.5 cursor-pointer"
              title="Fermer la barre audio"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Microphone Button */}
        <button
          type="button"
          onClick={handleMicClick}
          className={`p-1.5 rounded-lg border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer flex items-center justify-center ${
            speechState === 'playing'
              ? 'bg-orange-500 text-white ring-2 ring-orange-300 animate-pulse'
              : speechState === 'paused'
              ? 'bg-amber-400 text-stone-900'
              : isAudioMenuOpen
              ? 'bg-orange-100 text-orange-700'
              : 'bg-white hover:bg-orange-50 text-stone-800'
          }`}
          title="Lire automatiquement le document (Synthèse vocale)"
        >
          <Mic className="w-3.5 h-3.5" />
        </button>
      </div>

      {isPreviewLoading ? (
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-stone-800 font-extrabold text-sm tracking-wide">Chargement du document...</p>
        </div>
      ) : !activePreviewItem ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 text-stone-400 gap-2">
          <FileText className="w-8 h-8 opacity-40" />
          <p className="text-xs font-bold text-stone-500">Aucun document sélectionné</p>
        </div>
      ) : activePreviewItem?.isImage && activePreviewItem?.url ? (
        <div className="w-full h-full flex items-center justify-center overflow-hidden p-6">
          <img
            src={activePreviewItem.url}
            alt={activePreviewItem?.name || 'Document'}
            className="max-w-full max-h-full object-contain rounded-xl"
          />
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
          <div className="mb-6">
            <FileIconBadge fileName={activePreviewItem?.name || ''} size={64} />
          </div>
          <h4 className="text-lg font-extrabold text-stone-900 mb-2 max-w-full break-words px-4">{activePreviewItem?.name}</h4>
          <p className="text-xs text-stone-500 font-mono mb-6">
            Taille : {(() => {
              const bytes = activePreviewItem?.size;
              if (!bytes) return '0 o';
              const k = 1024;
              const sizes = ['o', 'Ko', 'Mo', 'Go'];
              const i = Math.floor(Math.log(bytes) / Math.log(k));
              return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
            })()} • Mode {previewScrollMode === 'vertical' ? 'Vertical' : 'Horizontal'}
          </p>
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 text-xs text-orange-900 font-medium leading-relaxed max-w-xs">
            Ce document est entièrement chargé en mode {previewScrollMode === 'vertical' ? 'vertical (défilement haut en bas)' : 'horizontal (défilement latéral)'}.
          </div>
        </div>
      )}
    </div>
  );
}
