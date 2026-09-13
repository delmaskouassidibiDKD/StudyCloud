import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Maximize, Minimize, Mic, Pause, Play, Square, RotateCcw, X, FileText, 
  ArrowLeftRight, ArrowUpDown, Music, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, 
  Copy, Check, Search, Table, Presentation, FileCode, Volume2, SkipBack, SkipForward, MousePointerClick
} from 'lucide-react';
import { FileIconBadge } from './FileIconBadge';
import { PdfHorizontalViewer, extractPageLines } from './PdfHorizontalViewer';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { getFileBlob, getFileBlobUrl, formatFileSize } from '../services/localFileStorage';

// Worker configuration for pdfjsLib
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
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

export interface SpeechSegment {
  text: string;
  page?: number;
  slide?: number;
  lineIndex?: number;
  isTitle?: boolean;
  bulletIdx?: number;
  rowIdx?: number;
}

export function smartSentenceSplit(text: string): string[] {
  if (!text || !text.trim()) return [];
  const clean = text.replace(/\s+/g, ' ').trim();
  const protectedText = clean
    .replace(/(\d)\.(\d)/g, '$1__DEC_DOT__$2')
    .replace(/\b(M|Mme|Mlle|Dr|Prof|Mr|Mrs|Ms|vs|etc|ex|fig)\./gi, '$1__ABBR_DOT__');
  
  const rawSentences = protectedText.split(/(?<=[.!?])\s+/);
  return rawSentences
    .map(s => s.replace(/__DEC_DOT__/g, '.').replace(/__ABBR_DOT__/g, '.').trim())
    .filter(s => s.length > 0);
}

export function prepareWordDocumentForSpeech(rawHtml: string): {
  preparedHtml: string;
  speechSegments: SpeechSegment[];
} {
  if (!rawHtml || !rawHtml.trim()) {
    return { preparedHtml: rawHtml || '', speechSegments: [] };
  }

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return { preparedHtml: rawHtml, speechSegments: [] };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const speechSegments: SpeechSegment[] = [];
    let segmentIndex = 0;

    // Find all readable block elements in natural reading order
    const allBlocks = Array.from(doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, th, td'));
    
    // Filter only leaf blocks (blocks that do not contain another candidate block inside them)
    const leafBlocks = allBlocks.filter(block => {
      return !block.querySelector('h1, h2, h3, h4, h5, h6, p, li, blockquote, th, td');
    });

    for (const block of leafBlocks) {
      const textContent = block.textContent?.trim() || '';
      if (textContent.length === 0) continue;

      const hasChildElements = block.children.length > 0;

      if (!hasChildElements) {
        // Plain text block: split into smart sentences
        const sentences = smartSentenceSplit(textContent);
        if (sentences.length <= 1) {
          const segId = `word-speech-seg-${segmentIndex}`;
          block.setAttribute('id', segId);
          block.classList.add('word-speech-seg');
          speechSegments.push({ text: sentences[0] || textContent });
          segmentIndex++;
        } else {
          // Wrap each sentence in a span with a unique speech segment ID
          block.innerHTML = sentences.map(sentence => {
            const segId = `word-speech-seg-${segmentIndex}`;
            segmentIndex++;
            speechSegments.push({ text: sentence });
            return `<span id="${segId}" class="word-speech-seg inline cursor-pointer hover:bg-amber-100/60 dark:hover:bg-amber-950/40 rounded transition-colors">${sentence}</span>`;
          }).join(' ');
        }
      } else {
        // Formatted block with tags (strong, em, a, etc.): tag the block itself to keep 100% markup intact
        const segId = `word-speech-seg-${segmentIndex}`;
        block.setAttribute('id', segId);
        block.classList.add('word-speech-seg', 'cursor-pointer');
        speechSegments.push({ text: textContent });
        segmentIndex++;
      }
    }

    return {
      preparedHtml: doc.body.innerHTML,
      speechSegments,
    };
  } catch (err) {
    console.warn('[prepareWordDocumentForSpeech] Erreur parsing DOM:', err);
    return { preparedHtml: rawHtml, speechSegments: [] };
  }
}


function renderSpokenSentence(text: string, charIndex: number, wordLength: number) {
  if (!text) return null;
  if (charIndex < 0) {
    return (
      <span className="font-semibold underline decoration-orange-400 decoration-2 underline-offset-4">
        {text}
      </span>
    );
  }

  const before = text.slice(0, charIndex);
  let wordEnd = wordLength > 0 ? charIndex + wordLength : -1;
  if (wordEnd === -1 || wordEnd <= charIndex) {
    const nextSpace = text.indexOf(' ', charIndex);
    wordEnd = nextSpace === -1 ? text.length : nextSpace;
  }
  const currentWord = text.slice(charIndex, wordEnd);
  const after = text.slice(wordEnd);

  return (
    <span>
      <span className="opacity-70">{before}</span>
      <span className="bg-amber-300 dark:bg-amber-500/40 text-stone-950 dark:text-white font-extrabold px-1.5 py-0.5 rounded shadow-xs underline decoration-orange-600 dark:decoration-orange-400 decoration-3 underline-offset-4 animate-pulse">
        {currentWord}
      </span>
      <span>{after}</span>
    </span>
  );
}

