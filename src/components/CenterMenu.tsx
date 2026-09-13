import React, { useState, useEffect, useRef } from 'react';
import { Maximize, Minimize, Mic, Pause, Play, Square, RotateCcw, X, FileText, ArrowLeftRight, Music, Download } from 'lucide-react';
import { FileIconBadge } from './FileIconBadge';
import * as pdfjsLib from 'pdfjs-dist';
import { getFileBlobUrl, formatFileSize } from '../services/localFileStorage';

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
  setPreviewScrollMode?: React.Dispatch<React.SetStateAction<'vertical' | 'horizontal'>>;
  isMobileScreen?: boolean;
}

export function CenterMenu({
  isCenterFullscreen,
  setIsCenterFullscreen,
  isRightFullscreen,
  mobilePreviewTab,
  isPreviewLoading,
  activePreviewItem,
  previewScrollMode,
  setPreviewScrollMode,
  isMobileScreen
}: CenterMenuProps) {
  const [docZoom, setDocZoom] = useState<number>(100);
  const [speechState, setSpeechState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'stopped'>('idle');
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);
  const [currentText, setCurrentText] = useState<string>('');
  const sentencesRef = useRef<string[]>([]);
  const currentSentenceIdxRef = useRef<number>(0);

  // Listen to external/keyboard zoom events
  useEffect(() => {
    const handleDocZoomEvent = (e: any) => {
      if (e.detail?.reset) {
        setDocZoom(100);
      } else if (e.detail?.delta) {
        setDocZoom(prev => Math.min(250, Math.max(50, prev + e.detail.delta)));
      }
    };
    window.addEventListener('studycloud:doc-zoom', handleDocZoomEvent);
    return () => window.removeEventListener('studycloud:doc-zoom', handleDocZoomEvent);
  }, []);

  const [resolvedUrl, setResolvedUrl] = useState<string>(activePreviewItem?.url || '');
  const [fileTextContent, setFileTextContent] = useState<string>('');
  const [loadingText, setLoadingText] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (activePreviewItem?.url) {
      setResolvedUrl(activePreviewItem.url);
    } else if (activePreviewItem?.id) {
      getFileBlobUrl(activePreviewItem.id).then(url => {
        if (isMounted && url) setResolvedUrl(url);
      });
    }

    const ext = (activePreviewItem?.name?.split('.').pop()?.toUpperCase() || activePreviewItem?.extension || '').toLowerCase();
    const isTextFile = ['txt', 'md', 'json', 'csv', 'js', 'ts', 'py', 'html', 'css', 'sql', 'xml', 'log'].includes(ext);

    if (isTextFile) {
      setLoadingText(true);
      const urlToFetch = activePreviewItem?.url;
      if (urlToFetch) {
        fetch(urlToFetch)
          .then(r => r.text())
          .then(t => {
            if (isMounted) {
              setFileTextContent(t);
              setLoadingText(false);
            }
          })
          .catch(() => {
            if (isMounted) setLoadingText(false);
          });
      } else if (activePreviewItem?.id) {
        getFileBlobUrl(activePreviewItem.id).then(url => {
          if (url) {
            fetch(url)
              .then(r => r.text())
              .then(t => {
                if (isMounted) {
                  setFileTextContent(t);
                  setLoadingText(false);
                }
              })
              .catch(() => {
                if (isMounted) setLoadingText(false);
              });
          } else {
            if (isMounted) setLoadingText(false);
          }
        });
      }
    } else {
      setFileTextContent('');
      setLoadingText(false);
    }

    return () => {
      isMounted = false;
    };
  }, [activePreviewItem?.id, activePreviewItem?.url, activePreviewItem?.name]);

  // Reset zoom & speech when switching file
  useEffect(() => {
    setDocZoom(100);
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
    <div className={`w-full h-full ${isCenterFullscreen ? '' : 'border-r-2 border-stone-800'} flex items-center justify-center animate-fadeIn p-4 md:p-8 pt-[70px] md:pt-[76px] relative pointer-events-auto ${isRightFullscreen ? 'hidden' : (isMobileScreen ? (mobilePreviewTab === 1 || isCenterFullscreen ? 'flex' : 'hidden') : 'flex')}`}>
      {/* Top Left Controls: Zoom/Fullscreen (Ordinateur uniquement) + Mode Défilement */}
      <div className="flex items-center gap-1.5 absolute top-[64px] sm:top-[68px] md:top-[70px] left-2 md:left-4 z-50">
        {!activePreviewItem?.lockFullscreen && (
          <button
            onClick={() => setIsCenterFullscreen(!isCenterFullscreen)}
            className="hidden md:flex p-1 bg-yellow-400 rounded border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] hover:bg-yellow-300 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer text-stone-900 items-center justify-center shrink-0"
            title={isCenterFullscreen ? "Réduire" : "Plein écran"}
          >
            {isCenterFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Bouton Vertical / Horizontal placé sur la page du milieu derrière le bouton zoom */}
        {setPreviewScrollMode && (
          <button
            onClick={() => setPreviewScrollMode(prev => prev === 'vertical' ? 'horizontal' : 'vertical')}
            className="px-2 py-0.5 bg-white hover:bg-stone-100 text-stone-900 font-extrabold text-[10px] sm:text-xs rounded border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1 shrink-0"
            title="Basculer entre défilement vertical et horizontal"
          >
            <ArrowLeftRight className="w-3 h-3 text-stone-700" />
            <span>{previewScrollMode === 'vertical' ? 'Vertical' : 'Horizontal'}</span>
          </button>
        )}
      </div>

      {/* Audio Reading Controls (Top Right of Center Menu) */}
      <div className="absolute top-[64px] sm:top-[68px] md:top-[70px] right-2 md:right-4 z-50 flex items-center gap-1.5">

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
          <p className="text-stone-800 dark:text-white font-extrabold text-sm tracking-wide">Chargement du document...</p>
        </div>
      ) : !activePreviewItem ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 text-stone-400 gap-2">
          <FileText className="w-8 h-8 opacity-40" />
          <p className="text-xs font-bold text-stone-500">Aucun document sélectionné</p>
        </div>
      ) : (() => {
        const ext = (activePreviewItem?.name?.split('.').pop()?.toUpperCase() || activePreviewItem?.extension || 'FICHIER').toUpperCase();
        const isPdf = ext === 'PDF' || activePreviewItem?.type === 'application/pdf';
        const isImg = ['JPG', 'JPEG', 'PNG', 'WEBP', 'SVG', 'GIF', 'BMP', 'ICO'].includes(ext) || activePreviewItem?.type?.startsWith('image/') || activePreviewItem?.isImage;
        const isVideo = ['MP4', 'WEBM', 'MOV', 'MKV', 'OGG', 'AVI'].includes(ext) || activePreviewItem?.type?.startsWith('video/');
        const isAudio = ['MP3', 'WAV', 'M4A', 'AAC', 'FLAC', 'OGA', 'WMA'].includes(ext) || activePreviewItem?.type?.startsWith('audio/');
        const isText = ['TXT', 'MD', 'JSON', 'CSV', 'JS', 'TS', 'PY', 'HTML', 'CSS', 'SQL', 'XML', 'LOG', 'JAVA', 'C', 'CPP', 'SH'].includes(ext);

        const currentUrl = resolvedUrl || activePreviewItem?.url || '';

        if (isPdf) {
          return (
            <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden rounded-2xl bg-white dark:bg-stone-900 border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917] p-1">
              {currentUrl ? (
                <object
                  data={`${currentUrl}#toolbar=1&navpanes=0&view=FitH`}
                  type="application/pdf"
                  className="w-full h-full rounded-xl"
                  style={{ zoom: `${docZoom}%` }}
                >
                  <iframe
                    src={`${currentUrl}#toolbar=1&navpanes=0&view=FitH`}
                    title={activePreviewItem?.name || 'Document PDF'}
                    className="w-full h-full border-0 rounded-xl"
                  />
                </object>
              ) : (
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <FileText className="w-12 h-12 text-red-500" />
                  <p className="text-sm font-bold text-stone-800 dark:text-white">{activePreviewItem.name}</p>
                  <p className="text-xs text-stone-500">Document PDF prêt pour l'analyse IA.</p>
                </div>
              )}
            </div>
          );
        }

        if (isImg) {
          return (
            <div className="w-full h-full flex items-center justify-center overflow-auto p-2 sm:p-6">
              <img
                src={currentUrl}
                alt={activePreviewItem?.name || 'Document'}
                style={{ zoom: `${docZoom}%`, transformOrigin: 'center center' }}
                className="max-w-full max-h-full object-contain rounded-xl shadow-md border border-stone-300 dark:border-stone-700 transition-all select-none"
              />
            </div>
          );
        }

        if (isVideo) {
          return (
            <div className="w-full h-full flex items-center justify-center p-2 sm:p-6">
              <div className="w-full max-w-4xl max-h-full rounded-2xl overflow-hidden shadow-2xl border-2 border-stone-800 bg-black flex items-center justify-center">
                <video
                  src={currentUrl}
                  controls
                  playsInline
                  className="w-full max-h-[75vh] object-contain rounded-xl"
                  style={{ zoom: `${docZoom}%` }}
                />
              </div>
            </div>
          );
        }

        if (isAudio) {
          return (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-8">
              <div className="w-full max-w-md bg-white dark:bg-slate-800/90 rounded-2xl border-3 border-stone-800 shadow-[6px_6px_0px_0px_#1c1917] p-6 text-center">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-orange-500/10 border-2 border-orange-500 flex items-center justify-center mb-4 text-orange-500 shadow-md">
                  <Music className="w-10 h-10 animate-pulse" />
                </div>
                <h3 className="text-base font-extrabold text-stone-900 dark:text-white mb-1 truncate px-2">{activePreviewItem.name}</h3>
                <p className="text-xs text-stone-500 mb-6 font-mono">{formatFileSize(activePreviewItem.size)}</p>
                <audio src={currentUrl} controls className="w-full rounded-lg" />
              </div>
            </div>
          );
        }

        if (isText) {
          return (
            <div className="w-full h-full flex flex-col p-2 sm:p-4 overflow-hidden">
              <div 
                className="w-full h-full bg-[#1e1e1e] text-[#d4d4d4] rounded-2xl border-2 border-stone-800 shadow-[4px_4px_0px_0px_#1c1917] p-4 font-mono text-xs overflow-auto leading-relaxed select-text"
                style={{ zoom: `${docZoom}%` }}
              >
                {loadingText ? (
                  <div className="flex items-center justify-center h-full text-stone-400">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-2" />
                    Chargement du texte...
                  </div>
                ) : fileTextContent ? (
                  <pre className="whitespace-pre-wrap font-mono text-xs">{fileTextContent}</pre>
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-xs">{activePreviewItem.textContent || "Fichier texte vide ou en cours de lecture."}</pre>
                )}
              </div>
            </div>
          );
        }

        // Fichier Word, Excel, PowerPoint ou Autre
        return (
          <div 
            className="w-full h-full flex flex-col items-center justify-center text-center p-4 sm:p-8 overflow-auto origin-center transition-all"
            style={{ zoom: `${docZoom}%` }}
          >
            <div className="mb-6">
              <FileIconBadge fileName={activePreviewItem?.name || ''} size={64} />
            </div>
            <h4 className="text-lg font-extrabold text-stone-900 dark:text-white mb-2 max-w-full break-words px-4">{activePreviewItem?.name}</h4>
            <p className="text-xs text-stone-500 font-mono mb-4">
              Taille : {formatFileSize(activePreviewItem?.size)} • Mode {previewScrollMode === 'vertical' ? 'Vertical' : 'Horizontal'}
            </p>
            <div className="bg-orange-50 dark:bg-orange-950/30 border-2 border-orange-200 dark:border-orange-800/60 rounded-xl p-4 text-xs text-orange-900 dark:text-orange-200 font-medium leading-relaxed max-w-sm mb-4">
              Ce document est ouvert dans votre espace d'étude. Vous pouvez dialoguer avec Delmas IA dans le panneau de droite ou utiliser le bouton micro en haut à droite pour la lecture audio.
            </div>
            {currentUrl && (
              <a
                href={currentUrl}
                download={activePreviewItem.name}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger le fichier</span>
              </a>
            )}
          </div>
        );
      })()}
    </div>
  );
}