interface PptxSlide {
  slideNumber: number;
  title: string;
  bullets: string[];
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
  const [speechSegments, setSpeechSegments] = useState<SpeechSegment[]>([]);
  const [currentSegmentIdx, setCurrentSegmentIdx] = useState<number>(0);
  const [activeSpeechPage, setActiveSpeechPage] = useState<number>(1);
  const [activeSpeechLineIndex, setActiveSpeechLineIndex] = useState<number>(-1);
  const [currentPdfViewerPage, setCurrentPdfViewerPage] = useState<number>(1);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [spokenWordCharIndex, setSpokenWordCharIndex] = useState<number>(-1);
  const [spokenWordLength, setSpokenWordLength] = useState<number>(0);
  const speechSegmentsRef = useRef<SpeechSegment[]>([]);
  const currentSentenceIdxRef = useRef<number>(0);
  const autoScrollEnabledRef = useRef<boolean>(true);
  const activeSentenceElRef = useRef<HTMLElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    autoScrollEnabledRef.current = autoScrollEnabled;
  }, [autoScrollEnabled]);

  // Watchdog pour éviter que Chrome / Edge ne bloque la synthèse vocale
  useEffect(() => {
    if (speechState !== 'playing') return;
    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [speechState]);

  // Resolved binary / URL state
  const [resolvedUrl, setResolvedUrl] = useState<string>(() => {
    if (activePreviewItem?.url && !activePreviewItem.url.startsWith('blob:')) {
      return activePreviewItem.url;
    }
    return '';
  });
  const [isLoadingDocument, setIsLoadingDocument] = useState<boolean>(false);
  const [extractedDocText, setExtractedDocText] = useState<string>('');

  // Formats state
  const [fileTextContent, setFileTextContent] = useState<string>('');
  const [docxHtml, setDocxHtml] = useState<string>('');
  const [wordSpeechSegments, setWordSpeechSegments] = useState<SpeechSegment[]>([]);
  const [excelWorkbook, setExcelWorkbook] = useState<{
    sheetNames: string[];
    activeSheet: string;
    rows: any[][];
    searchQuery: string;
  } | null>(null);
  const [pptxSlides, setPptxSlides] = useState<PptxSlide[]>([]);
  const [activeSlideIdx, setActiveSlideIdx] = useState<number>(0);

  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [pdfViewerMode, setPdfViewerMode] = useState<'native' | 'interactive'>('native');
  const [topPortalEl, setTopPortalEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const el = document.getElementById('studycloud-top-audio-portal');
      if (el) setTopPortalEl(el);
    }
  }, [activePreviewItem?.id, isAudioMenuOpen, isCenterFullscreen]);

  const ext = (activePreviewItem?.name?.split('.').pop()?.toUpperCase() || activePreviewItem?.extension || 'FICHIER').toUpperCase();
  const isPdf = ext === 'PDF' || 
                activePreviewItem?.type === 'application/pdf' || 
                activePreviewItem?.type?.includes('pdf') ||
                activePreviewItem?.url?.toLowerCase()?.includes('.pdf') ||
                activePreviewItem?.name?.toLowerCase()?.endsWith('.pdf');
  const isWord = ['DOCX', 'DOC'].includes(ext);
  const isExcel = ['XLSX', 'XLS', 'CSV'].includes(ext);
  const isPpt = ['PPTX', 'PPT'].includes(ext);
  const isText = ['TXT', 'MD', 'JSON', 'JS', 'TS', 'PY', 'HTML', 'CSS', 'SQL', 'XML', 'LOG', 'JAVA', 'C', 'CPP', 'SH', 'ENV'].includes(ext);

  // Le zoom applicatif StudyCloud doit apparaître UNIQUEMENT dans la partie lecture automatique et soulignement (surlignage)
  const isLectureEtSoulignement = Boolean(
    isPdf
      ? (pdfViewerMode === 'interactive' || previewScrollMode === 'horizontal' || speechState === 'playing' || speechState === 'paused')
      : (speechState === 'playing' || speechState === 'paused')
  );

  useEffect(() => {
    if (!isLectureEtSoulignement) {
      setDocZoom(100);
    }
  }, [isLectureEtSoulignement]);

  const effectiveZoom = isLectureEtSoulignement ? docZoom : 100;

  // Le basculement vers le mode horizontal ou vertical ne doit JAMAIS activer la lecture automatique ni le soulignage
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeechState('idle');
    setActiveSpeechLineIndex(-1);
    setSpokenWordCharIndex(-1);
  }, [previewScrollMode]);

  // Listen to external speech toggle from header
  useEffect(() => {
    const handleToggleSpeech = () => handleMicClick();
    window.addEventListener('studycloud:toggle-speech', handleToggleSpeech);
    return () => window.removeEventListener('studycloud:toggle-speech', handleToggleSpeech);
  });

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

  // Main loader for any document
  useEffect(() => {
    let isMounted = true;
    const file = activePreviewItem;
    if (!file) return;

    setIsLoadingDocument(true);
    setFileTextContent('');
    setDocxHtml('');
    setExcelWorkbook(null);
    setPptxSlides([]);
    setActiveSlideIdx(0);
    setExtractedDocText('');

    const fileExt = (file.name?.split('.').pop() || file.extension || '').toLowerCase();

    // 1. Resolve URL for media/PDF
    if (file.id) {
      getFileBlobUrl(file.id).then(url => {
        if (isMounted && url) setResolvedUrl(url);
      });
    } else if (file.url && !file.url.startsWith('blob:')) {
      setResolvedUrl(file.url);
    }

    // 2. Fetch binary blob for in-depth parsing (mammoth, xlsx, jszip, text)
    const loadBinaryData = async () => {
      let blob: Blob | null = null;
      if (file.id) {
        blob = await getFileBlob(file.id);
      }
      if (!blob && file.url) {
        try {
          const resp = await fetch(file.url);
          blob = await resp.blob();
        } catch (e) {
          console.warn('CenterMenu fetch fallback error:', e);
        }
      }

      if (!isMounted) return;

      const isText = ['txt', 'md', 'json', 'csv', 'js', 'ts', 'py', 'html', 'css', 'sql', 'xml', 'log', 'java', 'c', 'cpp', 'sh', 'env'].includes(fileExt);
      const isWord = ['docx', 'doc'].includes(fileExt);
      const isExcel = ['xlsx', 'xls', 'csv'].includes(fileExt);
      const isPpt = ['pptx', 'ppt'].includes(fileExt);

      if (isWord && blob) {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const conv = await mammoth.convertToHtml({ arrayBuffer });
          const raw = await mammoth.extractRawText({ arrayBuffer });
          const rawHtml = conv.value || '<p>Document Word vide.</p>';
          const { preparedHtml, speechSegments: wordSegments } = prepareWordDocumentForSpeech(rawHtml);
          if (isMounted) {
            setDocxHtml(preparedHtml);
            setWordSpeechSegments(wordSegments);
            setExtractedDocText(raw.value || wordSegments.map(s => s.text).join('\n'));
          }
        } catch (err) {
          console.warn('Erreur décodage Word:', err);
          if (isMounted) {
            setDocxHtml('<p class="text-stone-500 italic">Formatage automatique impossible pour ce fichier Word.</p>');
          }
        }
      } else if (isExcel && blob) {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetNames = workbook.SheetNames || [];
          const activeSheet = sheetNames[0] || 'Feuille 1';
          const worksheet = workbook.Sheets[activeSheet];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          const csvText = XLSX.utils.sheet_to_csv(worksheet);

          if (isMounted) {
            setExcelWorkbook({
              sheetNames,
              activeSheet,
              rows: rows.length > 0 ? rows : [['(Tableau vide)']],
              searchQuery: '',
            });
            setExtractedDocText(csvText);
          }
        } catch (err) {
          console.warn('Erreur décodage Excel:', err);
        }
      } else if (isPpt && blob) {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const zip = await JSZip.loadAsync(arrayBuffer);
          const slideFiles = Object.keys(zip.files).filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k));
          
          slideFiles.sort((a, b) => {
            const nA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
            const nB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
            return nA - nB;
          });

          const slides: PptxSlide[] = [];
          let allSlideText = '';

          for (let i = 0; i < slideFiles.length; i++) {
            const rawXml = await zip.files[slideFiles[i]].async('string');
            const matches = rawXml.match(/<a:t>([^<]*)<\/a:t>/g);
            if (matches) {
              const textItems = matches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
              if (textItems.length > 0) {
                const title = textItems[0];
                const bullets = textItems.slice(1);
                slides.push({ slideNumber: i + 1, title, bullets });
                allSlideText += `\nDiapositive ${i + 1}: ${title}\n` + bullets.join('\n');
              }
            }
          }

          if (isMounted) {
            if (slides.length > 0) {
              setPptxSlides(slides);
              setExtractedDocText(allSlideText);
            } else {
              setPptxSlides([{
                slideNumber: 1,
                title: file.name,
                bullets: ['Présentation PowerPoint prête pour révision et analyse IA.']
              }]);
            }
          }
        } catch (err) {
          console.warn('Erreur décodage PPTX:', err);
        }
      } else if (isText) {
        if (blob) {
          try {
            const text = await blob.text();
            if (isMounted) {
              setFileTextContent(text);
              setExtractedDocText(text);
            }
          } catch (e) {
            console.warn('Erreur lecture texte blob:', e);
          }
        } else if (file.textContent) {
          if (isMounted) {
            setFileTextContent(file.textContent);
            setExtractedDocText(file.textContent);
          }
        }
      }

      if (isMounted) {
        setIsLoadingDocument(false);
      }
    };

    loadBinaryData();

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
    speechSegmentsRef.current = [];
    setSpeechSegments([]);
    setWordSpeechSegments([]);
    setCurrentSegmentIdx(0);
    setActiveSpeechPage(1);
    setActiveSpeechLineIndex(-1);
    setCurrentPdfViewerPage(1);
    setSpokenWordCharIndex(-1);
    setPdfViewerMode('native');
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

  const extractPdfSegments = async (fileId?: string, url?: string): Promise<SpeechSegment[]> => {
    try {
      let arrayBuffer: ArrayBuffer | null = null;
      if (fileId) {
        try {
          const blob = await getFileBlob(fileId);
          if (blob) arrayBuffer = await blob.arrayBuffer();
        } catch (e) {}
      }
      if (!arrayBuffer && activePreviewItem && typeof activePreviewItem.arrayBuffer === 'function') {
        try {
          arrayBuffer = await activePreviewItem.arrayBuffer();
        } catch (e) {}
      }
      if (!arrayBuffer && url) {
        try {
          const resp = await fetch(url);
          if (resp.ok) arrayBuffer = await resp.arrayBuffer();
        } catch (e) {}
      }
      if (!arrayBuffer) return [];

      const typedarray = new Uint8Array(arrayBuffer);
      const loadingTask = pdfjsLib.getDocument({ data: typedarray, cMapPacked: true });
      const pdf = await loadingTask.promise;
      const result: SpeechSegment[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const pageLines = await extractPageLines(page, pageNum);
        for (const l of pageLines) {
          result.push({ text: l.text, page: pageNum, lineIndex: l.lineIndex });
        }
      }
      return result;
    } catch (e) {
      console.warn('[CenterMenu] Erreur extraction segments PDF:', e);
      return [];
    }
  };

  const getDocumentText = async (item: any): Promise<string> => {
    if (!item) return '';
    if (extractedDocText && extractedDocText.trim().length > 5) {
      return extractedDocText.trim();
    }
    if (item.textContent && item.textContent.trim().length > 5) {
      return item.textContent.trim();
    }
    if (fileTextContent && fileTextContent.trim().length > 5) {
      return fileTextContent.trim();
    }

    if (isPdf && (item.id || item.url)) {
      const segs = await extractPdfSegments(item.id, resolvedUrl || item.url);
      if (segs.length > 0) {
        return segs.map(s => s.text).join('\n');
      }
    }

    const name = item.name || 'Document';
    const cleanTitle = name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    return `Lecture du document ${cleanTitle}.`;
  };

  const speakSentence = (index: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert("La synthèse vocale n'est pas prise en charge sur ce navigateur.");
      setSpeechState('stopped');
      return;
    }

    const segments = speechSegmentsRef.current;
    if (!segments || segments.length === 0 || index >= segments.length) {
      setSpeechState('stopped');
      currentSentenceIdxRef.current = 0;
      setCurrentSegmentIdx(0);
      setActiveSpeechLineIndex(-1);
      setSpokenWordCharIndex(-1);
      activeUtteranceRef.current = null;
      return;
    }

    const segment = segments[index];
    const sentence = segment?.text?.trim();

    // Passer les segments vides ou sans caractères prononçables
    if (!sentence || sentence.replace(/[^\w\d\u00C0-\u017F]/g, '').length === 0) {
      if (index < segments.length - 1) {
        speakSentence(index + 1);
        return;
      } else {
        setSpeechState('stopped');
        return;
      }
    }

    currentSentenceIdxRef.current = index;
    setCurrentSegmentIdx(index);
    setSpokenWordCharIndex(-1);
    setSpokenWordLength(0);

    if (segment?.page) {
      setActiveSpeechPage(segment.page);
    }
    if (typeof segment?.lineIndex === 'number') {
      setActiveSpeechLineIndex(segment.lineIndex);
    }

    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.12; // Lecture fluide, naturelle et dynamique (pas lente)
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Online')))
      || voices.find(v => v.lang.startsWith('fr') || v.lang.includes('fr'));
    if (frVoice) {
      utterance.voice = frVoice;
    }

    // Référence active pour empêcher le ramasse-miettes (Garbage Collector) de Chrome/Edge
    activeUtteranceRef.current = utterance;
    (window as any).__studyCloudUtterance = utterance;

    // Suivi précis du mot prononcé pour le soulignage dynamique (sur Word/Texte uniquement pour éviter re-renders constants sur PDF)
    utterance.onboundary = (event) => {
      if (isWord || isText) {
        if (event.name === 'word' || typeof event.charIndex === 'number') {
          setSpokenWordCharIndex(event.charIndex);
          setSpokenWordLength(event.charLength || 0);
        }
      }
    };

    utterance.onend = () => {
      activeUtteranceRef.current = null;
      if (currentSentenceIdxRef.current < speechSegmentsRef.current.length - 1) {
        speakSentence(currentSentenceIdxRef.current + 1);
      } else {
        setSpeechState('stopped');
        currentSentenceIdxRef.current = 0;
        setCurrentSegmentIdx(0);
        setActiveSpeechLineIndex(-1);
        setSpokenWordCharIndex(-1);
      }
    };

    utterance.onerror = (e) => {
      activeUtteranceRef.current = null;
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        if (currentSentenceIdxRef.current < speechSegmentsRef.current.length - 1) {
          speakSentence(currentSentenceIdxRef.current + 1);
        } else {
          setSpeechState('stopped');
          setActiveSpeechLineIndex(-1);
          setSpokenWordCharIndex(-1);
        }
      }
    };

    // Défilement automatique du fichier vers la phrase lue si activé
    if (autoScrollEnabledRef.current) {
      if (segment.slide) {
        setActiveSlideIdx(segment.slide - 1);
      }
      if (activeSentenceElRef.current) {
        activeSentenceElRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    setSpeechState('playing');
    window.speechSynthesis.speak(utterance);
  };

  const handleStartSpeech = async () => {
    setIsAudioMenuOpen(true);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    let segments = speechSegmentsRef.current;

    if (isPdf && pdfViewerMode !== 'interactive') {
      setPdfViewerMode('interactive');
    }

    if (!segments || segments.length === 0) {
      setSpeechState('loading');

      // 1. PDF
      if (isPdf) {
        segments = await extractPdfSegments(activePreviewItem?.id, resolvedUrl || activePreviewItem?.url);
      }
      // 2. PPTX
      else if (isPpt && pptxSlides.length > 0) {
        segments = [];
        pptxSlides.forEach(slide => {
          if (slide.title?.trim()) {
            segments.push({ 
              text: slide.title.trim(), 
              slide: slide.slideNumber,
              isTitle: true 
            });
          }
          slide.bullets.forEach((b, bIdx) => {
            if (b.trim()) {
              segments.push({ 
                text: b.trim(), 
                slide: slide.slideNumber,
                bulletIdx: bIdx 
              });
            }
          });
        });
      }
      // 3. EXCEL
      else if (isExcel && excelWorkbook?.rows) {
        segments = [];
        excelWorkbook.rows.forEach((r, originalRowIdx) => {
          const line = r
            .filter(c => c !== undefined && c !== null && String(c).trim().length > 0)
            .map(c => String(c).trim())
            .join(', ');
          if (line.length > 0) {
            segments.push({ text: line, rowIdx: originalRowIdx });
          }
        });
      }
      // 4. WORD
      else if (isWord) {
        if (wordSpeechSegments.length > 0) {
          segments = wordSpeechSegments;
        } else if (docxHtml) {
          const prep = prepareWordDocumentForSpeech(docxHtml);
          setDocxHtml(prep.preparedHtml);
          setWordSpeechSegments(prep.speechSegments);
          segments = prep.speechSegments;
        }
      }
      // 5. TEXT / CODE
      else if (isText) {
        const raw = fileTextContent || activePreviewItem.textContent || '';
        if (raw) {
          const sentences = smartSentenceSplit(raw);
          segments = sentences.map((text, idx) => ({ text, lineIndex: idx }));
        }
      }

      // Fallback si rien trouvé
      if (!segments || segments.length === 0) {
        let text = await getDocumentText(activePreviewItem);
        const rawSentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
        segments = (rawSentences.length > 0 ? rawSentences : [text]).map(t => ({ text: t }));
      }
    }

    if (!segments || segments.length === 0) {
      segments = [{ text: `Lecture du document ${activePreviewItem?.name || ''}.`, page: 1 }];
    }

    speechSegmentsRef.current = segments;
    setSpeechSegments(segments);

    let startIdx = 0;
    if (currentPdfViewerPage > 1) {
      const idxOnPage = segments.findIndex(s => s.page === currentPdfViewerPage);
      if (idxOnPage !== -1) startIdx = idxOnPage;
    }

    setTimeout(() => {
      speakSentence(startIdx);
    }, 50);
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
    setCurrentSegmentIdx(0);
    setActiveSpeechLineIndex(-1);
    setSpokenWordCharIndex(-1);
  };

  const handleRestart = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    currentSentenceIdxRef.current = 0;
    setCurrentSegmentIdx(0);
    setSpokenWordCharIndex(-1);
    if (isPdf) setPdfViewerMode('interactive');
    speakSentence(0);
  };

  const handleMicClick = () => {
    if (!isAudioMenuOpen) {
      setIsAudioMenuOpen(true);
      if (speechState !== 'playing' && speechState !== 'paused') {
        if (isPdf) setPdfViewerMode('interactive');
        handleStartSpeech();
      }
    } else {
      if (speechState === 'playing' || speechState === 'paused') {
        handleTogglePause();
      } else {
        if (isPdf) setPdfViewerMode('interactive');
        handleStartSpeech();
      }
    }
  };

  const handleSwitchExcelSheet = async (sheetName: string) => {
    if (!activePreviewItem) return;
    let blob = await getFileBlob(activePreviewItem.id);
    if (!blob && activePreviewItem.url) {
      const resp = await fetch(activePreviewItem.url);
      blob = await resp.blob();
    }
    if (blob) {
      const arrayBuffer = await blob.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      setExcelWorkbook(prev => prev ? {
        ...prev,
        activeSheet: sheetName,
        rows: rows.length > 0 ? rows : [['(Feuille vide)']],
      } : null);
    }
  };

  useEffect(() => {
    if (!autoScrollEnabled || (speechState !== 'playing' && speechState !== 'paused')) return;
    const target = document.getElementById(`word-speech-seg-${currentSegmentIdx}`) || 
                   document.getElementById('active-excel-speech-target') ||
                   document.getElementById('active-pptx-speech-target') ||
                   document.getElementById('active-text-speech-target');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSegmentIdx, speechState, autoScrollEnabled]);

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    });
  };

  return (
    <div className={`w-full h-full ${isCenterFullscreen ? '' : 'border-r border-stone-300 dark:border-stone-800'} flex flex-col animate-fadeIn relative pointer-events-auto overflow-hidden bg-white dark:bg-stone-950 pt-[44px] ${isRightFullscreen ? 'hidden' : (isMobileScreen ? (mobilePreviewTab === 1 || isCenterFullscreen ? 'flex' : 'hidden') : 'flex')}`}>
      
      {/* Sleek Document Action Bar: Present for ALL documents (PDF, Word, Excel, PPTX, Images, Code) */}
      {activePreviewItem && (
        <div className="w-full bg-[#FDFBF7] dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 px-3 py-1 flex items-center justify-between shrink-0 z-30 h-9">
          {/* Left: Plein écran, Zoom (- 100% +), Défilement */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {!activePreviewItem?.lockFullscreen && (
              <button
                onClick={() => {
                  const next = !isCenterFullscreen;
                  setIsCenterFullscreen(next);
                  if (!next) {
                    setDocZoom(100);
                  }
                }}
                className="p-1.5 bg-amber-400 hover:bg-amber-300 rounded-lg text-stone-900 items-center justify-center shrink-0 transition-colors cursor-pointer border border-stone-300 dark:border-stone-700"
                title={isCenterFullscreen ? "Réduire à 3 colonnes" : "Agrandir en plein écran"}
              >
                {isCenterFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Application Zoom Controls : Apparaît UNIQUEMENT dans la partie lecture automatique et soulignement (surlignage) */}
            {isLectureEtSoulignement && (
              <div className="flex items-center bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 p-0.5 shadow-sm animate-fadeIn">
                <button
                  onClick={() => setDocZoom(prev => Math.max(40, prev - 15))}
                  className="p-1 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded transition-colors cursor-pointer"
                  title="Zoom arrière (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setDocZoom(100)}
                  className="px-2 py-0.5 text-stone-800 dark:text-stone-200 font-bold text-[10px] sm:text-xs hover:bg-stone-100 dark:hover:bg-stone-700 rounded transition-colors cursor-pointer"
                  title="Réinitialiser à 100%"
                >
                  {docZoom}%
                </button>

                <button
                  onClick={() => setDocZoom(prev => Math.min(250, prev + 15))}
                  className="p-1 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded transition-colors cursor-pointer"
                  title="Zoom avant (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {setPreviewScrollMode && (
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                  }
                  setSpeechState('idle');
                  setActiveSpeechLineIndex(-1);
                  setSpokenWordCharIndex(-1);
                  setPreviewScrollMode(prev => prev === 'vertical' ? 'horizontal' : 'vertical');
                }}
                className={`px-2 py-1 text-[10px] sm:text-xs rounded-lg border items-center gap-1 transition-all cursor-pointer flex shadow-sm font-bold ${
                  previewScrollMode === 'horizontal'
                    ? 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-400 dark:border-orange-600 ring-1 ring-orange-400'
                    : 'bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700'
                }`}
                title={previewScrollMode === 'vertical' ? "Activer le défilement horizontal (de gauche à droite)" : "Activer le défilement vertical"}
              >
                {previewScrollMode === 'horizontal' ? (
                  <ArrowLeftRight className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                ) : (
                  <ArrowUpDown className="w-3 h-3 text-stone-500" />
                )}
                <span>{previewScrollMode === 'vertical' ? 'Vertical' : 'Horizontal'}</span>
              </button>
            )}

            {isPdf && previewScrollMode === 'vertical' && (
              <button
                type="button"
                onClick={() => setPdfViewerMode(prev => prev === 'native' ? 'interactive' : 'native')}
                className={`px-2 py-1 text-[10px] sm:text-xs rounded-lg border flex items-center gap-1 font-bold transition-all cursor-pointer shadow-sm ${
                  pdfViewerMode === 'native'
                    ? 'bg-stone-900 text-white border-stone-800 hover:bg-stone-800'
                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                }`}
                title={pdfViewerMode === 'native' ? "Passer en mode lecture vocale avec surlignage" : "Revenir à la visionneuse PDF native (avec barre d'outils noire)"}
              >
                {pdfViewerMode === 'native' ? (
                  <>
                    <FileText className="w-3 h-3 text-amber-400" />
                    <span>Outils PDF</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>Surlignage</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Right: Audio Playback Controls & Microphone Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Définition des boutons de contrôle de lecture (Pause, Arrêt, Recommencer, Défilement auto) */}
            {isAudioMenuOpen && (() => {
              const audioControls = (
                <div className="flex items-center gap-1 bg-white dark:bg-stone-800 px-2 py-0.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 shadow-sm shrink-0 animate-fadeIn">
                  {speechState === 'playing' && (
                    <div className="flex items-center gap-0.5 mr-1 text-orange-500">
                      <span className="w-0.5 h-2.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-0.5 h-3.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-0.5 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className="p-1 hover:bg-stone-100 dark:hover:bg-stone-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                    title={speechState === 'playing' ? "Pause" : "Reprendre"}
                  >
                    {speechState === 'playing' ? (
                      <Pause className="w-3.5 h-3.5 text-amber-600 fill-amber-600 shrink-0" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleStop}
                    className="p-1 hover:bg-red-50 dark:hover:bg-red-950/40 rounded text-red-600 transition-colors cursor-pointer"
                    title="Arrêter"
                  >
                    <Square className="w-3 h-3 fill-red-600 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={handleRestart}
                    className="p-1 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded text-blue-600 transition-colors cursor-pointer"
                    title="Recommencer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  </button>

                  {/* Auto-Scroll Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setAutoScrollEnabled(prev => !prev)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                      autoScrollEnabled
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-300 dark:border-stone-600'
                    }`}
                    title={autoScrollEnabled ? "Défilement auto actif (cliquer pour arrêter et faufiler librement)" : "Défilement auto arrêté (cliquer pour réactiver)"}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${autoScrollEnabled ? 'bg-emerald-500 animate-ping' : 'bg-stone-400'}`} />
                    <span className="hidden sm:inline">{autoScrollEnabled ? "Auto-scroll" : "Libre"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAudioMenuOpen(false)}
                    className="p-0.5 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full text-stone-400 hover:text-stone-600 ml-0.5 cursor-pointer"
                    title="Fermer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );

              // 1. Si écran agrandi (plein écran) : afficher à côté du micro
              if (isCenterFullscreen) {
                return audioControls;
              }

              // 2. Si écran réduit / 3 colonnes : afficher en haut au-dessus de la page (dans le header portal)
              const portalTarget = topPortalEl || (typeof document !== 'undefined' ? document.getElementById('studycloud-top-audio-portal') : null);
              if (portalTarget) {
                return createPortal(audioControls, portalTarget);
              }

              return audioControls;
            })()}

            <button
              type="button"
              onClick={handleMicClick}
              className={`px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shrink-0 ${
                speechState === 'playing'
                  ? 'bg-orange-500 text-white animate-pulse ring-2 ring-orange-300'
                  : speechState === 'paused'
                  ? 'bg-amber-400 text-stone-900'
                  : isAudioMenuOpen
                  ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400'
                  : 'bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200'
              }`}
              title="Lire automatiquement le document (Synthèse vocale)"
            >
              <Mic className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-[10px] font-bold">Vocal</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Document Content Area: Occupies 100% of the space edge-to-edge */}
      <div className="flex-1 w-full h-full overflow-hidden relative">
        {isPreviewLoading || isLoadingDocument ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-white dark:bg-stone-950">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-stone-800 dark:text-white font-extrabold text-xs sm:text-sm tracking-wide">
              Chargement et adaptation du document...
            </p>
          </div>
        ) : !activePreviewItem ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 text-stone-400 gap-2 bg-white dark:bg-stone-950">
            <FileText className="w-10 h-10 opacity-30" />
            <p className="text-xs font-bold text-stone-500">Aucun document sélectionné</p>
          </div>
        ) : (() => {
          const isImg = ['JPG', 'JPEG', 'PNG', 'WEBP', 'SVG', 'GIF', 'BMP', 'ICO'].includes(ext) || activePreviewItem?.type?.startsWith('image/') || activePreviewItem?.isImage;
          const isVideo = ['MP4', 'WEBM', 'MOV', 'MKV', 'OGG', 'AVI'].includes(ext) || activePreviewItem?.type?.startsWith('video/');
          const isAudio = ['MP3', 'WAV', 'M4A', 'AAC', 'FLAC', 'OGA', 'WMA'].includes(ext) || activePreviewItem?.type?.startsWith('audio/');
          const isWord = ['DOCX', 'DOC'].includes(ext);
          const isExcel = ['XLSX', 'XLS', 'CSV'].includes(ext);
          const isPpt = ['PPTX', 'PPT'].includes(ext);
          const isText = ['TXT', 'MD', 'JSON', 'JS', 'TS', 'PY', 'HTML', 'CSS', 'SQL', 'XML', 'LOG', 'JAVA', 'C', 'CPP', 'SH', 'ENV'].includes(ext);

          const currentUrl = resolvedUrl || (activePreviewItem?.url && !activePreviewItem.url.startsWith('blob:') ? activePreviewItem.url : '');

          // 1. PDF:
          // Standard Vertical mode (default) -> Native PDF viewer with "le truc noir" (#toolbar=1, page counter, native - 122% + zoom, rotate, draw, download, print)
          // Horizontal mode OR Surlignage -> Interactive viewer with live Stabilo yellow line highlighting & auto-scroll
          if (isPdf) {
            const isSpeaking = speechState === 'playing';
            const showInteractive = previewScrollMode === 'horizontal' || pdfViewerMode === 'interactive';

            if (showInteractive) {
              return (
                <div className="w-full h-full flex flex-col bg-white dark:bg-stone-900 overflow-hidden">
                  <PdfHorizontalViewer 
                    fileId={activePreviewItem?.id}
                    file={activePreviewItem}
                    url={currentUrl} 
                    docZoom={effectiveZoom}
                    layoutMode={previewScrollMode}
                    activeSpeechPage={activeSpeechPage}
                    activeSpeechLineIndex={activeSpeechLineIndex}
                    currentSpokenText={speechSegmentsRef.current[currentSegmentIdx]?.text || speechSegments[currentSegmentIdx]?.text}
                    autoScrollEnabled={autoScrollEnabled}
                    isSpeaking={isSpeaking}
                    onSegmentsExtracted={(segs) => {
                      speechSegmentsRef.current = segs;
                      setSpeechSegments(segs);
                    }}
                    currentPage={currentPdfViewerPage}
                    onPageChange={setCurrentPdfViewerPage}
                    isFullscreen={isCenterFullscreen}
                  />
                </div>
              );
            }

            // Native Vertical PDF Viewer with "le truc noir" (black PDF toolbar #toolbar=1)
            // L'URL et les clés restent stables pour ne jamais détruire/recharger l'iframe lors du zoom
            const cleanPdfBase = (currentUrl || '').split('#')[0];
            const nativePdfUrl = `${cleanPdfBase}#toolbar=1&navpanes=0&view=FitH`;

            return (
              <div className="w-full h-full flex flex-col items-center overflow-auto bg-stone-100 dark:bg-stone-900">
                {currentUrl ? (
                  <div 
                    className="flex-1 w-full h-full flex flex-col"
                    style={{
                      width: '100%',
                      height: '100%'
                    }}
                  >
                    <object
                      key={`pdf-native-${activePreviewItem?.id || activePreviewItem?.url || 'default'}`}
                      data={nativePdfUrl}
                      type="application/pdf"
                      className="w-full h-full border-0 block flex-1"
                      style={{ width: '100%', height: '100%' }}
                    >
                      <iframe
                        key={`iframe-pdf-native-${activePreviewItem?.id || activePreviewItem?.url || 'default'}`}
                        src={nativePdfUrl}
                        title={activePreviewItem?.name || 'Document PDF'}
                        className="w-full h-full border-0 block flex-1"
                        style={{ width: '100%', height: '100%' }}
                      />
                    </object>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                    <FileText className="w-12 h-12 text-red-500" />
                    <p className="text-sm font-bold text-stone-800 dark:text-white">{activePreviewItem.name}</p>
                    <p className="text-xs text-stone-500">Document PDF prêt pour l'analyse IA.</p>
                  </div>
                )}
              </div>
            );
          }

          // 2. WORD (.docx / .doc)
          if (isWord) {
            return (
              <div className="w-full h-full flex flex-col overflow-hidden bg-white dark:bg-stone-950">
                <div className="flex items-center justify-between px-4 py-2 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-200 text-xs shrink-0">
                  <div className="flex items-center gap-2 font-bold truncate">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="truncate">{activePreviewItem.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyText(extractedDocText || docxHtml.replace(/<[^>]+>/g, ''))}
                      className="px-2.5 py-1 bg-white hover:bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-700 rounded border border-stone-200 dark:border-stone-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedText ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedText ? 'Copié !' : 'Copier texte'}</span>
                    </button>
                    {currentUrl && (
                      <a
                        href={currentUrl}
                        download={activePreviewItem.name}
                        className="p-1 hover:bg-stone-200 dark:hover:bg-stone-800 rounded text-stone-600 dark:text-stone-300 transition-colors"
                        title="Télécharger"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                <div 
                  className={`flex-1 w-full h-full select-text leading-relaxed font-serif text-stone-900 dark:text-stone-100 ${
                    previewScrollMode === 'horizontal'
                      ? 'overflow-x-auto overflow-y-hidden px-8 sm:px-12 py-8'
                      : 'overflow-y-auto px-6 sm:px-12 md:px-20 py-8'
                  }`}
                  style={{ 
                    zoom: `${effectiveZoom}%`,
                    ...(previewScrollMode === 'horizontal' ? { columnWidth: '500px', columnGap: '40px', height: '100%' } : {})
                  }}
                >
                  {/* Dynamic CSS highlighting for active Word speech segment */}
                  <style>{`
                    ${(speechState === 'playing' || speechState === 'paused') ? `
                      #word-speech-seg-${currentSegmentIdx} {
                        background-color: rgba(255, 235, 59, 0.75) !important;
                        border-bottom: 3.5px solid #FF3B30 !important;
                        border-radius: 4px !important;
                        box-shadow: 0 2px 10px rgba(255, 59, 48, 0.45) !important;
                        padding: 2px 6px !important;
                        color: inherit !important;
                        transition: background-color 0.15s ease, box-shadow 0.15s ease !important;
                      }
                      p#word-speech-seg-${currentSegmentIdx},
                      h1#word-speech-seg-${currentSegmentIdx},
                      h2#word-speech-seg-${currentSegmentIdx},
                      h3#word-speech-seg-${currentSegmentIdx},
                      h4#word-speech-seg-${currentSegmentIdx},
                      h5#word-speech-seg-${currentSegmentIdx},
                      h6#word-speech-seg-${currentSegmentIdx},
                      li#word-speech-seg-${currentSegmentIdx},
                      blockquote#word-speech-seg-${currentSegmentIdx},
                      td#word-speech-seg-${currentSegmentIdx} {
                        display: block !important;
                      }
                    ` : ''}
                  `}</style>

                  {docxHtml ? (
                    <div 
                      className="prose dark:prose-invert max-w-none text-sm sm:text-base space-y-4"
                      dangerouslySetInnerHTML={{ __html: docxHtml }} 
                      onClick={(e) => {
                        const target = (e.target as HTMLElement)?.closest('.word-speech-seg');
                        if (target) {
                          const id = target.getAttribute('id');
                          const match = id?.match(/word-speech-seg-(\d+)/);
                          if (match) {
                            const segIdx = parseInt(match[1], 10);
                            if (!isNaN(segIdx) && segIdx >= 0 && segIdx < speechSegmentsRef.current.length) {
                              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                                window.speechSynthesis.cancel();
                              }
                              speakSentence(segIdx);
                            }
                          }
                        }
                      }}
                    />
                  ) : (
                    <div className="text-center py-16 text-stone-400">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-40 text-blue-500" />
                      <p className="font-semibold text-stone-700 dark:text-stone-300">Formatage du document Word...</p>
                      <p className="text-xs mt-1">Vous pouvez également échanger avec Delmas IA dans le panneau droit.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // 3. EXCEL / SPREADSHEETS (.xlsx / .xls / .csv)
          if (isExcel) {
            const filteredRows = excelWorkbook?.rows ? (
              excelWorkbook.searchQuery.trim()
                ? excelWorkbook.rows.filter(r => r.some(c => String(c || '').toLowerCase().includes(excelWorkbook.searchQuery.toLowerCase())))
                : excelWorkbook.rows
            ) : [];

            return (
              <div className="w-full h-full flex flex-col overflow-hidden bg-white dark:bg-stone-900">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-stone-200 dark:border-stone-800 bg-[#F4F9F4] dark:bg-emerald-950/20 text-xs shrink-0">
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-extrabold text-stone-900 dark:text-emerald-300 truncate max-w-[180px] sm:max-w-xs">{activePreviewItem.name}</span>
                  </div>

                  {excelWorkbook && excelWorkbook.sheetNames.length > 1 && (
                    <div className="flex items-center gap-1 overflow-x-auto max-w-xs py-0.5">
                      {excelWorkbook.sheetNames.map((sheet) => (
                        <button
                          key={sheet}
                          onClick={() => handleSwitchExcelSheet(sheet)}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer whitespace-nowrap ${
                            excelWorkbook.activeSheet === sheet
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                              : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {sheet}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type="text"
                        placeholder="Filtrer cellules..."
                        value={excelWorkbook?.searchQuery || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setExcelWorkbook(prev => prev ? { ...prev, searchQuery: val } : null);
                        }}
                        className="pl-6 pr-2 py-1 text-[11px] bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-900 dark:text-white w-28 sm:w-36 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    {currentUrl && (
                      <a
                        href={currentUrl}
                        download={activePreviewItem.name}
                        className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded text-stone-600 dark:text-stone-300"
                        title="Télécharger le classeur"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                <div 
                  className="flex-1 w-full h-full overflow-auto p-0"
                  style={{ zoom: `${docZoom}%` }}
                >
                  {filteredRows.length > 0 ? (
                    <table className="w-full border-collapse text-xs font-mono">
                      <thead>
                        <tr className="bg-stone-100 dark:bg-stone-800 sticky top-0 z-10 border-b border-stone-300 dark:border-stone-700">
                          <th className="p-2 border-r border-stone-200 dark:border-stone-700 text-stone-500 w-12 text-center font-bold">#</th>
                          {filteredRows[0]?.map((_, colIdx: number) => {
                            const colLetter = String.fromCharCode(65 + (colIdx % 26));
                            return (
                              <th key={colIdx} className="p-2 border-r border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-bold text-left min-w-[110px]">
                                {colLetter}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row: any[], displayIdx: number) => {
                          const originalRowIdx = excelWorkbook?.rows ? excelWorkbook.rows.indexOf(row) : displayIdx;
                          const activeSeg = speechSegments[currentSegmentIdx];
                          const isRowSpeaking = (speechState === 'playing' || speechState === 'paused') && activeSeg?.rowIdx === originalRowIdx;
                          return (
                            <tr 
                              key={displayIdx} 
                              id={isRowSpeaking ? 'active-excel-speech-target' : undefined}
                              className={`transition-colors border-b border-stone-100 dark:border-stone-800 ${
                                isRowSpeaking 
                                  ? 'bg-yellow-200/90 dark:bg-yellow-950/80 font-bold' 
                                  : 'hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20'
                              }`}
                              style={isRowSpeaking ? {
                                outline: '3.5px solid #FF3B30',
                                outlineOffset: '-2px',
                                boxShadow: '0 2px 10px rgba(255, 59, 48, 0.4)',
                              } : undefined}
                            >
                              <td className="p-2 border-r border-stone-200 dark:border-stone-800 text-stone-400 bg-stone-50 dark:bg-stone-900 text-center select-none font-bold text-[10px]">
                                {originalRowIdx + 1}
                              </td>
                              {row.map((cell: any, cellIdx: number) => (
                                <td key={cellIdx} className="p-2 border-r border-stone-100 dark:border-stone-800/60 text-stone-800 dark:text-stone-200 whitespace-pre truncate max-w-sm select-text">
                                  {cell !== undefined && cell !== null ? String(cell) : ''}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-stone-400 p-8">
                      <Table className="w-10 h-10 mb-2 opacity-30 text-emerald-600" />
                      <p className="font-semibold text-xs">Aucune donnée disponible dans cette feuille.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // 4. POWERPOINT (.pptx / .ppt)
          if (isPpt) {
            const totalSlides = pptxSlides.length || 1;
            const currentSlide = pptxSlides[activeSlideIdx] || {
              slideNumber: 1,
              title: activePreviewItem.name,
              bullets: ['Présentation PowerPoint prête pour révision.']
            };

            return (
              <div className="w-full h-full flex flex-col overflow-hidden bg-stone-950 text-white">
                <div className="flex items-center justify-between px-4 py-2 bg-stone-900 text-white text-xs border-b border-stone-800 shrink-0">
                  <div className="flex items-center gap-2 font-bold truncate">
                    <Presentation className="w-4 h-4 text-orange-500 shrink-0" />
                    <span className="truncate">{activePreviewItem.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-stone-400">
                      Diapositive {activeSlideIdx + 1} / {totalSlides}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setActiveSlideIdx(prev => Math.max(0, prev - 1))}
                        disabled={activeSlideIdx === 0}
                        className="p-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 rounded cursor-pointer"
                        title="Diapositive précédente"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setActiveSlideIdx(prev => Math.min(totalSlides - 1, prev + 1))}
                        disabled={activeSlideIdx >= totalSlides - 1}
                        className="p-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 rounded cursor-pointer"
                        title="Diapositive suivante"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div 
                  className="flex-1 w-full h-full flex items-center justify-center p-4 sm:p-8 overflow-auto"
                  style={{ zoom: `${effectiveZoom}%` }}
                >
                  <div className="w-full h-full max-w-5xl max-h-[85vh] aspect-[16/9] bg-[#FDFBF7] text-stone-900 rounded-xl border border-stone-700 p-8 md:p-12 flex flex-col justify-between select-text relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-orange-500 via-amber-400 to-red-500" />
                    
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-600 bg-orange-100 px-2.5 py-1 rounded-md">
                          Diapositive {currentSlide.slideNumber}
                        </span>
                      </div>
                      <h2 className="text-xl md:text-3xl font-black text-stone-950 mb-6 leading-snug">
                        {(() => {
                          const activeSeg = speechSegments[currentSegmentIdx];
                          const isSpeaking = speechState === 'playing' || speechState === 'paused';
                          const isTitleActive = isSpeaking && activeSeg?.slide === currentSlide.slideNumber && activeSeg?.isTitle;
                          return isTitleActive ? (
                            <span 
                              id="active-pptx-speech-target"
                              style={{
                                backgroundColor: 'rgba(255, 235, 59, 0.75)',
                                borderBottom: '3.5px solid #FF3B30',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                boxShadow: '0 2px 10px rgba(255, 59, 48, 0.45)',
                              }}
                            >
                              {currentSlide.title}
                            </span>
                          ) : currentSlide.title;
                        })()}
                      </h2>
                      <ul className="space-y-4">
                        {currentSlide.bullets.map((bullet, idx) => {
                          const activeSeg = speechSegments[currentSegmentIdx];
                          const isSpeaking = speechState === 'playing' || speechState === 'paused';
                          const isBulletActive = isSpeaking && activeSeg?.slide === currentSlide.slideNumber && activeSeg?.bulletIdx === idx;
                          return (
                            <li key={idx} className="flex items-start gap-3 text-sm sm:text-base font-medium text-stone-700 leading-relaxed">
                              <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 shrink-0" />
                              {isBulletActive ? (
                                <span 
                                  id="active-pptx-speech-target"
                                  className="text-stone-950 font-bold"
                                  style={{
                                    backgroundColor: 'rgba(255, 235, 59, 0.75)',
                                    borderBottom: '3.5px solid #FF3B30',
                                    borderRadius: '3px',
                                    padding: '2px 6px',
                                    boxShadow: '0 2px 10px rgba(255, 59, 48, 0.45)',
                                  }}
                                >
                                  {bullet}
                                </span>
                              ) : (
                                <span>{bullet}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-stone-200 text-[11px] font-bold text-stone-400">
                      <span>StudyCloud Presentation Viewer</span>
                      <span>{activeSlideIdx + 1} sur {totalSlides}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // 5. IMAGES
          if (isImg) {
            return (
              <div className="w-full h-full flex items-center justify-center overflow-auto p-4 bg-stone-100 dark:bg-stone-950">
                <img
                  src={currentUrl}
                  alt={activePreviewItem?.name || 'Document'}
                  style={{ zoom: `${effectiveZoom}%`, transformOrigin: 'center center' }}
                  className="max-w-full max-h-full object-contain transition-all select-none"
                />
              </div>
            );
          }

          // 6. VIDEO
          if (isVideo) {
            return (
              <div className="w-full h-full flex items-center justify-center bg-black">
                <video
                  src={currentUrl}
                  controls
                  playsInline
                  className="w-full max-h-full object-contain"
                  style={{ zoom: `${effectiveZoom}%` }}
                />
              </div>
            );
          }

          // 7. AUDIO
          if (isAudio) {
            return (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#FDFBF7] dark:bg-stone-950">
                <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-8 text-center shadow-sm">
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-4 text-orange-500">
                    <Music className="w-10 h-10 animate-pulse" />
                  </div>
                  <h3 className="text-base font-extrabold text-stone-900 dark:text-white mb-1 truncate px-2">{activePreviewItem.name}</h3>
                  <p className="text-xs text-stone-500 mb-6 font-mono">{formatFileSize(activePreviewItem.size)}</p>
                  <audio src={currentUrl} controls className="w-full rounded-lg" />
                </div>
              </div>
            );
          }

          // 8. TEXT / CODE
          if (isText) {
            return (
              <div className="w-full h-full flex flex-col overflow-hidden bg-[#1e1e1e]">
                <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] text-stone-300 text-xs border-b border-stone-700 shrink-0">
                  <div className="flex items-center gap-2 font-mono">
                    <FileCode className="w-4 h-4 text-amber-400" />
                    <span>{activePreviewItem.name}</span>
                  </div>
                  <button
                    onClick={() => handleCopyText(fileTextContent || activePreviewItem.textContent || '')}
                    className="px-2.5 py-1 bg-stone-700 hover:bg-stone-600 rounded text-[10px] font-semibold text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedText ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedText ? 'Copié' : 'Copier code'}</span>
                  </button>
                </div>

                <div 
                  ref={textContainerRef}
                  className="flex-1 w-full h-full p-4 sm:p-6 overflow-auto font-mono text-xs leading-relaxed text-[#d4d4d4] select-text"
                  style={{ zoom: `${effectiveZoom}%` }}
                >
                  {speechSegments.length > 0 && (speechState === 'playing' || speechState === 'paused') ? (
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {speechSegments.map((seg, idx) => {
                        const isActive = idx === currentSegmentIdx;
                        return (
                          <span
                            key={idx}
                            id={isActive ? 'active-text-speech-target' : undefined}
                            ref={isActive ? (activeSentenceElRef as any) : null}
                            onClick={() => {
                              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                                window.speechSynthesis.cancel();
                              }
                              speakSentence(idx);
                            }}
                            className={`inline transition-all duration-150 cursor-pointer rounded px-1 ${
                              isActive
                                ? 'text-stone-950 font-bold shadow-sm'
                                : 'hover:bg-stone-800'
                            }`}
                            style={isActive ? {
                              backgroundColor: 'rgba(255, 235, 59, 0.85)',
                              borderBottom: '3.5px solid #FF3B30',
                              borderRadius: '3px',
                              padding: '2px 4px',
                              color: '#000000',
                              boxShadow: '0 2px 8px rgba(255, 59, 48, 0.45)',
                            } : undefined}
                          >
                            {seg.text}{' '}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap">{fileTextContent || activePreviewItem.textContent || "Fichier texte vide."}</pre>
                  )}
                </div>
              </div>
            );
          }

          // 9. AUTRE / FICHIER GÉNÉRIQUE
          return (
            <div 
              className="w-full h-full flex flex-col items-center justify-center text-center p-6 overflow-auto bg-white dark:bg-stone-950"
              style={{ zoom: `${docZoom}%` }}
            >
              <div className="mb-6">
                <FileIconBadge fileName={activePreviewItem?.name || ''} size={64} />
              </div>
              <h4 className="text-lg font-extrabold text-stone-900 dark:text-white mb-2 max-w-full break-words px-4">{activePreviewItem?.name}</h4>
              <p className="text-xs text-stone-500 font-mono mb-4">
                Taille : {formatFileSize(activePreviewItem?.size)} • Format {ext}
              </p>
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/60 rounded-xl p-4 text-xs text-orange-900 dark:text-orange-200 font-medium leading-relaxed max-w-sm mb-4">
                Ce document est ouvert dans StudyCloud. Vous pouvez échanger avec Delmas IA dans le panneau de droite ou utiliser la synthèse vocale en haut à droite.
              </div>
              {currentUrl && (
                <a
                  href={currentUrl}
                  download={activePreviewItem.name}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger le fichier</span>
                </a>
              )}
            </div>
          );
        })()}

      </div>

    </div>
  );
}
