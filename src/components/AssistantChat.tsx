import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, ThumbsUp, ThumbsDown, Copy, Check, X, FileText, Sparkles, Loader2, Clock, Plus, Trash2, Search, MessageSquare, ChevronRight, Brain, Presentation, ChevronDown, ChevronUp, Layers, Zap, Palette, HelpCircle, Download, Square, WifiOff, RotateCw, AlertTriangle, Coins, ArrowRight } from 'lucide-react';
import { DnaLogo } from './DnaLogo';
import { DelmasRobot } from './DelmasRobot';
import { FileIconBadge } from './FileIconBadge';
import { MathText, stripAiReasoningScratchpad } from './MathText';
import { sendChatMessageToAi, saveAiReaction, removeAiAttachment, StudyCloudAPI, getGeminiApiKey, safeJsonParse, getWorkerApiUrl, getActiveTokensPerCredit, convertTokensToCredits, formatConsumedCreditsDisplay, getAiBillingConfig, getUserAiCreditsLive } from '../services/api';
import { aiBackgroundManager } from '../services/aiBackgroundManager';
import { getFileBlob } from '../services/localFileStorage';
import { extractDocumentDetails } from '../services/documentTextExtractor';

// Helpers robustes et infaillibles de stockage local pour l'AssistantChat (garantis sans ReferenceError)
const safeGetItem = (key: string, fallback: string = ''): string => {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const val = localStorage.getItem(key);
    return val !== null && val !== undefined ? val : fallback;
  } catch {
    return fallback;
  }
};

const safeSetItem = (key: string, value: string): boolean => {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const safeLocalStorageRemove = (key: string): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(key);
  } catch { }
};
import { parseOrBuildAiCreation } from '../services/aiCreationGenerator';
import { AiCreation, AiCreationType, ModuleId } from './ai-creations/types';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  isStreaming?: boolean;
  reaction?: 'like' | 'dislike' | null;
  attachedFileName?: string;
  createdAt?: string;
  model?: string;
  isPowerMode?: boolean;
  isError?: boolean;
  errorType?: 'network' | 'server';
  retryPrompt?: string;
  tokens?: number;
  credits?: number;
  usage?: any;
}

interface ConversationItem {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
}

export function stripWorkerAi(name?: string | null): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .replace(/3\.8\s*flash/gi, '2.0 Flash')
    .replace(/2\.5\s*flash/gi, '2.0 Flash')
    .replace(/\s*\(?\s*workers?\s*ai\s*\)?/gi, '')
    .replace(/\s*\(?\s*cloudflare\s*\)?/gi, '')
    .replace(/\bworkers?\s*ai\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function normalizeCreationType(type: string | undefined): ModuleId {
  if (!type) return 'questionnaire';
  const t = type.toLowerCase().trim();
  if (t === 'quiz' || t === 'qcm' || t === 'questionnaire') return 'questionnaire';
  if (t === 'test' || t === 'questionnaire-test') return 'questionnaire-test';
  if (t === 'vrai-ou-faux' || t === 'vrai-faux' || t === 'vf') return 'vrai-ou-faux';
  if (t === 'vrai-ou-faux-test' || t === 'vf-test') return 'vrai-ou-faux-test';
  if (t === 'mindmap' || t === 'carte-mentale' || t === 'mind-map') return 'carte-mentale';
  if (t === 'carte-mentale-2' || t === 'mindmap2') return 'carte-mentale-2';
  if (t === 'carte-memoire' || t === 'flashcard' || t === 'flashcards' || t === 'cartes-memoire') return 'carte-memoire';
  if (t === 'summary' || t === 'resume' || t === 'fiche') return 'resume';
  if (t === 'document' || t === 'pdf') return 'pdf';
  if (t === 'infographic' || t === 'infographie') return 'infographie';
  if (t === 'exercices-ecrits' || t === 'exercices' || t === 'written-exercise') return 'exercices-ecrits';
  if (t === 'devoir-complet' || t === 'devoir' || t === 'exam') return 'devoir-complet';
  return (t as ModuleId) || 'questionnaire';
}

// Helper robuste pour nettoyer tout résidu JSON du chat et garantir un texte pur avec LaTeX intact
function cleanChatText(text: string): string {
  if (!text) return '';
  let clean = text.trim();

  // 1. Extraire chat_message / chat_response si présent
  const msgMatch = clean.match(/"(?:chat_message|chat_response)"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
  if (msgMatch) {
    try {
      const extracted = JSON.parse(`"${msgMatch[1]}"`).trim();
      if (extracted && !extracted.startsWith('{') && !extracted.includes('":')) {
        return extracted;
      }
    } catch {
      const unescaped = msgMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
      if (unescaped && !unescaped.startsWith('{')) {
        return unescaped;
      }
    }
  }

  // 2. Supprimer TOUS les blocs ```json ... ``` ou ``` ... ``` contenant du JSON
  clean = clean.replace(/```(?:json)?\s*[\s\S]*?```/gi, '').trim();

  // 3. Supprimer les balises <creation>
  clean = clean.replace(/<creation[^>]*>[\s\S]*?<\/creation>/gi, '').trim();

  // 4. Supprimer tout objet JSON brut complet { ... }
  clean = clean.replace(/\{[\s\S]*?\}(?=\s*$|\n\n)/g, (match) => {
    if (match.includes('":') || match.includes('"title"') || match.includes('"decision"') || match.includes('"connecteurs"') || match.includes('"noeud_central"')) {
      return '';
    }
    return match;
  }).trim();

  if (clean.startsWith('{') && clean.endsWith('}')) {
    clean = '';
  }

  // 5. Supprimer les lignes orphelines de syntaxe JSON résiduelle ("connecteurs": [, "source": ..., "cible": ..., etc.)
  clean = clean
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      if (/^["']?(?:connecteurs|noeuds|noeud_central|columns|branches|children|root|cards|questions|affirmations|creation_data|creation_type|decision|mode)["']?\s*:\s*[\[{]/i.test(trimmed)) return false;
      if (/^["']?(?:source|cible|relation|type|pillTitle|description|formula|statement|is_true|explanation|correctAnswer)["']?\s*:\s*["'].*["'],?$/i.test(trimmed)) return false;
      if (/^[\[\]\{\}],?$/.test(trimmed)) return false;
      return true;
    })
    .join('\n')
    .trim();

  return clean;
}

/**
 * Extrait instantanément (<25ms) le Base64 d'un document image ouvert ou sélectionné.
 * Conforme à la spécification multimodale Google Gemini Cookbook.
 */
async function extractImageBase64FromItem(item: any): Promise<{ base64: string; mimeType: string } | null> {
  if (!item) return null;

  const name = String(item.name || item.title || item.fileName || '').toLowerCase();
  const type = String(item.type || item.mimeType || '').toLowerCase();
  const ext = String(item.extension || '').toLowerCase();
  const category = String(item.category || item.fileType || item.file_category || '').toLowerCase();
  const isImage = Boolean(
    item.isImage ||
    category.includes('image') ||
    category.includes('photo') ||
    type.startsWith('image/') ||
    /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(name) ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext) ||
    name.includes('whatsapp image') ||
    name.includes('image') ||
    name.includes('screenshot') ||
    name.includes('capture') ||
    item.imageUrl ||
    item.thumbnail
  );

  if (!isImage) return null;

  let mimeType = type.startsWith('image/') ? type : 'image/jpeg';
  if (name.endsWith('.png') || ext === 'png') mimeType = 'image/png';
  else if (name.endsWith('.webp') || ext === 'webp') mimeType = 'image/webp';
  else if (name.endsWith('.gif') || ext === 'gif') mimeType = 'image/gif';

  // 1. Déjà présent en mémoire sous forme Base64
  if (typeof item.base64 === 'string' && item.base64.length > 50) {
    return { base64: item.base64, mimeType };
  }
  if (typeof item.imageBase64 === 'string' && item.imageBase64.length > 50) {
    return { base64: item.imageBase64, mimeType };
  }
  if (typeof item.dataUrl === 'string' && item.dataUrl.startsWith('data:image')) {
    return { base64: item.dataUrl, mimeType };
  }

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('FileReader non-string'));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // 2. Blob ou File direct attaché
  if (item.file instanceof Blob || item.file instanceof File) {
    try {
      const b64 = await blobToBase64(item.file);
      return { base64: b64, mimeType: item.file.type || mimeType };
    } catch { }
  }
  if (item.blob instanceof Blob) {
    try {
      const b64 = await blobToBase64(item.blob);
      return { base64: b64, mimeType: item.blob.type || mimeType };
    } catch { }
  }

  // 3. IndexedDB local via getFileBlob(item.id)
  if (item.id) {
    try {
      const blob = await getFileBlob(item.id);
      if (blob) {
        const b64 = await blobToBase64(blob);
        return { base64: b64, mimeType: blob.type || mimeType };
      }
    } catch (e) {
      console.warn('[AssistantChat] Erreur lecture binaire IndexedDB:', e);
    }
  }

  // 4. URL accessible (blob:, http:, /api/cloud/...)
  let targetUrl = item.url || item.fileUrl || item.previewUrl;
  if (typeof targetUrl === 'string' && targetUrl.trim()) {
    if (targetUrl.startsWith('/')) {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      targetUrl = `${baseUrl}${targetUrl}`;
    }
    try {
      const resp = await fetch(targetUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        const b64 = await blobToBase64(blob);
        return { base64: b64, mimeType: blob.type || mimeType };
      }
    } catch (e) {
      console.warn('[AssistantChat] Erreur lecture image URL:', e);
    }
  }

  // 5. Capture d'écran instantanée via l'élément <img> actif dans le DOM
  try {
    const candidateImgs = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
    const imgEl = candidateImgs.find(img =>
      img.naturalWidth > 0 && (
        img.src.startsWith('blob:') ||
        img.src.includes('/api/cloud/') ||
        img.src.includes('storage') ||
        img.closest('.document-preview') !== null ||
        img.closest('[data-testid="file-preview"]') !== null ||
        (item.name && img.alt && img.alt.toLowerCase().includes(item.name.toLowerCase().slice(0, 15)))
      )
    ) || (document.querySelector('img[src^="blob:"], img[src*="/api/cloud/"], img[alt*="' + (item.name || item.title || 'Image') + '"]') as HTMLImageElement | null);

    if (imgEl && imgEl.naturalWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(imgEl.naturalWidth, 1600);
      canvas.height = Math.round((canvas.width / imgEl.naturalWidth) * imgEl.naturalHeight);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL(mimeType, 0.88);
        if (dataUrl && dataUrl.length > 100) {
          return { base64: dataUrl, mimeType };
        }
      }
    }
  } catch (e) {
    console.warn('[AssistantChat] Erreur capture canvas:', e);
  }

  return null;
}

/**
 * Détecte si un élément est une ressource vidéo.
 */
function isVideoItem(item: any): boolean {
  if (!item) return false;
  const name = String(item.name || item.title || item.fileName || '').toLowerCase();
  const type = String(item.type || item.mimeType || '').toLowerCase();
  const ext = String(item.extension || '').toLowerCase();
  const category = String(item.category || item.fileType || item.file_category || '').toLowerCase();

  return Boolean(
    item.isVideo ||
    category.includes('video') ||
    category === 'videos' ||
    type.startsWith('video/') ||
    /\.(mp4|webm|mov|mkv|avi|flv|wmv|m4v|3gp|ogv|ts)$/i.test(name) ||
    ['mp4', 'webm', 'mov', 'mkv', 'avi', 'flv', 'wmv', 'm4v', '3gp', 'ogv', 'ts'].includes(ext) ||
    name.includes('whatsapp video') ||
    name.startsWith('vid-') ||
    item.videoUrl
  );
}

/**
 * Extrait les images clés temporelles (keyframes) et/ou le Base64 d'une vidéo
 * pour l'analyse multimodale Gemini (conforme au Google Gemini Cookbook).
 */
async function extractVideoContentFromItem(item: any): Promise<{
  videoBase64?: string;
  videoFrames: Array<{ base64: string; mimeType: string; timestamp: number }>;
  mimeType: string;
} | null> {
  if (!item || !isVideoItem(item)) return null;

  const name = String(item.name || item.title || item.fileName || '').toLowerCase();
  const type = String(item.type || item.mimeType || '').toLowerCase();
  let mimeType = type.startsWith('video/') ? type : 'video/mp4';
  if (name.endsWith('.webm')) mimeType = 'video/webm';
  else if (name.endsWith('.mov')) mimeType = 'video/quicktime';
  else if (name.endsWith('.avi')) mimeType = 'video/x-msvideo';

  // 1. Si des frames sont déjà présentes en mémoire
  if (Array.isArray(item.videoFrames) && item.videoFrames.length > 0) {
    return {
      videoFrames: item.videoFrames,
      videoBase64: item.videoBase64 || item.base64,
      mimeType,
    };
  }

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('FileReader non-string'));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Helper pour extraire chronologiquement 4 à 6 images clés d'une vidéo via Canvas
  const extractFramesFromSource = async (
    source: Blob | string,
    targetMime: string,
    maxFrames = 6
  ): Promise<{ frames: Array<{ base64: string; mimeType: string; timestamp: number }>; videoBase64?: string }> => {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        video.preload = 'auto';

        const isBlob = source instanceof Blob;
        const objectUrl = isBlob ? URL.createObjectURL(source) : source;
        video.src = objectUrl;

        const cleanup = () => {
          if (isBlob) {
            try { URL.revokeObjectURL(objectUrl); } catch { }
          }
          video.src = '';
        };

        const timeout = setTimeout(() => {
          cleanup();
          resolve({ frames: [] });
        }, 8000); // 8s de timeout max

        video.onloadedmetadata = async () => {
          try {
            const duration = video.duration || 1;
            const frameCount = Math.min(maxFrames, Math.max(3, Math.floor(duration)));
            const step = duration / (frameCount + 1);
            const timestamps: number[] = [];
            for (let i = 1; i <= frameCount; i++) {
              timestamps.push(Math.round((i * step) * 10) / 10);
            }

            const frames: Array<{ base64: string; mimeType: string; timestamp: number }> = [];
            const canvas = document.createElement('canvas');
            const maxDim = 800; // Résolution optimale pour la vision Gemini Flash
            const width = video.videoWidth || 640;
            const height = video.videoHeight || 360;
            const scale = Math.min(1, maxDim / Math.max(width, height));
            canvas.width = Math.round(width * scale);
            canvas.height = Math.round(height * scale);
            const ctx = canvas.getContext('2d');

            for (const t of timestamps) {
              await new Promise<void>((resSeek) => {
                const onSeeked = () => {
                  video.removeEventListener('seeked', onSeeked);
                  if (ctx) {
                    try {
                      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                      const b64 = canvas.toDataURL('image/jpeg', 0.82);
                      if (b64 && b64.length > 100) {
                        frames.push({
                          base64: b64,
                          mimeType: 'image/jpeg',
                          timestamp: t,
                        });
                      }
                    } catch (e) {
                      console.warn('[extractVideoKeyframes] Erreur capture frame:', e);
                    }
                  }
                  resSeek();
                };
                video.addEventListener('seeked', onSeeked);
                video.currentTime = t;
              });
            }

            // Si la vidéo fait moins de 10MB, on encode aussi le flux complet en base64
            let directBase64: string | undefined = undefined;
            if (isBlob && (source as Blob).size <= 10 * 1024 * 1024) {
              try {
                directBase64 = await blobToBase64(source as Blob);
              } catch { }
            }

            clearTimeout(timeout);
            cleanup();
            resolve({ frames, videoBase64: directBase64 });
          } catch (err) {
            clearTimeout(timeout);
            cleanup();
            resolve({ frames: [] });
          }
        };

        video.onerror = () => {
          clearTimeout(timeout);
          cleanup();
          resolve({ frames: [] });
        };
      } catch {
        resolve({ frames: [] });
      }
    });
  };

  // 2. Blob ou File direct attaché
  let targetBlob: Blob | null = null;
  if (item.file instanceof Blob || item.file instanceof File) {
    targetBlob = item.file;
  } else if (item.blob instanceof Blob) {
    targetBlob = item.blob;
  }

  // 3. IndexedDB local via getFileBlob(item.id)
  if (!targetBlob && item.id) {
    try {
      const b = await getFileBlob(item.id);
      if (b) targetBlob = b;
    } catch (e) {
      console.warn('[AssistantChat] Erreur lecture vidéo IndexedDB:', e);
    }
  }

  // 4. URL accessible (blob:, http:, /api/cloud/...)
  let targetUrl = item.videoUrl || item.url || item.fileUrl || item.previewUrl;
  if (!targetBlob && typeof targetUrl === 'string' && targetUrl.trim()) {
    if (targetUrl.startsWith('/')) {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      targetUrl = `${baseUrl}${targetUrl}`;
    }
    try {
      const resp = await fetch(targetUrl);
      if (resp.ok) {
        targetBlob = await resp.blob();
      }
    } catch (e) {
      console.warn('[AssistantChat] Erreur fetch blob vidéo:', e);
    }
  }

  // Si on a le blob vidéo (local ou distant), on extrait le Base64 direct (avec son audio) jusqu'à 28 Mo
  let directVideoBase64: string | undefined = undefined;
  if (targetBlob && targetBlob.size <= 28 * 1024 * 1024) {
    try {
      directVideoBase64 = await blobToBase64(targetBlob);
    } catch { }
  }

  const res = await extractFramesFromSource(targetBlob || targetUrl, mimeType);
  if (directVideoBase64 || res.frames.length > 0) {
    return {
      videoFrames: res.frames,
      videoBase64: directVideoBase64 || res.videoBase64,
      mimeType: (targetBlob?.type) || mimeType,
    };
  }

  // 5. Capture directe depuis un élément <video> actif dans le DOM
  try {
    const candidateVideos = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
    const videoEl = candidateVideos.find(v =>
      v.readyState >= 2 && (
        v.src.startsWith('blob:') ||
        v.src.includes('/api/cloud/') ||
        v.closest('.document-preview') !== null ||
        v.closest('[data-testid="file-preview"]') !== null ||
        (item.name && v.title && v.title.toLowerCase().includes(item.name.toLowerCase().slice(0, 15)))
      )
    ) || document.querySelector('video');

    if (videoEl && videoEl.readyState >= 2) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(videoEl.videoWidth || 640, 1280);
      canvas.height = Math.round((canvas.width / (videoEl.videoWidth || 640)) * (videoEl.videoHeight || 360));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (dataUrl && dataUrl.length > 100) {
          return {
            videoFrames: [{
              base64: dataUrl,
              mimeType: 'image/jpeg',
              timestamp: Math.round((videoEl.currentTime || 0) * 10) / 10,
            }],
            mimeType,
          };
        }
      }
    }
  } catch (e) {
    console.warn('[AssistantChat] Erreur capture vidéo DOM:', e);
  }

  return null;
}

/**
 * Filtre anti-jargon technique pour garantir un langage humain et naturel comme Google Gemini
 */
function cleanTechnicalMediaJargon(text: string): string {
  if (!text) return text;
  return text
    .replace(/^.*(?:j['’]ai bien re[çc]u les \d+ images cl[ée]s|clich[ée]s captur[ée]s au cours de la vid[ée]o).*$/gim, '')
    .replace(/^.*voici une analyse d[ée]taill[ée]e de l['’][ée]volution des sc[èe]nes.*$/gim, '')
    .replace(/^(?:#+\s*)?(?:\d+\.\s*)?Sc[èe]ne\s*[àa]\s*\d+(?:\.\d+)?s\s*:?/gim, '')
    .replace(/^\s*[-*•]\s*Description\s+visuelle\s*:\s*/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Détecte si un élément est une ressource audio (musique, note vocale, podcast, enregistrement)
 */
function isAudioItem(item: any): boolean {
  if (!item) return false;
  const name = String(item.name || item.title || item.fileName || '').toLowerCase();
  const type = String(item.type || item.mimeType || '').toLowerCase();
  const ext = String(item.extension || '').toLowerCase();
  const category = String(item.category || item.fileType || item.file_category || '').toLowerCase();

  return Boolean(
    item.isAudio ||
    category.includes('audio') ||
    category === 'audio' ||
    category === 'audios' ||
    type.startsWith('audio/') ||
    /\.(mp3|wav|ogg|m4a|aac|flac|wma|opus|weba|oga)$/i.test(name) ||
    ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma', 'opus', 'weba', 'oga'].includes(ext) ||
    name.includes('whatsapp audio') ||
    name.includes('vocal') ||
    name.includes('voice') ||
    name.includes('enregistrement') ||
    item.audioUrl
  );
}

/**
 * Extrait le Base64 d'un fichier audio (MP3, WAV, M4A, OGG, Vocal WhatsApp, etc.)
 */
async function extractAudioContentFromItem(item: any): Promise<{
  audioBase64: string;
  mimeType: string;
} | null> {
  if (!item || !isAudioItem(item)) return null;

  const name = String(item.name || item.title || item.fileName || '').toLowerCase();
  const type = String(item.type || item.mimeType || '').toLowerCase();
  let mimeType = type.startsWith('audio/') ? type : 'audio/mp3';
  if (name.endsWith('.wav')) mimeType = 'audio/wav';
  else if (name.endsWith('.ogg') || name.endsWith('.opus')) mimeType = 'audio/ogg';
  else if (name.endsWith('.m4a') || name.endsWith('.aac')) mimeType = 'audio/m4a';
  else if (name.endsWith('.webm') || name.endsWith('.weba')) mimeType = 'audio/webm';

  if (typeof item.audioBase64 === 'string' && item.audioBase64.length > 50) {
    return { audioBase64: item.audioBase64, mimeType };
  }
  if (typeof item.base64 === 'string' && item.base64.length > 50 && item.base64.startsWith('data:audio')) {
    return { audioBase64: item.base64, mimeType };
  }

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('FileReader non-string'));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  let targetBlob: Blob | null = null;
  if (item.file instanceof Blob || item.file instanceof File) {
    targetBlob = item.file;
  } else if (item.blob instanceof Blob) {
    targetBlob = item.blob;
  }

  if (!targetBlob && item.id) {
    try {
      const b = await getFileBlob(item.id);
      if (b) targetBlob = b;
    } catch { }
  }

  if (!targetBlob) {
    let targetUrl = item.audioUrl || item.url || item.fileUrl || item.previewUrl;
    if (typeof targetUrl === 'string' && targetUrl.trim()) {
      if (targetUrl.startsWith('/')) {
        const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
        targetUrl = `${baseUrl}${targetUrl}`;
      }
      try {
        const resp = await fetch(targetUrl);
        if (resp.ok) {
          targetBlob = await resp.blob();
        }
      } catch { }
    }
  }

  if (targetBlob && targetBlob.size <= 28 * 1024 * 1024) {
    try {
      const b64 = await blobToBase64(targetBlob);
      return { audioBase64: b64, mimeType: targetBlob.type || mimeType };
    } catch { }
  }

  return null;
}

/**
 * Détecte si un élément est un document d'étude (PDF, Word DOCX/DOC, PPTX, Excel, Texte, etc.)
 */
function isDocumentItem(item: any): boolean {
  if (!item) return false;
  const name = String(item.name || item.title || item.fileName || '').toLowerCase();
  const type = String(item.type || item.mimeType || '').toLowerCase();
  const ext = String(item.extension || '').toLowerCase();
  const category = String(item.category || item.fileType || item.file_category || '').toLowerCase();

  return Boolean(
    item.isDocument ||
    category.includes('doc') ||
    category.includes('pdf') ||
    category.includes('cours') ||
    category.includes('fichier') ||
    type.includes('pdf') ||
    type.includes('word') ||
    type.includes('officedocument') ||
    type.includes('presentation') ||
    type.includes('spreadsheet') ||
    type.includes('text/') ||
    /\.(pdf|docx?|txt|md|pptx?|xlsx?|csv|odt|rtf|json|py|js|ts|html|sql)$/i.test(name) ||
    ['pdf', 'doc', 'docx', 'txt', 'md', 'pptx', 'ppt', 'xlsx', 'xls', 'csv', 'odt', 'rtf'].includes(ext)
  );
}

/**
 * Génère une signature unique stable pour un fichier/média (pour détecter si le fichier est identique ou a changé)
 */
function getMediaItemSignature(item: any): string {
  if (!item) return '';
  const id = item.id || item._id || item.r2_key || item.r2Key || item.key || '';
  const name = item.name || item.title || item.fileName || item.file?.name || '';
  const size = item.size || item.fileSize || item.file?.size || item.blob?.size || '';
  const lastMod = item.lastModified || item.file?.lastModified || '';
  return `${id}::${name}::${size}::${lastMod}`.trim();
}

function computeActiveMediaSignature(activeItem: any, attachedList?: any[]): string {
  const allDocs = [
    ...(activeItem ? [activeItem] : []),
    ...(Array.isArray(attachedList) ? attachedList.filter(Boolean) : [])
  ];
  return allDocs
    .map(getMediaItemSignature)
    .filter(sig => sig && sig !== '::::')
    .sort()
    .join('|');
}

// Détermine dynamiquement ce que l'IA réalise en temps réel (à l'instant T) selon le contexte et le délai
// Rédigé avec des messages pédagogiques rassurants, fluides et sans jargon technique
function getLiveAiActivity(prompt: string, docNames: string[], elapsedSec: number, requestedType?: string): string {
  const cleanPrompt = (prompt || '').trim().toLowerCase();
  const mainDoc = docNames && docNames.length > 0 ? docNames[0] : '';
  const hasDoc = Boolean(mainDoc);
  const normType = (requestedType || '').toLowerCase().replace(/_/g, '-');

  const pickReassuringStep = (steps: string[]): string => {
    if (!steps || steps.length === 0) return "Je prépare votre réponse avec soin...";
    const idx = Math.min(Math.floor(elapsedSec / 3), steps.length - 1);
    if (Math.floor(elapsedSec / 3) >= steps.length) {
      const extraIdx = (Math.floor(elapsedSec / 3) - steps.length) % 2;
      return extraIdx === 0
        ? steps[steps.length - 1]
        : "Je peaufine les derniers détails pour vous...";
    }
    return steps[idx];
  };

  // 1. Questionnaire Test (Test noté avec chronomètre)
  if (normType.includes('questionnaire-test') || normType === 'test' || /(questionnaire test|test noté|test chrono|épreuve notée)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je prépare les questions de votre test noté...",
      "J'ajuste le barème, le chronomètre et les critères d'évaluation...",
      "Je formule les explications pédagogiques détaillées pour chaque question...",
      "Tout est bientôt prêt pour votre test noté..."
    ]);
  }

  // 2. Questionnaire / Quiz QCM
  if (normType.includes('questionnaire') || normType.includes('quiz') || /(quiz|qcm|questionnaire)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "J'étudie votre sujet avec attention...",
      "Je sélectionne les questions les plus utiles pour votre révision...",
      "Je formule des explications claires pour vous guider...",
      "Je prépare les options de réponses pour vous entraîner...",
      "Votre questionnaire interactif arrive dans un instant..."
    ]);
  }

  // 3. Carte Conceptuelle (carte-mentale-2)
  if (normType.includes('carte-mentale-2') || normType.includes('mindmap2') || /(carte conceptuelle)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "J'analyse les piliers et relations conceptuelles de votre cours...",
      "Je structure les concepts en blocs hiérarchiques et connecteurs...",
      "Je relie les notions maîtresses pour une vue d'ensemble limpide...",
      "Votre carte conceptuelle est bientôt prête..."
    ]);
  }

  // 4. Carte Mentale (Arborescente)
  if (normType.includes('carte-mentale') || normType.includes('mindmap') || /(carte mentale|mindmap)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "J'organise les idées maîtresses de votre cours...",
      "Je relie les notions entre elles pour simplifier votre compréhension...",
      "Je structure les concepts clés de manière visuelle...",
      "J'harmonise la vue d'ensemble pour faciliter votre révision...",
      "Votre carte mentale est presque prête..."
    ]);
  }

  // 5. Cartes Mémoires / Flashcards
  if (normType.includes('carte-memoire') || normType.includes('flashcard') || /(flashcards?|carte mémoire)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je repère les définitions et notions indispensables...",
      "Je rédige des cartes claires pour stimuler votre mémoire...",
      "Je prépare les explications détaillées au verso...",
      "Je vérifie les réponses pour faciliter votre mémorisation...",
      "Vos cartes mémoires sont bientôt prêtes..."
    ]);
  }

  // 6. Fiche de Résumé / Synthèse
  if (normType.includes('resume') || /(résumé|fiche|synthèse)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je parcours les points clés de votre cours...",
      "Je synthétise les règles majeures pour aller à l'essentiel...",
      "J'organise les points de repère pour vous faire gagner du temps...",
      "Je soigne la clarté et la mise en page...",
      "Votre fiche de synthèse est prête dans un instant..."
    ]);
  }

  // 7. Document PDF
  if (normType.includes('pdf') || /document pdf/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je structure votre document d'étude...",
      "Je rédige un contenu complet, clair et bien expliqué...",
      "J'organise les chapitres pour vous faciliter l'apprentissage...",
      "Je peaufine la mise en page pour une lecture agréable...",
      "Votre document est presque prêt..."
    ]);
  }

  // 8. Vrai ou Faux Test (Épreuve notée)
  if (normType.includes('vrai-ou-faux-test') || normType.includes('vf-test') || /(vrai ou faux test|épreuve vrai faux|test vrai ou faux)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je prépare la série d'affirmations ciblées pour votre épreuve...",
      "Je configure le barème et la notation globale de l'épreuve...",
      "J'ajoute les justifications pédagogiques pour chaque énoncé...",
      "Votre épreuve de vrai ou faux test est presque prête..."
    ]);
  }

  // 9. Vrai ou Faux
  if (normType.includes('vrai') || /vrai ou faux/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je prépare des affirmations ciblées sur votre cours...",
      "Je formule des cas concrets pour consolider vos acquis...",
      "J'ajoute les justifications pédagogiques pour chaque réponse...",
      "Votre série de vrai ou faux est presque prête..."
    ]);
  }

  // 10. Devoir Complet (Examen officiel)
  if (normType.includes('devoir-complet') || /(devoir complet|sujet d'examen|épreuve d'examen|examen officiel)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je conçois un sujet d'examen officiel complet avec plusieurs parties...",
      "J'élabore les énoncés d'application et les questions pas à pas...",
      "Je prépare le barème officiel sur 20 points et le corrigé détaillé...",
      "Votre devoir complet d'examen est bientôt prêt..."
    ]);
  }

  // 11. Exercices Écrits
  if (normType.includes('exercice') || normType.includes('devoir') || /(exercice|devoir|exercices écrits)/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je prépare des exercices progressifs et adaptés à votre niveau...",
      "Je rédige des énoncés limpides et encourageants...",
      "Je détaille la méthode pas à pas pour vous accompagner...",
      "Je vérifie chaque consigne pour vous guider au mieux...",
      "Votre entraînement arrive dans un instant..."
    ]);
  }

  // 12. Infographie
  if (normType.includes('infographie') || /infographie/i.test(cleanPrompt)) {
    return pickReassuringStep([
      "Je regroupe les repères et informations indispensables...",
      "Je mets en valeur les points clés pour une lecture intuitive...",
      "J'harmonise la présentation de votre infographie...",
      "Votre infographie pédagogique est presque prête..."
    ]);
  }

  // 10. Mathématiques, calculs, sciences dures (sans jargon technique)
  const isMathScience = /(calcul|dériv|intégral|équat|formule|résoud|résous|schéma|circuit|aop|filtre|rlc|valeur|\$|\\dfrac|impédance|tension|courant|puissance|théorème|démonstr|vecteur|matrice|harmonique)/i.test(cleanPrompt);
  if (isMathScience) {
    return pickReassuringStep([
      "J'examine attentivement votre énoncé...",
      "Je prépare une explication simple, étape par étape...",
      "Je vérifie chaque résultat pour vous assurer une parfaite compréhension...",
      "Je termine la présentation claire de la solution...",
      "Votre explication détaillée est prête dans un instant..."
    ]);
  }

  // 11. Vidéo d'étude
  const isVideoOrVisual = mainDoc && (isVideoItem({ name: mainDoc }) || /\.(mp4|webm|mov|mkv|avi|flv|wmv|m4v|3gp|ogv|ts)$/i.test(mainDoc) || /vid[eé]o/i.test(mainDoc));
  if (isVideoOrVisual) {
    return pickReassuringStep([
      `J'analyse la vidéo « ${mainDoc} » et sa bande sonore...`,
      "J'examine ce qui se passe et ce qui est dit dans la vidéo...",
      "Je repère les éléments visuels et sonores essentiels...",
      "Je rédige une analyse claire et complète de votre vidéo...",
      "Votre réponse est bientôt prête..."
    ]);
  }

  // 12. Audio d'étude (vocal, cours oral, podcast)
  const isAudioDoc = mainDoc && (isAudioItem({ name: mainDoc }) || /\.(mp3|wav|ogg|m4a|aac|flac|wma|opus)$/i.test(mainDoc) || /audio|vocal/i.test(mainDoc));
  if (isAudioDoc) {
    return pickReassuringStep([
      `J'écoute attentivement l'enregistrement « ${mainDoc} »...`,
      "J'analyse les paroles et le discours prononcé...",
      "Je repère les idées maîtresses et explications orales...",
      "Je prépare une synthèse claire de votre document audio...",
      "Votre réponse est bientôt prête..."
    ]);
  }

  // 12. Document d'étude ouvert ou joint (PDF, Word, etc.)
  const isDocFile = mainDoc && (isDocumentItem({ name: mainDoc }) || /\.(pdf|docx?|pptx?|xlsx?|txt|md)$/i.test(mainDoc));
  if (isDocFile) {
    return pickReassuringStep([
      `J'examine attentivement votre document « ${mainDoc} »...`,
      "J'analyse le texte et j'examine les schémas, dessins et graphiques...",
      "Je repère les formules, figures géométriques et notions clés...",
      "Je prépare une réponse complète intégrant le texte et les schémas...",
      "Votre réponse est bientôt prête..."
    ]);
  }

  // 13. Document général ouvert ou joint
  if (hasDoc) {
    return pickReassuringStep([
      `Je m'appuie sur votre document « ${mainDoc} »...`,
      "Je sélectionne les passages importants pour répondre au mieux...",
      "Je prépare une réponse claire adaptée à votre cours...",
      "Je peaufine les explications pour vous guider...",
      "Votre réponse est bientôt prête..."
    ]);
  }

  // 12. Cas général (Discussion normale)
  return pickReassuringStep([
    "J'analyse votre question avec attention...",
    "Je prépare une explication claire et détaillée...",
    "Je structure la réponse étape par étape...",
    "Je peaufine les conseils pour vous...",
    "Votre réponse arrive dans un instant..."
  ]);
}

// Détection professionnelle des coupures réseau et absence de connexion
export function isNetworkError(err: any): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!err) return false;
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('network_disconnected') ||
    msg.includes('connexion internet') ||
    msg.includes('hors ligne') ||
    msg.includes('offline') ||
    msg.includes('load failed') ||
    msg.includes('net::err') ||
    (err?.name === 'TypeError' && (msg.includes('fetch') || msg.includes('network')))
  );
}

function isNetworkErrorMessage(msg: Message): boolean {
  if (msg.errorType === 'network') return true;
  if (!msg.text) return false;
  const t = msg.text.toLowerCase();
  return (
    t.includes('failed to fetch') ||
    t.includes('network_disconnected') ||
    t.includes('connexion internet') ||
    t.includes('hors ligne') ||
    t.includes('networkerror') ||
    t.includes('vérifier votre connexion') ||
    t.includes('vérifier votre réseau')
  );
}

// Carte d'information de connexion (sans texte superflu ni bouton rouge)
function NetworkErrorCard({
  retryPrompt,
  onRetry,
  isRetrying = false,
}: {
  retryPrompt?: string;
  onRetry: () => void;
  isRetrying?: boolean;
}) {
  return (
    <div className="my-2 p-3 sm:p-3.5 rounded-2xl bg-[#1e2026] border border-zinc-700/80 shadow-md w-full max-w-xl transition-all animate-fadeIn">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 shrink-0">
          <WifiOff className="w-4 h-4 text-orange-400" />
        </div>
        <p className="flex-1 text-xs sm:text-[13px] text-zinc-200 leading-relaxed font-medium">
          Veuillez vérifier que votre appareil est bien connecté à Internet (Wi-Fi ou données mobiles).
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-60 shrink-0 active:scale-95 shadow-sm"
          title="Réessayer"
        >
          <RotateCw className={`w-3 h-3 text-orange-400 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? 'Connexion...' : 'Réessayer'}</span>
        </button>
      </div>
    </div>
  );
}

function ChatRecommendationCard({ recoType }: { recoType: string; key?: any }) {
  const norm = recoType.trim().toLowerCase();
  let cardTitle = 'Fiches & exercices de révision';
  let cardDesc = 'Un ensemble interactif optimisé pour mémoriser rapidement les concepts clés de ce chapitre.';

  if (norm.includes('flashcard') || norm.includes('carte')) {
    cardTitle = 'Flashcards & cartes mémoire';
    cardDesc = 'Un jeu de cartes interactif pour associer rapidement chaque formule et notion essentielle.';
  } else if (norm.includes('diaporama') || norm.includes('présentation')) {
    cardTitle = 'Guide visuel & diaporama';
    cardDesc = 'Une présentation pas-à-pas illustrant les propriétés fondamentales et la méthode de résolution.';
  } else if (norm.includes('quiz') || norm.includes('qcm')) {
    cardTitle = "Quiz d'entraînement interactif";
    cardDesc = 'Testez vos connaissances avec 10 questions corrigées pas à pas.';
  } else if (norm.includes('mindmap') || norm.includes('mentale')) {
    cardTitle = 'Carte mentale synthétique';
    cardDesc = 'Une vue arborescente pour visualiser toutes les connexions entre les théorèmes.';
  }

  return (
    <div className="my-3 p-4 rounded-2xl bg-[#23262d] border border-zinc-700/80 shadow-md flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-[11px] font-bold text-zinc-300">
          <Layers className="w-3.5 h-3.5 text-orange-400" />
          <span className="capitalize">Recommandé : {norm}</span>
        </div>
      </div>
      <h4 className="text-sm font-bold text-white leading-tight">{cardTitle}</h4>
      <p className="text-xs text-zinc-400 leading-relaxed">{cardDesc}</p>
      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('auto-prompt', {
              detail: { prompt: `Crée une création de type ${norm} sur ce cours` }
            }));
          }}
          className="px-4 py-1.5 rounded-full bg-white text-zinc-900 hover:bg-zinc-200 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

function sanitizeSvg(rawSvg: string): string {
  if (!rawSvg) return '';
  return rawSvg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\bon\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\bon\w+\s*=\s*[^>\s]+/gi, '')
    .replace(/javascript:/gi, '');
}

function extractSvgBlocks(content: string): { cleanText: string; svgBlocks: string[] } {
  const svgBlocks: string[] = [];
  let cleanText = content;

  // 1. Blocs de code ```svg ... ```
  cleanText = cleanText.replace(/```(?:svg|xml)?\s*(<svg[\s\S]*?<\/svg>)\s*```/gi, (_match, svg) => {
    svgBlocks.push(sanitizeSvg(svg));
    return `\n\n__STUDYCLOUD_SVG_BLOCK_${svgBlocks.length - 1}__\n\n`;
  });

  // 2. Balises brutes <svg ... </svg>
  cleanText = cleanText.replace(/(<svg\b[^>]*>[\s\S]*?<\/svg>)/gi, (match) => {
    svgBlocks.push(sanitizeSvg(match));
    return `\n\n__STUDYCLOUD_SVG_BLOCK_${svgBlocks.length - 1}__\n\n`;
  });

  return { cleanText, svgBlocks };
}

// Formats de création StudyCloud officiels
const CREATION_FORMAT_LABELS: Record<string, string> = {
  'questionnaire': 'Questionnaire Quiz QCM interactif',
  'quiz': 'Questionnaire Quiz QCM interactif',
  'questionnaire-test': 'Questionnaire Test noté avec chronomètre',
  'carte-mentale': 'Carte Mentale arborescente',
  'mindmap': 'Carte Mentale arborescente',
  'carte-mentale-2': 'Carte Conceptuelle',
  'mindmap2': 'Carte Conceptuelle',
  'carte-memoire': 'Cartes Mémoires (Flashcards)',
  'flashcards': 'Cartes Mémoires (Flashcards)',
  'resume': 'Fiche de Résumé structurée',
  'pdf': 'Document PDF polycopié d\'étude',
  'vrai-ou-faux': 'Série Vrai ou Faux interactive',
  'vrai-ou-faux-test': 'Épreuve Vrai ou Faux Test notée',
  'vf-test': 'Épreuve Vrai ou Faux Test notée',
  'exercices-ecrits': 'Série d\'Exercices Écrits d\'application',
  'exercices': 'Série d\'Exercices Écrits d\'application',
  'devoir-complet': 'Devoir Complet d\'examen officiel',
  'devoir': 'Devoir Complet d\'examen officiel',
  'infographie': 'Infographie pédagogique visuelle',
};

const CREATION_NAME_MAP: Record<string, string> = {
  'questionnaire': 'Questionnaire QCM',
  'quiz': 'Questionnaire QCM',
  'qcm': 'Questionnaire QCM',
  'questionnaire-test': 'Questionnaire Test',
  'test': 'Questionnaire Test',
  'carte-mentale': 'Carte Mentale',
  'mindmap': 'Carte Mentale',
  'carte-mentale-2': 'Carte Conceptuelle',
  'mindmap2': 'Carte Conceptuelle',
  'carte-memoire': 'Cartes Mémoires',
  'flashcards': 'Cartes Mémoires',
  'resume': 'Fiche de Résumé',
  'summary': 'Fiche de Résumé',
  'pdf': 'Document PDF',
  'vrai-ou-faux': 'Vrai ou Faux',
  'vrai-ou-faux-test': 'Vrai ou Faux Test',
  'exercices-ecrits': 'Exercices Écrits',
  'exercices': 'Exercices Écrits',
  'devoir-complet': 'Devoir Complet',
  'devoir': 'Devoir Complet',
  'infographie': 'Infographie',
};


// Suggestions de prompts avec sujets concrets selon le format demandé
function getSuggestedPromptsForFormat(formatType: string): string[] {
  const norm = (formatType || '').toLowerCase().replace(/_/g, '-');
  if (norm.includes('carte-mentale-2') || norm.includes('mindmap2')) {
    return [
      'Carte Conceptuelle sur les Fonctions et Dérivées en Mathématiques',
      'Carte Conceptuelle sur l\'Architecture des Systèmes Informatiques',
      'Carte Conceptuelle sur les Réactions d\'Oxydoréduction en Chimie',
      'Carte Conceptuelle sur les Structures de Données et Graphes'
    ];
  }
  if (norm.includes('carte-mentale') || norm.includes('mindmap')) {
    return [
      'Carte Mentale sur les Fonctions et Dérivées en Mathématiques',
      'Carte Mentale sur les Réactions d\'Oxydoréduction en Chimie',
      'Carte Mentale sur la Mitose et la Méiose en Biologie SVT',
      'Carte Mentale sur les Structures de Données et Algorithmes en Informatique'
    ];
  }
  if (norm.includes('carte-memoire') || norm.includes('flashcard')) {
    return [
      'Cartes Mémoires sur les Formules de Trigonométrie et Dérivées',
      'Cartes Mémoires sur le Vocabulaire Anglais du Monde du Travail',
      'Cartes Mémoires sur les Définitions Fondamentales du Droit Constitutionnel',
      'Cartes Mémoires sur la Photosynthèse et la Respiration Cellulaire'
    ];
  }
  if (norm.includes('resume')) {
    return [
      'Fiche de Résumé sur la Thermodynamique et les Transferts Thermiques',
      'Fiche de Résumé sur les Espaces Vectoriels et Matrices en Algèbre',
      'Fiche de Résumé sur les Notions Clés de la Microéconomie',
      'Fiche de Résumé sur l\'Architecture des Processeurs et Mémoires'
    ];
  }
  if (norm.includes('pdf')) {
    return [
      'Document PDF complet sur le Calcul Intégral et Équations Différentielles',
      'Document PDF sur les Principes de la Mécanique Newtonienne',
      'Document PDF sur la Programmation Orientée Objet en Python',
      'Document PDF sur les Institutions de la Ve République'
    ];
  }
  if (norm.includes('vrai-ou-faux-test') || norm.includes('vf-test')) {
    return [
      'Vrai ou Faux Test noté sur les Nombres Complexes et Trigonométrie',
      'Vrai ou Faux Test sur la Génétique et l\'ADN en SVT',
      'Vrai ou Faux Test sur les Lois de Newton et Énergie Mécanique',
      'Vrai ou Faux Test sur les Circuits Électriques et Théorèmes de Kirchhoff'
    ];
  }
  if (norm.includes('vrai-ou-faux')) {
    return [
      'Vrai ou Faux sur les Nombres Complexes et Géométrie dans le Plan',
      'Vrai ou Faux sur la Génétique et les Lois de Mendel en SVT',
      'Vrai ou Faux sur les Circuits Électriques et Théorème de Millman',
      'Vrai ou Faux sur la Programmation et Complexité Algorithmique'
    ];
  }
  if (norm.includes('exercice')) {
    return [
      'Exercices Écrits corrigés sur les Équations Différentielles du 1er et 2nd ordre',
      'Exercices Écrits sur la Cinématique et Mouvement Rectiligne Uniforme',
      'Exercices Écrits sur les Suites Numériques et Récurrence',
      'Exercices Écrits sur les Arbres Binaires et Parcours en Informatique'
    ];
  }
  if (norm.includes('devoir') || norm.includes('examen')) {
    return [
      'Devoir Complet d\'examen sur les Amplificateurs Opérationnels (AOP en régime linéaire)',
      'Devoir Complet sur les Probabilités, Variables Aléatoires et Lois de Densité',
      'Devoir Complet sur l\'Optique Géométrique et Lentilles Minces',
      'Devoir Complet sur les Bases de Données et Requêtes SQL Avancées'
    ];
  }
  if (norm.includes('infographie')) {
    return [
      'Infographie sur le Cycle Cellulaire et les Phases de la Mitose',
      'Infographie sur le Spectre Électromagnétique et Longueurs d\'Onde',
      'Infographie sur la Chronologie de la Construction Européenne',
      'Infographie sur le Modèle OSI et Protocoles Réseaux'
    ];
  }
  if (norm.includes('test') || norm.includes('questionnaire-test')) {
    return [
      'Questionnaire Test noté sur les Dérivées et Études de Fonctions',
      'Questionnaire Test noté sur les Principes Fondamentaux de la Thermodynamique',
      'Questionnaire Test avec chronomètre sur les Lois de Newton',
      'Questionnaire Test noté sur les Algorithmes de Tri et Recherche'
    ];
  }
  return [
    'Questionnaire QCM sur les Lois de Newton et l\'Énergie Mécanique',
    'Questionnaire QCM sur les Équations du Second Degré en Mathématiques',
    'Questionnaire QCM sur la Révolution Industrielle et Société au XIXe siècle',
    'Questionnaire QCM sur les Listes et Dictionnaires en Python'
  ];
}

// Extraction robuste et universelle du texte d'une affirmation Vrai ou Faux
function extractStatementText(a: any): string {
  let stmt = '';
  if (typeof a === 'string') {
    stmt = a.trim();
  } else if (a && typeof a === 'object') {
    stmt = String(
      a.statement ||
      a.affirmation ||
      a.proposition ||
      a.enonce ||
      a.phrase ||
      a.question ||
      a.claim ||
      a.texte ||
      a.text ||
      a.content ||
      a.item ||
      a.label ||
      a.title ||
      ''
    ).trim();
  }
  const explText = typeof a?.explanation === 'string'
    ? a.explanation
    : (typeof a?.explication === 'string'
      ? a.explication
      : (typeof a?.justification === 'string' ? a.justification : ''));

  if (!stmt || /^Affirmation\s*(?:n°\s*\d+)?$/i.test(stmt)) {
    if (explText && explText.length > 10) {
      stmt = explText;
    }
  }
  return stmt;
}

// Vérificateur de complétude et validité réelle des données de création pour chaque type
function hasRealCreationData(type: string, content: any): boolean {
  if (!content || typeof content !== 'object') return false;
  const norm = normalizeCreationType(type as any);

  if (norm === 'vrai-ou-faux' || norm === 'vrai-ou-faux-test') {
    const affs = Array.isArray(content) ? content : (content.affirmations || content.propositions);
    return Array.isArray(affs) && affs.length > 0 && affs.some((a: any) => {
      const s = extractStatementText(a);
      return s.length > 5 && !/^Affirmation\s*(?:n°\s*\d+)?$/i.test(s);
    });
  }

  if (norm === 'questionnaire' || norm === 'questionnaire-test') {
    const qs = Array.isArray(content) ? content : content.questions;
    return Array.isArray(qs) && qs.length > 0 && qs.some((q: any) => {
      const txt = typeof q === 'string' ? q : (q?.question || q?.enonce || q?.title || '');
      return String(txt).trim().length > 3;
    });
  }

  if (norm === 'carte-mentale' || norm === 'carte-mentale-2') {
    return Boolean(
      content.root ||
      content.branches ||
      content.columns ||
      content.piliers ||
      content.nodes ||
      (Array.isArray(content.children) && content.children.length > 0)
    );
  }

  if (norm === 'exercices-ecrits') {
    const exs = content.written_exercise?.questions || content.exercises || content.exercices || (Array.isArray(content.questions) ? content.questions : null);
    return Boolean(Array.isArray(exs) && exs.length > 0);
  }

  if (norm === 'devoir-complet') {
    const secs = content.complete_exam?.sections || content.sections || content.devoir?.sections;
    return Boolean(Array.isArray(secs) && secs.length > 0);
  }

  if (norm === 'carte-memoire') {
    const cards = content.cards || content.flashcards || (Array.isArray(content) ? content : null);
    return Boolean(Array.isArray(cards) && cards.length > 0);
  }

  if (norm === 'resume') {
    return Boolean(
      (typeof content.overview === 'string' && content.overview.trim().length > 10) ||
      (Array.isArray(content.key_definitions) && content.key_definitions.length > 0) ||
      (Array.isArray(content.sections) && content.sections.length > 0) ||
      (typeof content.markdown === 'string' && content.markdown.trim().length > 20)
    );
  }

  if (norm === 'infographie') {
    return Boolean(
      content.stats ||
      content.metrics ||
      content.keyConcepts ||
      content.timeline ||
      content.summary_cards
    );
  }

  if (norm === 'pdf') {
    return Boolean(
      (Array.isArray(content.sections) && content.sections.length > 0) ||
      (Array.isArray(content.chapters) && content.chapters.length > 0) ||
      (typeof content.content === 'string' && content.content.trim().length > 20)
    );
  }

  return Object.keys(content).length > 0;
}

// Prompt ciblé et exclusif pour chaque sous-agent afin d'éviter la contamination entre modules
function getSubAgentTargetPrompt(toolType: AiCreationType, docName: string, originalUserText: string): string {
  const norm = normalizeCreationType(toolType);
  const safeDoc = docName || "Document d'étude";
  const userContext = originalUserText ? ` (Demande globale de l'étudiant : "${originalUserText}")` : '';

  switch (norm) {
    case 'vrai-ou-faux':
    case 'vrai-ou-faux-test':
      return `Mission exclusive pour ce sous-agent : Rédige une série complète de 10 à 18 affirmations VRAI OU FAUX rigoureuses pour tester la précision conceptuelle sur : ${safeDoc}.${userContext}
Chaque affirmation DOIT comporter un énoncé textuel précis dans "statement" (sans placeholder comme 'Affirmation 1'), la valeur booléenne (is_true: true ou false) et une justification détaillée. Tu es strictement dédié à ce module Vrai ou Faux.`;

    case 'carte-mentale':
    case 'carte-mentale-2':
      return `Mission exclusive pour ce sous-agent : Conçois une CARTE MENTALE complète, arborescente et hiérarchisée structurant visuellement toutes les notions clés sur : ${safeDoc}.${userContext}
Définit un nœud central (root), des branches principales thématiques, des sous-branches et des détails conceptuels. Tu es strictement dédié à ce module Carte Mentale.`;

    case 'exercices-ecrits':
      return `Mission exclusive pour ce sous-agent : Rédige une série complète d'EXERCICES ÉCRITS d'application progressive avec énoncés détaillés, questions numérotées, démarches guidées et solutions corrigées détaillées pas à pas sur : ${safeDoc}.${userContext}
Tu es strictement dédié à ce module Exercices Écrits.`;

    case 'devoir-complet':
      return `Mission exclusive pour ce sous-agent : Conçois un DEVOIR COMPLET d'examen officiel avec barème sur 20 points, énoncés rigoureux et corrigé type détaillé pas à pas sur : ${safeDoc}.${userContext}
Tu es strictement dédié à ce module Devoir Complet.`;

    case 'carte-memoire':
      return `Mission exclusive pour ce sous-agent : Conçois un jeu de 10 à 20 CARTES MÉMOIRE (flashcards recto/verso avec question ciblée et réponse synthétique) pour la mémorisation active sur : ${safeDoc}.${userContext}
Tu es strictement dédié à ce module Cartes Mémoire.`;

    case 'resume':
      return `Mission exclusive pour ce sous-agent : Rédige une FICHE DE RÉVISION ET SYNTHÈSE complète avec grands points clés, définitions incontournables, formules, pièges d'examen et exemples concrets sur : ${safeDoc}.${userContext}
Tu es strictement dédié à ce module Résumé.`;

    case 'questionnaire':
    case 'questionnaire-test':
      return `Mission exclusive pour ce sous-agent : Conçois un QUESTIONNAIRE (QCM) rigoureux de 10 à 18 questions avec 4 options (A, B, C, D), bonne réponse identifiée et explications détaillées sur : ${safeDoc}.${userContext}
Tu es strictement dédié à ce module Questionnaire QCM.`;

    case 'infographie':
      return `Mission exclusive pour ce sous-agent : Conçois une INFOGRAPHIE PÉDAGOGIQUE synthétique structurant visuellement les repères clés, statistiques et synthèses sur : ${safeDoc}.${userContext}
Tu es strictement dédié à ce module Infographie.`;

    case 'pdf':
      return `Mission exclusive pour ce sous-agent : Rédige un POLYCOPIÉ DE COURS académique complet et structuré, prêt pour l'exportation PDF sur : ${safeDoc}.${userContext}
Tu es strictement dédié à ce module Polycopié PDF.`;

    default:
      return `Mission exclusive pour ce sous-agent : Fabrique le support pédagogique "${toolType}" sur : ${safeDoc}.${userContext}`;
  }
}

// Consigne commune d'analyse approfondie, d'exploitation intégrale du document joint, des zones d'ombre, des formules et de la logique
function getCommonDeepCreationDirective(docName?: string): string {
  const safeDoc = docName ? `« ${docName} »` : 'le document/cours étudié';
  return `══════════════════════════════════════════════════════════════════════════════
[CONSIGNE COMMUNE OBLIGATOIRE POUR TOUS LES AGENTS DE CRÉATION — ANALYSE APPROFONDIE, ZONES D'OMBRE, FORMULES COMPLÈTES & LOGIQUE DU DOCUMENT] :
══════════════════════════════════════════════════════════════════════════════
Tu es un Agent de Conception Académique d'Élite de StudyCloud. Quelle que soit la nature du support que tu fabriques (Carte Mentale, Questionnaire QCM, Questionnaire Test, Vrai ou Faux, Vrai ou Faux Test, Cartes Mémoires, Fiche de Résumé/Révision, Exercices Écrits, Devoir Complet, Infographie ou Polycopié PDF) sur ${safeDoc}, tu dois appliquer ce PROTOCOLE COMMUN D'EXCELLENCE avant et pendant la construction de ton JSON :

1. INTERDICTION ABSOLUE DU TRAVAIL SUPERFICIEL OU EXPÉDITIF :
   - Ne construis JAMAIS un support rapide, générique, survolé ou incomplet.
   - Analyse méticuleusement l'INTÉGRALITÉ du document joint (du premier chapitre jusqu'au dernier exercice ou Travaux Dirigés / TD, y compris les schémas, circuits, courbes, diagrammes de Bode, tableaux et remarques).
   - Extrais TOUTE la substance du document : chaque chapitre, chaque sous-partie, chaque théorème, chaque montage ou configuration, chaque cas particulier et chaque application. Ce que tu livres à l'étudiant doit être IMPRESSIONNANT de richesse, de précision et de profondeur académique.

2. ÉCLAIRCISSEMENT SYSTÉMATIQUE DES « ZONES D'OMBRE » (SUBTILITÉS, HYPOTHÈSES CACHÉES & PIÈGES) :
   - Dans tout support de cours, il existe des « zones d'ombre » : étapes de démonstration sous-entendues par l'enseignant, hypothèses physiques ou mathématiques implicites (ex: régime linéaire vs saturé d'un AOP, impédance d'entrée infinie $i^+ = i^- = 0$, approximations basses/hautes fréquences $\\omega \\to 0$ et $\\omega \\to \\infty$, conditions de validité d'une loi, conventions de signe, cas limites).
   - Tu dois DÉBUSQUER et EXPLIQUER clairement toutes ces zones d'ombre dans ton support (dans les explications des QCM/Vrai-Faux, dans les branches/feuilles de la Carte Mentale, dans les sections/pièges du Résumé, au verso des Cartes Mémoires, et dans les corrigés des Exercices/Devoirs) pour que l'étudiant comprenne ce qui n'est pas dit explicitement et ne soit jamais bloqué en examen.

3. EXTRACTION EXHAUSTIVE DE TOUTES LES FORMULES ET DE LEUR LOGIQUE :
   - Extrais et intègre TOUTES les formules mathématiques, physiques ou scientifiques du document (lois fondamentales, fonctions de transfert, formes canoniques, pulsations propres $\\omega_0$, fréquences de coupure $f_c$, facteurs de qualité $Q_0$, gains $A_0$ ou $T_0$, déphasages $\\varphi$, pentes asymptotiques en dB/décade, etc.).
   - Écris OBLIGATOIREMENT chaque formule en LaTeX irréprochable ($...$ ou $$...$$) avec de VRAIES fractions verticales \\dfrac{numérateur}{dénominateur} (ZÉRO slash '/').
   - Explique toujours la LOGIQUE de chaque formule : d'où elle vient (quel théorème ou quelle loi permet de l'établir : diviseur de tension, Millman, loi des mailles/nœuds, impédances complexes $Z_C = \\dfrac{1}{jC\\omega}$, $Z_L = jL\\omega$...), que signifie physiquement chaque terme avec son unité SI, et comment on passe d'une expression brute à la forme canonique.

4. MAÎTRISE DE LA LOGIQUE PROFONDE (« LE POURQUOI ET LE COMMENT ») :
   - Fais ressortir la logique interne du cours : le lien de cause à effet entre les concepts, l'intuition physique ou logique (ex: pourquoi un condensateur se comporte comme un interrupteur ouvert en basse fréquence $\\omega \\to 0$ et comme un fil en haute fréquence $\\omega \\to \\infty$, comment reconnaître immédiatement la nature d'un filtre ou d'une équation avant même de calculer), et les méthodes de vérification rapide.

5. EXIGENCE DE DENSITÉ MAXIMALE SELON TON FORMAT INDIVIDUEL :
   - Tout en respectant strictement le schéma JSON propre à ton module individuel :
     * Si tu crées un RÉSUMÉ ('resume') : couvre 100 % des parties du document dans 'sections' (5 à 8 grandes sections très développées éclaircissant chaque notion et chaque zone d'ombre), inclus toutes les définitions dans 'key_definitions' (8 à 15 concepts), toutes les formules du document avec leurs étapes de démonstration et pièges dans 'formulas' (6 à 12 formules complètes), un tableau comparatif exhaustif dans 'comparison_table', au moins 6 à 8 pièges et astuces méthodologiques dans 'traps_and_tips', et un exercice type complet du document résolu de A à Z dans 'practical_example'.
     * Si tu crées une CARTE MENTALE ('carte-mentale', 'carte-mentale-2') : déploie une arborescence ultra-complète à 4 paliers couvrant tous les chapitres, tous les montages/cas et les TD du document (5 à 7 Grands Piliers de niveau 1, chacun divisé en 3 à 5 sous-branches de niveau 2, chacune portant des feuilles de niveau 3 riches contenant les formules exactes en LaTeX \\dfrac{}{}, la logique clé et les zones d'ombre éclaircies).
     * Si tu crées un QUESTIONNAIRE QCM ('questionnaire', 'questionnaire-test') ou VRAI/FAUX ('vrai-ou-faux', 'vrai-ou-faux-test') : génère 15 à 18 questions/affirmations de haut niveau couvrant tout le document (concepts, formules canoniques en LaTeX, logique physique, zones d'ombre/pièges d'examen et calculs issus des TD du document). Chaque 'explanation' doit être une véritable mini-leçon détaillée expliquant la logique complète, la formule utilisée avec \\dfrac{}{} et la zone d'ombre ou le piège à éviter.
     * Si tu crées des CARTES MÉMOIRES ('carte-memoire') : génère 15 à 20 flashcards denses couvrant toutes les définitions, toutes les formules canoniques, les méthodes de démonstration et les zones d'ombre du document, avec au verso ('back'/'answer') la réponse complète, la formule LaTeX \\dfrac{}{} et l'explication logique.
     * Si tu crées des EXERCICES ÉCRITS ('exercices-ecrits') ou un DEVOIR COMPLET ('devoir-complet') : exploite directement les montages, schémas et Travaux Dirigés du document pour construire une épreuve complète sur 20 points avec des corrigés pas-à-pas intégralement démontrés (formules littérales avec \\dfrac{}{}, explication de chaque étape logique et résultat encadré \\boxed{}).
══════════════════════════════════════════════════════════════════════════════`;
}

// Spécification formelle du schéma JSON attendu pour chaque sous-agent dans le prompt système
function getTargetJsonInstructions(type: AiCreationType, docName: string, title: string): string {
  const norm = normalizeCreationType(type);
  switch (norm) {
    case 'vrai-ou-faux':
    case 'vrai-ou-faux-test':
      return `FORMAT JSON ATTENDU :
\`\`\`json
{
  "decision": "creation",
  "mode": "creation",
  "creation_type": "${norm}",
  "creation_title": "${title}",
  "chat_response": "Affirmations Vrai ou Faux prêtes !",
  "creation_data": {
    "affirmations": [
      {
        "id": "vf_1",
        "statement": "Énoncé complet, subtil et précis d'une affirmation scientifique avec formules KaTeX ($...$) ciblant une propriété, une formule ou une zone d'ombre du document",
        "is_true": true,
        "explanation": "Justification pédagogique approfondie démontrant la logique physique/mathématique complète, la formule exacte avec \\\\dfrac{}{} et le piège à éviter"
      }
    ]
  }
}
\`\`\`
RÈGLES CRUCIALES POUR LES VRAI OU FAUX :
- Rédige entre 15 et 18 affirmations distinctes, subtiles et exigeantes couvrant tout le document (chapitres, formules, conditions de validité, zones d'ombre et TD).
- Chaque affirmation DOIT avoir un énoncé textuel complet dans "statement" et une démonstration pédagogique détaillée dans "explanation".
- INTERDICTION FORMELLE d'écrire seulement 'Affirmation 1' ou 'Affirmation n°1' sans énoncé.`;

    case 'carte-mentale':
    case 'carte-mentale-2':
      return `FORMAT JSON ATTENDU (ARBORESCENCE PROFONDE ET EXHAUSTIVE À 4 PALIERS COUVRANT TOUT LE DOCUMENT) :
\`\`\`json
{
  "decision": "creation",
  "mode": "creation",
  "creation_type": "${norm}",
  "creation_title": "${title}",
  "chat_response": "Carte mentale générée avec succès !",
  "creation_data": {
    "root": {
      "id": "root-1",
      "label": "${docName}",
      "children": [
        {
          "id": "pilier-1",
          "label": "1. Premier Grand Pilier / Chapitre du Document",
          "children": [
            {
              "id": "sub-1-1",
              "label": "A. Concept / Montage / Loi fondamentale",
              "children": [
                { "id": "leaf-1-1-1", "label": "Définition & Logique physique complète" },
                { "id": "leaf-1-1-2", "label": "Formule canonique : $$ T(j\\\\omega) = \\\\dfrac{T_0}{1 + j\\\\dfrac{\\\\omega}{\\\\omega_0}} $$" },
                { "id": "leaf-1-1-3", "label": "Zone d'ombre & Piège d'examen : condition de validité et comportement asymptotique" }
              ]
            }
          ]
        }
      ]
    }
  }
}
\`\`\`
RÈGLES CRUCIALES POUR LA CARTE MENTALE :
- Génère 5 à 7 Grands Piliers principaux (children de root) couvrant 100 % des parties et TD du document.
- Chaque Pilier DOIT comporter 3 à 5 sous-branches, et chaque sous-branche DOIT comporter 3 à 4 feuilles détaillant les définitions, TOUTES les formules en LaTeX avec \\\\dfrac{}{}, la logique physique et les zones d'ombre éclaircies.`;

    case 'exercices-ecrits':
      return `FORMAT JSON ATTENDU :
\`\`\`json
{
  "decision": "creation",
  "mode": "creation",
  "creation_type": "exercices-ecrits",
  "creation_title": "${title}",
  "chat_response": "Exercices écrits rédigés avec succès !",
  "creation_data": {
    "written_exercise": {
      "title": "${title}",
      "theme": "${docName}",
      "context": "Présentation complète du système étudié dans le document, schémas/montages, hypothèses physiques et données.",
      "questions": [
        {
          "id": "q1",
          "number": 1,
          "text": "Énoncé précis et complet de la question avec formules KaTeX ($...$)",
          "points": 2.5,
          "sampleAnswer": "Correction détaillée pas à pas : rappel du théorème/loi, développement littéral avec \\\\dfrac{}{}, éclaircissement de la zone d'ombre et résultat encadré $$ \\\\boxed{...} $$"
        }
      ],
      "correction": {
        "steps": "Synthèse méthodologique globale de résolution étape par étape...",
        "examples": ["Application numérique concrète avec unités SI", "Vérification asymptotique et piège d'examen à éviter"]
      }
    }
  }
}
\`\`\`
RÈGLES CRUCIALES POUR LES EXERCICES ÉCRITS :
- Génère 8 à 10 questions/exercices progressifs exploitant directement le cours et les TD du document joint, totalisant 20 points avec corrigés complets pas à pas.`;

    case 'devoir-complet':
      return `FORMAT JSON ATTENDU :
\`\`\`json
{
  "decision": "creation",
  "mode": "creation",
  "creation_type": "devoir-complet",
  "creation_title": "${title}",
  "chat_response": "Devoir complet d'examen conçu avec succès !",
  "creation_data": {
    "complete_exam": {
      "exam_title": "${title}",
      "total_points": 20,
      "time_allowed": "2 heures",
      "sections": [
        {
          "title": "Exercice 1 : Problème Majeur & Modélisation Analytique (8 points)",
          "problem_statement": "Mise en situation complète issue du document avec hypothèses et données.",
          "points": 8,
          "questions": [
            { "id": "p1_q1", "number": "1.", "texte": "Énoncé complet de la question avec KaTeX ($...$)", "points": 3, "sampleAnswer": "Démonstration complète pas à pas avec \\\\dfrac{}{} et résultat encadré $$ \\\\boxed{...} $$" }
          ]
        },
        {
          "title": "Exercice 2 : Questionnaire d'Analyse Approfondie QCM (6 points)",
          "points": 6,
          "questions": [
            { "id": "p2_q1", "number": "1.", "texte": "Question d'analyse avec formules KaTeX ($...$)", "points": 1.5, "options": ["Choix A", "Choix B", "Choix C", "Choix D"], "correctIndex": 0, "explication": "Justification théorique et logique détaillée" }
          ]
        },
        {
          "title": "Exercice 3 : Test de Discrimination Conceptuelle Vrai/Faux (6 points)",
          "points": 6,
          "questions": [
            { "id": "p3_q1", "number": "1.", "texte": "Affirmation pointue ciblant une zone d'ombre ou formule du cours", "points": 1.5, "correctValue": true, "explication": "Démonstration pédagogique complète" }
          ]
        }
      ]
    }
  }
}
\`\`\``;

    case 'carte-memoire':
      return `FORMAT JSON ATTENDU :
\`\`\`json
{
  "decision": "creation",
  "mode": "creation",
  "creation_type": "carte-memoire",
  "creation_title": "${title}",
  "chat_response": "Cartes mémoires prêtes !",
  "creation_data": {
    "cards": [
      {
        "id": "fc_1",
        "front": "Question précise, notion clé, formule ou zone d'ombre au recto ?",
        "back": "Réponse complète au verso : définition rigoureuse, formule en LaTeX avec \\\\dfrac{}{}, logique physique et piège à éviter.",
        "question": "Question précise, notion clé, formule ou zone d'ombre au recto ?",
        "answer": "Réponse complète au verso : définition rigoureuse, formule en LaTeX avec \\\\dfrac{}{}, logique physique et piège à éviter.",
        "hint": "Indice méthodologique ou mnémotechnique",
        "tag": "Chapitre / Thème"
      }
    ]
  }
}
\`\`\`
RÈGLES CRUCIALES POUR LES CARTES MÉMOIRES :
- Génère 15 à 20 flashcards riches couvrant toutes les définitions, toutes les formules canoniques, les démonstrations et les zones d'ombre du document.`;

    case 'resume':
      return `FORMAT JSON ATTENDU (MASTERCLASS EXHAUSTIVE EXPLOITANT 100 % DU DOCUMENT) :
\`\`\`json
{
  "decision": "creation",
  "mode": "creation",
  "creation_type": "resume",
  "creation_title": "${title}",
  "chat_response": "Fiche de synthèse prête !",
  "creation_data": {
    "title": "${title}",
    "theme": "${docName}",
    "overview": "Synthèse globale approfondie (3 à 5 paragraphes denses) expliquant la logique générale du cours, les objectifs physiques/mathématiques et le fil conducteur du document.",
    "key_definitions": [
      { "concept": "Nom exact du concept", "definition": "Définition complète, rigoureuse et explication des subtilités", "objective": "Rôle concret et application dans le cours/TD" }
    ],
    "formulas": [
      {
        "name": "Nom officiel de la loi ou fonction de transfert",
        "latex": "T(j\\\\omega) = \\\\dfrac{T_0}{1 + j\\\\dfrac{\\\\omega}{\\\\omega_0}}",
        "target_goal": "Ce que cette formule permet de calculer et sa signification physique",
        "variables": "Détail de chaque variable et son unité SI",
        "when_to_use": "Conditions exactes de validité (zones d'ombre éclaircies)",
        "how_to_derive": "Logique physique et théorème utilisé pour l'établir (ex: pont diviseur, Millman...)",
        "demonstration_steps": ["Étape 1 : ...", "Étape 2 : ...", "Étape 3 : mise sous forme canonique"],
        "exam_trap": "Piège classique d'examen sur cette formule et comment l'éviter"
      }
    ],
    "comparison_table": {
      "headers": ["Type / Montage", "Fonction de transfert canonique", "Comportement BF (ω→0) & HF (ω→∞)", "Propriétés clés", "Piège / Zone d'ombre"],
      "rows": [["Élément 1 du cours", "$$ ... $$", "Comportement aux limites", "Propriétés", "Vigilance"]]
    },
    "traps_and_tips": [
      { "type": "trap", "title": "ZONE D'OMBRE & PIÈGE D'EXAMEN", "content": "Explication détaillée d'une subtilité cachée du document et comment ne pas se tromper." },
      { "type": "tip", "title": "LOGIQUE & ASTUCE DE VÉRIFICATION", "content": "Méthode rapide pour retrouver ou vérifier les formules sans hésiter." }
    ],
    "practical_example": {
      "statement": "Énoncé complet d'un exercice ou cas pratique tiré directement du document (ou de ses TD)",
      "resolution_steps": ["1. Analyse physique et hypothèses...", "2. Pose du théorème directeur et calcul littéral avec \\\\dfrac{}{}...", "3. Identification canonique et conclusion encadrée."]
    },
    "sections": [
      {
        "number": 1,
        "heading": "I. Titre de la Première Partie du Document",
        "body": "Explication magistrale très détaillée et approfondie de toute cette partie du document : logique physique, démonstrations pas à pas avec formules $$ ... $$ et \\\\dfrac{}{}, éclaircissement de toutes les zones d'ombre.",
        "points": ["Point fondamental 1 avec formule", "Point fondamental 2", "Subtilité / Zone d'ombre à maîtriser"]
      }
    ]
  }
}
\`\`\`
RÈGLES CRUCIALES POUR LA FICHE DE RÉSUMÉ / RÉVISION :
- Rédige 5 à 8 grandes sections dans "sections" couvrant l'intégralité du document (cours + TD), 8 à 15 définitions dans "key_definitions", TOUTES les formules du document (6 à 12 formules) dans "formulas" avec leurs étapes de démonstration, un tableau comparatif complet, et 6 à 8 "traps_and_tips" éclaircissant toutes les zones d'ombre.`;

    case 'questionnaire':
    case 'questionnaire-test':
      return `FORMAT JSON ATTENDU :
\`\`\`json
{
  "decision": "creation",
  "mode": "creation",
  "creation_type": "${norm}",
  "creation_title": "${title}",
  "chat_response": "Questionnaire QCM prêt !",
  "creation_data": {
    "questions": [
      {
        "id": "q_1",
        "question": "Énoncé précis et rigoureux de la question (cours, formule en LaTeX $...$, zone d'ombre ou calcul du TD) ?",
        "options": ["Choix A", "Choix B", "Choix C", "Choix D"],
        "correctIndex": 2,
        "correct_index": 2,
        "explanation": "Explication pédagogique complète : démonstration de la formule avec \\\\dfrac{}{}, explication de la logique physique et pourquoi les autres choix sont des pièges."
      }
    ]
  }
}
\`\`\`
RÈGLES CRUCIALES POUR LE QUESTIONNAIRE QCM :
- Génère 15 à 18 questions riches et variées couvrant 100 % du document (définitions, toutes les formules canoniques en LaTeX, logique de démonstration, zones d'ombre/pièges d'examen et exercices/TD du document).
- Répartis aléatoirement "correctIndex" entre 0, 1, 2 et 3.`;

    case 'infographie':
      return `FORMAT JSON ATTENDU :
\`\`\`json
{
  "decision": "creation",
  "mode": "creation",
  "creation_type": "infographie",
  "creation_title": "${title}",
  "chat_response": "Infographie pédagogique prête !",
  "creation_data": {
    "title": "${title}",
    "subtitle": "Synthèse visuelle complète de ${docName}",
    "metrics": [{ "label": "Repère / Formule clé", "value": "Valeur ou relation" }],
    "keyConcepts": [{ "title": "Concept majeur", "desc": "Explication complète avec formule LaTeX et logique" }],
    "steps": [{ "step_number": 1, "title": "Étape logique 1", "description": "Détail méthodologique" }],
    "highlights": [{ "type": "warning", "title": "Zone d'ombre à maîtriser", "text": "Explication précise" }]
  }
}
\`\`\``;

    case 'pdf':
      return `FORMAT JSON ATTENDU :
\`\`\`json
{
  "decision": "creation",
  "mode": "creation",
  "creation_type": "pdf",
  "creation_title": "${title}",
  "chat_response": "Document de cours prêt pour le PDF !",
  "creation_data": {
    "title": "${title}",
    "subtitle": "Polycopié académique complet — ${docName}",
    "sections": [
      {
        "number": 1,
        "heading": "Chapitre I : Fondements, Formules et Démonstrations",
        "title": "Chapitre I : Fondements, Formules et Démonstrations",
        "body": "Développement académique exhaustif du chapitre avec toutes les formules en LaTeX ($$ ... $$ avec \\\\dfrac{}{}), démonstrations et éclaircissement des zones d'ombre.",
        "content": "Développement académique exhaustif du chapitre avec toutes les formules en LaTeX ($$ ... $$ avec \\\\dfrac{}{}), démonstrations et éclaircissement des zones d'ombre.",
        "bulletPoints": ["Point clé 1", "Point clé 2"]
      }
    ]
  }
}
\`\`\``;

    default:
      return `FORMAT JSON ATTENDU :
\`\`\`json
{
  "decision": "creation",
  "mode": "creation",
  "creation_type": "${norm}",
  "creation_title": "${title}",
  "chat_response": "Support prêt !",
  "creation_data": {}
}
\`\`\``;
  }
}

/**
 * Détermine si le message de l'étudiant exprime une véritable INTENTION de créer un support,
 * et NON une simple mention, question, explication ou discussion sur un support existant.
 */
export function hasExplicitCreationIntent(userText: string): boolean {
  if (!userText || typeof userText !== 'string') return false;
  const t = userText.trim().toLowerCase();
  if (!t) return false;

  // 1. Verbes d'action impératifs ou déclaratifs de création explicite
  // Ex: "crée", "génère", "fais-moi", "conçois", "prépare", "fabrique", "construis", "produis", "peux-tu me créer", "je veux créer", "donne-moi"
  const hasStrongCreationCommand = /\b(?:cr[eé][eé]r?|cr[eé]ez|g[eé]n[eé]r(?:er|e|ez)?|fais(?:-moi)?|fait(?:-moi)?|faites(?:-moi)?|con[çc]ois|conception|construi[st]|construisez|fabrique|fabriquer|produi[st]|produisez|pr[eé]pare(?:-moi)?|pr[eé]parez(?:-moi)?|lance(?:-moi)?|lancez(?:-moi)?|r[eé]dige(?:-moi)?|r[eé]digez(?:-moi)?|donne(?:-moi)?|propose(?:-moi)?)\b/i.test(t) ||
    /\b(?:peux-tu|pourrais-tu|merci\s+de)\s+(?:me\s+)?(?:faire|cr[eé]er|g[eé]n[eé]rer|pr[eé]parer|concevoir|construire|fabriquer|produire|sortir|pondre|donner)\b/i.test(t) ||
    /\b(?:je\s+(?:veux|voudrais|souhaite|aimerais)|besoin\s+de)\s+(?:(?:cr[eé]er|g[eé]n[eé]rer|faire|avoir)\s+)?(?:un|une|des|\d+)\b/i.test(t);

  // 2. Formulations courtes directes débutant par une quantité ou un article + support
  // Ex: "2 QCM sur le chapitre", "une carte mentale", "3 flashcards", "un résumé complet", "des QCM"
  const isDirectCreationPhrase = /^(?:un|une|des|\d+|deux|trois|quatre)\s+(?:nouvelles?\s+|autres?\s+)?(?:cartes?\s*mentales?|cartes?\s*conceptuelles?|mind\s*-?maps?|mind\s*maps?|qcms?|q\.?c\.?m\.?|questionnaires?|flashcards?|cartes?\s*m[eé]moires?|r[eé]sum[eé]s?|fiches?\s+de\s+r[eé]visions?|exercices?|devoirs?|vrai\s+ou\s+faux)\b/i.test(t);

  // 3. Questions de discussion, compréhension, correction ou analyse (JAMAIS une création sauf si commande forte de création)
  // Ex: "C'est quoi une carte mentale ?", "Explique la carte mentale", "Dans le QCM pourquoi...", "Je n'ai pas compris le résumé"
  const isDiscussionOrMetaQuery = /^(?:pourquoi|comment|qu['’]est-ce|quand|qui|o[uù]|est-ce\s+que|peux-tu\s+m['’]expliquer|peux-tu\s+m['’]aider|explique|aide-moi\s+[àa]\s+(?:comprendre|r[eé]soudre)|c['’]est\s+quoi|dis-moi|je\s+ne\s+comprends\s+pas|r[eé]sous|d[eé]taille|salut|bonjour|coucou|hello|que\s+penses-tu|donne\s+ton\s+avis|analyse|v[eé]rifie|corrige)\b/i.test(t) ||
    /\b(?:parle(?:-moi)?\s+de|lis\s+(?:la|le)|corrige\s+(?:la|le|mon|ton)|avis\s+sur|que\s+veut\s+dire|signifie|o[uù]\s+est|retrouver|afficher|voir\s+(?:la|le|mon|ton))\b/i.test(t);

  if (isDiscussionOrMetaQuery && !hasStrongCreationCommand) {
    return false;
  }

  return hasStrongCreationCommand || isDirectCreationPhrase;
}

// Détection de tous les formats de création demandés (support multi-agents + héritage de clarification)
export function detectAllCreationFormats(
  userText: string,
  requestedType?: string,
  conversationMessages?: Array<{ sender?: string; text?: string; role?: string; content?: string }>
): AiCreationType[] {
  if (requestedType && typeof requestedType === 'string' && requestedType.trim()) {
    return [normalizeCreationType(requestedType) as AiCreationType];
  }
  const t = (userText || '').trim().toLowerCase();
  if (!t) return [];

  // RÈGLE CARDINALE : Un mot-clé seul ne doit JAMAIS déclencher de création.
  // Seule une véritable INTENTION de création explicite déclenche les agents !
  const hasIntent = hasExplicitCreationIntent(userText);

  // Si l'utilisateur n'a pas formulé d'intention de création directe dans ce message,
  // on vérifie uniquement s'il répond à une demande de précision récente de l'IA (héritage de clarification)
  if (!hasIntent) {
    if (Array.isArray(conversationMessages) && conversationMessages.length >= 2) {
      const nonEmptyMsgs = conversationMessages.filter(m => {
        const txt = String((m as any)?.text || (m as any)?.content || '').trim();
        return txt.length > 0 && !(m as any)?.isError;
      });

      const recentSlice = nonEmptyMsgs.slice(-8);
      const hasRecentClarificationPrompt = recentSlice.some(m => {
        const sender = (m as any)?.sender || (m as any)?.role;
        const txt = String((m as any)?.text || (m as any)?.content || '').trim();
        return (sender === 'ai' || sender === 'assistant') &&
          /\?|quel(?:le)?s?\s+(?:sujet|cours|chapitre|fichier|document|th[èe]me|mat[iî]ère|partie)|pr[eé]cis(?:er|ez)|joindre|s[eé]lectionner|sur\s+quoi|QUESTIONS_SUGG[EÉ]R[EÉ]ES/i.test(txt);
      });

      if (hasRecentClarificationPrompt) {
        for (let i = recentSlice.length - 1; i >= 0; i--) {
          const msgI = recentSlice[i];
          const senderI = (msgI as any)?.sender || (msgI as any)?.role;
          const textI = String((msgI as any)?.text || (msgI as any)?.content || '').trim();
          if (senderI === 'user' && textI && hasExplicitCreationIntent(textI)) {
            const prevFormats = detectAllCreationFormats(textI, undefined, undefined);
            if (prevFormats.length > 0) {
              return prevFormats;
            }
          }
        }
      }
    }
    // Pas d'intention de création : simple discussion de chat, aucun agent ne sera lancé
    return [];
  }

  const matchedEntries: Array<{ type: AiCreationType; index: number; count: number }> = [];

  const extractQuantityBefore = (matchIndex: number): number => {
    // Analyse des 28 caractères précédant immédiatement le début du mot-clé
    const prefix = t.slice(Math.max(0, matchIndex - 28), matchIndex);

    // 1. Si le chiffre est un numéro de liste / énumération (ex: "1.", "2.", "1)", "2)", "1 -", "2 -", "n°1", "n°2"), c'est un rang, JAMAIS une quantité !
    if (/(?:^|[\s\n])(?:\d+|[ivx]+|[a-z])\s*[\.\)\-:]\s*$/i.test(prefix)) {
      return 1;
    }

    // 2. Si le chiffre qualifie un terme générique global (ex: "2 créations :", "2 supports :", "2 formats :", "2 choses :", "2 exemples :"), ce n'est PAS un multiplicateur individuel
    if (/\b(?:\d+|deux|trois|quatre|cinq)\s+(?:cr[eé]ations?|supports?|formats?|choses?|types?|fichiers?|modules?|exemples?)\b/i.test(prefix)) {
      return 1;
    }

    // 3. Correspondance d'un nombre immédiat qualifiant ce format spécifique (ex: "2 ", "deux ", "3 nouveaux ")
    const numMatch = prefix.match(/\b(2|3|4|5|deux|trois|quatre|cinq)\s+(?:petits?\s+|nouveaux?\s+|nouvelles?\s+|autres?\s+)?$/i);
    if (!numMatch) return 1;

    const raw = numMatch[1].toLowerCase();
    if (raw === 'deux' || raw === '2') return 2;
    if (raw === 'trois' || raw === '3') return 3;
    if (raw === 'quatre' || raw === '4') return 4;
    if (raw === 'cinq' || raw === '5') return 5;
    return 1;
  };

  const addFormat = (type: AiCreationType, regex: RegExp) => {
    const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
    let m: RegExpExecArray | null;
    let found = false;

    while ((m = globalRegex.exec(t)) !== null) {
      const idx = m.index;
      const count = extractQuantityBefore(idx);

      // Si le format a déjà été détecté dans ce même message, on évite les doublons accidentels
      const existing = matchedEntries.find(e => e.type === type);
      if (existing) {
        if (count > existing.count) {
          existing.count = count;
        }
      } else {
        matchedEntries.push({
          type,
          index: idx,
          count,
        });
      }
      found = true;
    }
    return found;
  };

  // 1. Vrai ou Faux Test vs Vrai ou Faux (SEULEMENT sur demande explicite, JAMAIS sur simple mot "affirmations")
  if (/\b(?:vrai(?:e?s)?\s*(?:ou|\/|-)\s*faux\s+teste?s?|v\s*\/?\s*f\s+teste?s?|[eé]preuves?\s+vrai(?:e?s)?\s*(?:ou|\/)\s*faux)\b/i.test(t)) {
    addFormat('vrai-ou-faux-test', /\b(?:vrai(?:e?s)?\s*(?:ou|\/|-)\s*faux\s+teste?s?|v\s*\/?\s*f\s+teste?s?|[eé]preuves?\s+vrai(?:e?s)?\s*(?:ou|\/)\s*faux)\b/i);
  } else if (/\b(?:vrai(?:e?s)?\s*(?:ou|\/|-)\s*faux|v\/f|affirmations?\s+vrai(?:e?s)?\s*(?:ou|\/)\s*faux)\b/i.test(t)) {
    addFormat('vrai-ou-faux', /\b(?:vrai(?:e?s)?\s*(?:ou|\/|-)\s*faux|v\/f|affirmations?\s+vrai(?:e?s)?\s*(?:ou|\/)\s*faux)\b/i);
  }

  // 2. Questionnaire Test vs Questionnaire QCM (Détection exhaustive : QCM, QCMs, Quiz, Quizzes, Questionnaires, Choix Multiples)
  if (/\b(?:q[u]?estion+aires?\s+teste?s?|q\.?c\.?m\.?s?\s+teste?s?|quizz?\s+teste?s?|teste?s?\s+not[eé]s?|teste?s?\s+chronos?|[eé]preuves?\s+(?:not[eé]es?|qcm|quizz?))\b/i.test(t)) {
    addFormat('questionnaire-test', /\b(?:q[u]?estion+aires?\s+teste?s?|q\.?c\.?m\.?s?\s+teste?s?|quizz?\s+teste?s?|teste?s?\s+not[eé]s?|teste?s?\s+chronos?|[eé]preuves?\s+(?:not[eé]es?|qcm|quizz?))\b/i);
  } else if (/\b(?:q\.?c\.?m\.?s?|quizz?|quizzes|q[u]?estion+aires?|questions?\s+[àa]\s+choix\s+multiples?|questions?\s+qcm|qcu)\b/i.test(t)) {
    addFormat('questionnaire', /\b(?:q\.?c\.?m\.?s?|quizz?|quizzes|q[u]?estion+aires?|questions?\s+[àa]\s+choix\s+multiples?|questions?\s+qcm|qcu)\b/i);
  }

  // 3. Carte Conceptuelle (carte-mentale-2) vs Carte Mentale arborescente (carte-mentale)
  // Toute demande standard de carte mentale est 'carte-mentale' (jamais étiquetée '2')
  if (/\b(?:cartes?\s*conceptuelle?s?|mind\s*-?\s*maps?\s*conceptuelle?s?|cartes?\s*mentale?s?\s*conceptuelle?s?)\b/i.test(t)) {
    addFormat('carte-mentale-2', /\b(?:cartes?\s*conceptuelle?s?|mind\s*-?\s*maps?\s*conceptuelle?s?|cartes?\s*mentale?s?\s*conceptuelle?s?)\b/i);
  } else if (/\b(?:cartes?\s*mentale?s?|mind\s*-?\s*maps?|mind\s*maps?|arborescences?|sch[eé]mas?\s*heuristiques?)\b/i.test(t)) {
    addFormat('carte-mentale', /\b(?:cartes?\s*mentale?s?|mind\s*-?\s*maps?|mind\s*maps?|arborescences?|sch[eé]mas?\s*heuristiques?)\b/i);
  }

  // 4. Cartes Mémoires / Flashcards
  if (/\b(?:cartes?\s*m[eé]moires?|flash\s*-?\s*cards?|fiches?\s+de\s+m[eé]morisations?|cartes?\s+flash)\b/i.test(t)) {
    addFormat('carte-memoire', /\b(?:cartes?\s*m[eé]moires?|flash\s*-?\s*cards?|fiches?\s+de\s+m[eé]morisations?|cartes?\s+flash)\b/i);
  }

  // 5. Devoir Complet / Examen
  if (/\b(?:devoirs?\s+complets?|sujets?\s+d['’]examens?|[eé]preuves?\s+d['’]examens?|devoirs?\s+d['’]examens?|examens?\s+complets?|examens?\s+blancs?|devoirs?\s+surveill[eé]s?)\b/i.test(t)) {
    addFormat('devoir-complet', /\b(?:devoirs?\s+complets?|sujets?\s+d['’]examens?|[eé]preuves?\s+d['’]examens?|devoirs?\s+d['’]examens?|examens?\s+complets?|examens?\s+blancs?|devoirs?\s+surveill[eé]s?)\b/i);
  }

  // 6. Infographie
  if (/\b(?:infographies?|fiches?\s+visuelles?|posters?\s+p[eé]dagogiques?)\b/i.test(t)) {
    addFormat('infographie', /\b(?:infographies?|fiches?\s+visuelles?|posters?\s+p[eé]dagogiques?)\b/i);
  }

  // 7. Document PDF
  if (/\b(?:documents?\s+pdf|polycopi[eé]s?|polycopies?|g[eé]n[eé]rer\s+un\s+pdf|cr[eé]er\s+un\s+pdf|faire\s+un\s+pdf|export\s+pdf)\b/i.test(t)) {
    addFormat('pdf', /\b(?:documents?\s+pdf|polycopi[eé]s?|polycopies?|export\s+pdf)\b/i);
  }

  // 8. Exercices Écrits
  const hasDevoir = matchedEntries.some(e => e.type === 'devoir-complet');
  if (!hasDevoir) {
    if (/\b(?:exercices?\s+[eé]crits?|exercices?\s+d['’]applications?|s[eé]ries?\s+d['’]exercices?|exos?\s+[eé]crits?)\b/i.test(t)) {
      addFormat('exercices-ecrits', /\b(?:exercices?\s+[eé]crits?|exercices?\s+d['’]applications?|s[eé]ries?\s+d['’]exercices?|exos?\s+[eé]crits?)\b/i);
    } else if (/\b(?:exercices?|exos?)\b/i.test(t) && !/\b(?:exercice|exo)\s+\d+\b/i.test(t)) {
      addFormat('exercices-ecrits', /\b(?:exercices?|exos?)\b/i);
    }
  }

  // 9. Résumé / Synthèse / Fiche de Révision
  if (/\b(?:fiches?\s+de\s+r[eé]visions?|fiches?\s+de\s+r[eé]sum[eé]s?|fiches?\s+de\s+synth[eè]ses?|fiches?\s+de\s+cours|fiches?\s+r[eé]visions?|fiches?\s+synth[eè]ses?)\b/i.test(t)) {
    addFormat('resume', /\b(?:fiches?\s+de\s+r[eé]visions?|fiches?\s+de\s+r[eé]sum[eé]s?|fiches?\s+de\s+synth[eè]ses?|fiches?\s+de\s+cours|fiches?\s+r[eé]visions?|fiches?\s+synth[eè]ses?)\b/i);
  } else if (/\b(?:r[eé]sum[eé]s?|synth[eè]ses?)\b/i.test(t)) {
    addFormat('resume', /\b(?:r[eé]sum[eé]s?|synth[eè]ses?)\b/i);
  }

  // Trier selon l'ordre chronologique d'apparition dans le message de l'étudiant
  matchedEntries.sort((a, b) => a.index - b.index);

  // Déplier les formats détectés en respectant scrupuleusement les quantités
  const detected: AiCreationType[] = [];
  for (const entry of matchedEntries) {
    const qty = Math.min(Math.max(entry.count || 1, 1), 3);
    for (let c = 0; c < qty; c++) {
      detected.push(entry.type);
    }
  }

  if (detected.length === 0 && requestedType && typeof requestedType === 'string' && requestedType.trim()) {
    return [normalizeCreationType(requestedType) as AiCreationType];
  }

  return detected;
}

// Détection du premier format de création demandé (compatibilité ascendante)
function detectCreationFormat(userText: string, requestedType?: string): string | null {
  const all = detectAllCreationFormats(userText, requestedType);
  return all.length > 0 ? all[0] : null;
}


// Détection si l'utilisateur a choisi un document particulier parmi plusieurs ou une synthèse globale
function detectTargetDocumentChoice(text: string, docs: any[]): { isAllDocs: boolean; targetedDoc: any | null } {
  if (!text || !Array.isArray(docs) || docs.length <= 1) return { isAllDocs: false, targetedDoc: null };
  const lower = text.toLowerCase();

  if (
    lower.includes('tous les documents') ||
    lower.includes('tous mes documents') ||
    lower.includes('l\'ensemble des documents') ||
    lower.includes('synthèse transversale') ||
    lower.includes('synthèse globale') ||
    lower.includes('combiner') ||
    lower.includes('combinant tous') ||
    lower.includes('toutes les pièces') ||
    lower.includes('les deux documents') ||
    lower.includes('les 2 documents') ||
    lower.includes('les trois documents') ||
    lower.includes('les 3 documents') ||
    lower.includes('tous les fichiers') ||
    lower.includes('tous mes fichiers') ||
    lower.includes('ensemble des fichiers')
  ) {
    return { isAllDocs: true, targetedDoc: null };
  }

  for (const doc of docs) {
    const rawName = (doc.name || doc.title || '').trim();
    if (!rawName) continue;
    const baseName = rawName.replace(/\.[a-zA-Z0-9]+$/, '').trim();
    if (lower.includes(rawName.toLowerCase()) || (baseName.length >= 3 && lower.includes(baseName.toLowerCase()))) {
      return { isAllDocs: false, targetedDoc: doc };
    }
  }

  return { isAllDocs: false, targetedDoc: null };
}

// Détection si le prompt utilisateur spécifie un vrai sujet d'étude
function detectHasSpecificSubject(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();

  // Phrases des 10 cartes de RightMenu quand aucun document n'est ouvert
  const genericPhrases = [
    'pour tester mes connaissances',
    'des concepts fondamentaux avec branches hiérarchiques',
    'pour réviser et mémoriser les notions clés',
    'avec vue d\'ensemble, points clés, définitions',
    'avec sections, titres et contenu approfondi',
    'avec justifications détaillées et pièges fréquents',
    'avec énoncé pas à pas et correction guidée',
    'avec plusieurs parties, barème de points et corrigé',
    'avec repères visuels, chiffres clés, métriques',
    'pour évaluer mes acquis en conditions réelles',
    'extrais et structure l\'ensemble des',
    'extrais l\'ensemble des',
    'modélisant l\'architecture et les relations',
    'où toutes les réponses sont validées ensemble',
  ];
  for (const gp of genericPhrases) {
    if (t.toLowerCase().includes(gp.toLowerCase())) {
      const m = t.match(/sur\s+«\s*([^»]+)\s*»/i);
      if (m && m[1]?.trim().length > 1) return true;
      return false;
    }
  }

  // Phrases courtes purement génériques ("fais un quiz", etc.)
  const shortGeneric = /^(?:bonjour\s*,?\s*)?(?:s['’]il\s+te\s+pla[îi]t\s*,?\s*)?(?:peux-tu\s+|pourrais-tu\s+|je\s+veux\s+|je\s+voudrais\s+|fais(?:-moi)?\s+|fais\s+|faire\s+|cr[eé]er?\s+|g[eé]n[eé]rer?\s+|conçois\s+|donne-moi\s+|pr[eé]pare\s+|bâtis\s+)?(?:un|une|des)?\s*(?:questionnaire|quiz|qcm|carte\s+mentale|mindmap|cartes?\s+m[eé]moires?|flashcards?|r[eé]sum[eé]|fiche(?:\s+de\s+r[eé]sum[eé])?|document\s+pdf|pdf|polycopi[eé]|vrai\s+ou\s+faux|exercices?(?:\s+[eé]crits?)?|devoir(?:\s+complet)?|examen|infographie|test(?:\s+not[eé])?)\s*(?:s['’]il\s+te\s+pla[îi]t|svp|stp|maintenant|rapide|interactif)?\s*[.!?]?$/i;
  if (shortGeneric.test(t)) {
    return false;
  }

  // Détection de "sur [matière/chapitre]" ou "concernant [notion]" ou "à propos de [notion]"
  const subjectIntro = /\b(?:sur|concernant|portant\s+sur|à\s+propos\s+de|en|d['’]|de)\s+([a-zA-ZÀ-ÿ0-9\s'’-]{3,})/i;
  const match = t.match(subjectIntro);
  if (match) {
    const candidate = match[1].trim().toLowerCase();
    const vaguePhrases = ['mes cours', 'mes connaissances', 'ce cours', 'ce document', 'mon cours', 'mon document', 'la matière', 'mon examen', 'ceci', 'cela', 'ça', 'tout', 'un sujet', 'n\'importe quoi', 'mon niveau'];
    if (!vaguePhrases.includes(candidate) && candidate.length >= 3) {
      return true;
    }
  }

  // Présence de vocabulaire disciplinaire
  const academicTerms = /(math|physique|chimie|svt|biologie|histoire|g[eé]o|droit|économie|gestion|informatique|python|algorithme|code|philosophie|fran[çc]ais|anglais|espagnol|litt[eé]rature|m[eé]canique|optique|thermo|quantique|cellule|mitose|adn|r[eé]action|mol[eé]cule|atome|fonction|d[eé]riv[eé]|int[eé]gral|matrice|vecteur|th[eé]or[eè]me|loi|article|constitution|programme|base\s+de\s+donn[eé]es|sql|r[eé]seau|circuit|aop|courant|tension)/i;
  if (t.length > 30 && academicTerms.test(t)) {
    return true;
  }

  return false;
}

// Détection si la discussion récente porte sur un vrai sujet d'étude
function hasRecentAcademicContext(messages: Array<{ sender: string; text: string }>): boolean {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  const recent = messages.slice(-6);
  for (const m of recent) {
    const text = (m.text || '').trim();
    if (text.length < 25) continue;
    if (/^(bonjour|salut|hello|coucou|merci|de rien|au revoir|comment vas-tu|qui es-tu)/i.test(text) && text.length < 50) {
      continue;
    }
    if (text.includes('$') || text.includes('\\') || text.length > 70) {
      return true;
    }
    if (/(math|physique|chimie|svt|biologie|histoire|droit|économie|informatique|algorithme|cours|chapitre|formule|exercice|problème|théorème)/i.test(text)) {
      return true;
    }
  }
  return false;
}

function extractSuggestedQuestions(content: string): { cleanText: string; questions: string[] } {
  const questions: string[] = [];
  let cleanText = content;

  const markerRegex = /(?:\[QUESTIONS_SUGG[EÉ]R[EÉ]ES\]|###\s*(?:Questions|Pistes)\s*(?:d['’]approfondissement|sugg[eé]r[eé]es|de\s*r[eé]flexion))([\s\S]*?)$/i;
  const match = cleanText.match(markerRegex);

  if (match) {
    const questionsBlock = match[1];
    cleanText = cleanText.replace(markerRegex, '').trim();

    const qLines = questionsBlock.split('\n');
    for (const line of qLines) {
      const qClean = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
      const isContinuationPhrase = /(?:calcul\s+est\s+vaste|voulez-vous\s+que\s+je\s+continue|souhaitez-vous\s+la\s+suite|continuer\s+avec\s+la\s+suite|continuer\s*\?)/i.test(qClean);
      if (qClean && qClean.length > 5 && !isContinuationPhrase && !qClean.toLowerCase().startsWith('cliquez') && !qClean.toLowerCase().startsWith('vous pouvez')) {
        questions.push(qClean);
      }
    }
  }

  return { cleanText, questions };
}

function SvgDiagramCard({ svgContent }: { svgContent: string; key?: any }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(svgContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `schema_studycloud_${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Erreur téléchargement SVG:', e);
    }
  };

  return (
    <div className="my-4 rounded-2xl bg-[#0f1118] border border-orange-500/35 shadow-xl overflow-hidden w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#171922] border-b border-zinc-800 text-xs">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-orange-400" />
          <span className="font-bold text-white tracking-wide">Schéma technique & Illustration</span>
          <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 font-semibold text-[10px]">
            Dessiné par l'IA
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Copier le code SVG"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Télécharger l'image vectorielle SVG"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div
        className="p-4 sm:p-6 overflow-x-auto custom-scrollbar flex items-center justify-center [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:mx-auto"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}

const ChatMessageText = ({
  text,
  isUser,
  isStreaming,
  onSelectSuggestion
}: {
  text: string;
  isUser: boolean;
  isStreaming?: boolean;
  onSelectSuggestion?: (question: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  const maxUserPromptLength = 350;
  const isLongUserMsg = isUser && text.length > maxUserPromptLength;
  const displayText = isLongUserMsg && !expanded ? text.slice(0, maxUserPromptLength) + '...' : text;

  if (isUser) {
    return (
      <div className="flex flex-col w-full items-end select-text chat-selectable cursor-text">
        <p className="whitespace-pre-wrap break-words text-left w-full select-text chat-selectable cursor-text">
          {displayText}
        </p>
        {isLongUserMsg && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-1.5 text-[10px] font-bold underline transition-colors cursor-pointer text-orange-200 hover:text-white"
          >
            {expanded ? 'Masquer' : 'Démasquer'}
          </button>
        )}
      </div>
    );
  }

  // 1. Extraction préalable des questions suggérées et des blocs SVG
  const { textWithoutQuestions, suggestedQuestions } = useMemo(() => {
    if (isUser || !displayText) return { textWithoutQuestions: displayText, suggestedQuestions: [] };
    const res = extractSuggestedQuestions(displayText);
    return { textWithoutQuestions: res.cleanText, suggestedQuestions: res.questions };
  }, [displayText, isUser]);

  const { textWithoutSvg, svgBlocks } = useMemo(() => {
    if (isUser || !textWithoutQuestions) return { textWithoutSvg: textWithoutQuestions, svgBlocks: [] };
    const res = extractSvgBlocks(textWithoutQuestions);
    return { textWithoutSvg: res.cleanText, svgBlocks: res.svgBlocks };
  }, [textWithoutQuestions, isUser]);

  // 2. Normalisation préalable pour KaTeX et nettoyage des résidus JSON
  const normalizedDisplayText = useMemo(() => {
    if (!textWithoutSvg) return '';
    let cleaned = textWithoutSvg;
    if (!isUser) {
      cleaned = stripAiReasoningScratchpad(cleaned);
      if (
        cleaned.includes('"decision"') ||
        cleaned.includes('"creation_data"') ||
        cleaned.includes('```json') ||
        cleaned.includes('"connecteurs"') ||
        cleaned.includes('"noeud_central"') ||
        cleaned.includes('"columns"') ||
        cleaned.includes('"branches"') ||
        cleaned.includes('"questions"') ||
        cleaned.includes('"affirmations"') ||
        (cleaned.includes('{') && cleaned.includes('":'))
      ) {
        cleaned = cleanChatText(cleaned);
        if (!cleaned) {
          cleaned = "✨ Votre création a été générée avec succès dans le volet Création à droite.";
        }
      }
    }
    cleaned = cleaned
      .replace(/\${3,}/g, '$$')
      .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
      .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

    // Isoler TOUJOURS les équations en bloc $$ ... $$ sur leur propre ligne avec sauts doubles
    // pour garantir un rendu aéré, clair et lisible sans jamais se coller au texte
    cleaned = cleaned.replace(/\$\$([\s\S]*?)\$\$/g, (_match, eq) => {
      const cleanEq = eq.replace(/\r?\n/g, ' ').trim();
      return `\n\n$$${cleanEq}$$\n\n`;
    });

    // Aérer et décoller les étapes de calculs collées sur une même ligne
    if (!isUser) {
      cleaned = cleaned
        .replace(/([.;?!])\s*(\b(?:Num[eé]rateur|D[eé]nominateur|Numerator|Denominator|Ratio|Posons|Soit|On a|En rempla[çc]ant|D'o[ùu]|Par cons[eé]quent|Pour la question|Question \d+|[EÉ]tape \d+)\b)/gi, '$1\n\n$2')
        .replace(/([.;])\s*(Noeud\s+[A-Z0-9]+|L'équation|Equation|Soit\b|Or\b|Donc\b|On a\b|En substituant|A substituer|D'après)\b/gi, '$1\n\n$2')
        .replace(/(?<!\n)\s*(=>|\\Rightarrow|⟹)\s*/g, '\n\n$1 ')
        .replace(/\n{3,}/g, '\n\n');
    }

    return cleaned;
  }, [textWithoutSvg, isUser]);

  const lines = normalizedDisplayText.split('\n');

  return (
    <div className="flex flex-col w-full items-start select-text chat-selectable cursor-text">
      <div className="space-y-2 text-zinc-100 text-left w-full leading-[1.8] font-normal text-[15px] sm:text-[16px] md:text-[17px] [&_.katex]:text-[1.12em] [&_.katex-display]:text-[1.25em] select-text chat-selectable cursor-text">
        {lines.map((line, idx) => {
          const isLastLine = idx === lines.length - 1;
          const trimmed = line.trim();

          // Espacement aéré pour les lignes vides (évite que tout soit groupé)
          if (!trimmed) {
            return <div key={idx} className="h-3.5 sm:h-4 w-full" aria-hidden="true" />;
          }

          // Détection d'un bloc SVG à insérer
          const svgTokenMatch = trimmed.match(/^__STUDYCLOUD_SVG_BLOCK_(\d+)__$/);
          if (svgTokenMatch) {
            const svgIndex = parseInt(svgTokenMatch[1], 10);
            if (svgBlocks[svgIndex]) {
              return <SvgDiagramCard key={idx} svgContent={svgBlocks[svgIndex]} />;
            }
            return null;
          }

          // Détection d'une carte de recommandation interactive (ex: Recommandé : flashcards)
          const recoMatch = trimmed.match(/^(?:\[?💡?\s*Recommand[ée]\s*:\s*([a-zA-ZÀ-ÿ\s]+)\]?)/i);
          if (recoMatch) {
            return <ChatRecommendationCard key={idx} recoType={recoMatch[1]} />;
          }

          // Grand Titre principal (H1) avec dégradé et icône lumineuse
          if (trimmed.startsWith('# ')) {
            return (
              <div key={idx} className="pt-5 pb-2.5 mt-3 mb-2 border-b border-orange-500/25 w-full">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-200 flex items-center gap-2.5">
                  <span className="p-1 rounded-lg bg-orange-500/10 text-orange-400 text-sm">✦</span>
                  <MathText text={trimmed.slice(2)} inline={true} />
                </h1>
              </div>
            );
          }

          // Titre de section ou question (H2) avec bande latérale orange
          if (trimmed.startsWith('## ')) {
            return (
              <div key={idx} className="pt-4 pb-2 mt-3 mb-1.5 w-full">
                <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2.5 border-l-4 border-orange-500 pl-3 py-1 bg-gradient-to-r from-orange-500/10 to-transparent rounded-r-xl">
                  <MathText text={trimmed.slice(3)} inline={true} />
                </h2>
              </div>
            );
          }

          // Sous-titre (H3)
          if (trimmed.startsWith('### ')) {
            return (
              <div key={idx} className="pt-2.5 pb-1 mt-2 mb-1 w-full">
                <h3 className="text-base font-bold text-amber-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                  <MathText text={trimmed.slice(4)} inline={true} />
                </h3>
              </div>
            );
          }

          // Commentaires & Remarques (ne doivent JAMAIS être confondus avec des explications ou calculs)
          const commentMatch = trimmed.match(/^(?:>\s*)?(?:\*\*)?(Remarque|Note|Astuce|Attention|Observation|Conseil|Point clé|Rappel)(?:\s+[^:]*?)?(?:\*\*)?\s*[:.-]\s*(.*)$/i) || (trimmed.startsWith('> ') ? [null, 'Remarque', trimmed.slice(2).trim()] : null);
          if (commentMatch) {
            const commentLabel = commentMatch[1] || 'Remarque méthodologique';
            const commentBody = commentMatch[2] || '';
            return (
              <div key={idx} className="my-3 p-3.5 sm:p-4 rounded-2xl bg-sky-950/25 border-l-4 border-sky-400 text-sky-100 shadow-sm w-full">
                <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-sky-300">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="uppercase tracking-wider">{commentLabel}</span>
                </div>
                <div className="text-[14px] sm:text-[15px] md:text-[16px] text-sky-100/90 leading-relaxed font-normal italic">
                  <MathText text={commentBody} inline={true} />
                </div>
              </div>
            );
          }

          // Détection d'une Question, Étape ou Exercice -> Carte stylée avec badge
          const stepMatch = trimmed.match(/^(Question\s*\d+|[EÉ]tape\s*\d+|Exercice\s*\d+|Partie\s*[A-Z0-9]+)\s*[:.-]?\s*(.*)$/i);
          if (stepMatch) {
            return (
              <div key={idx} className="my-3 p-3.5 rounded-xl bg-[#1a1c26] border border-orange-500/30 shadow-md w-full">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-black uppercase tracking-wider bg-orange-500 text-black shadow-sm">
                    {stepMatch[1]}
                  </span>
                </div>
                {stepMatch[2] ? (
                  <div className="text-sm sm:text-base font-semibold text-zinc-100 mt-1">
                    <MathText text={stepMatch[2]} inline={true} />
                  </div>
                ) : null}
              </div>
            );
          }

          // Formule bloc isolée ($$ ... $$) -> Encadré mathématique dédié centré
          if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
            return (
              <div key={idx} className="my-3.5 py-3.5 px-4 rounded-2xl bg-[#13151f] border border-zinc-700/60 shadow-inner text-center overflow-x-auto custom-scrollbar w-full">
                <MathText text={trimmed} inline={false} />
              </div>
            );
          }

          // Mise en valeur des conclusions ou déductions (Donc :, Conclusion :, etc.)
          if (/^(Donc|Conclusion|Résultat final|On en déduit|En conclusion)\s*[:.-]/i.test(trimmed)) {
            return (
              <div key={idx} className="my-2.5 p-3 rounded-xl bg-amber-500/10 border-l-4 border-amber-400 text-zinc-100 font-medium">
                <MathText text={line} inline={true} />
              </div>
            );
          }

          // Alinéas pour sous-questions et étapes indentées (ex: a), b), 1), 2), i.)
          const alineaMatch = trimmed.match(/^(?:([a-zA-Z]|\d+|[ivxIVX]+)\)\s+)(.*)$/);
          if (alineaMatch) {
            return (
              <div key={idx} className="ml-3 sm:ml-7 pl-3.5 border-l-2 border-orange-500/40 my-2.5 bg-white/[0.02] rounded-r-xl py-2 flex items-start gap-2.5 w-full">
                <span className="px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-400 font-bold text-xs shrink-0 select-none">
                  {alineaMatch[1]})
                </span>
                <div className="flex-1 text-zinc-100 leading-relaxed text-[15px] sm:text-[16px] md:text-[17px]">
                  <MathText text={alineaMatch[2]} inline={true} />
                </div>
              </div>
            );
          }

          // Puces de listes avec losange doré et espacement aéré
          const bulletMatch = trimmed.match(/^([-*•])\s+(.*)$/);
          if (bulletMatch) {
            return (
              <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-2 leading-relaxed">
                <span className="text-orange-400 mt-1 select-none text-xs">◆</span>
                <div className="flex-1">
                  <MathText text={bulletMatch[2]} inline={true} />
                </div>
              </div>
            );
          }

          // Ligne normale avec KaTeX
          return (
            <div key={idx} className="whitespace-pre-wrap break-words leading-relaxed text-zinc-200 select-text chat-selectable cursor-text">
              <MathText text={line} inline={true} />
            </div>
          );
        })}
      </div>

      {/* Propositions de questions sous forme de boutons carrés (décidé par l'IA) */}
      {!isStreaming && suggestedQuestions.length > 0 && (
        <div className="mt-6 pt-4 border-t border-zinc-800/80 w-full animate-fadeIn">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-orange-300">
              Pistes & Questions d'approfondissement proposées
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
            {suggestedQuestions.map((q, qIdx) => (
              <button
                key={qIdx}
                type="button"
                onClick={() => onSelectSuggestion?.(q)}
                className="group relative p-4 rounded-2xl bg-[#1b1d25] hover:bg-[#252834] border border-zinc-700/80 hover:border-orange-500/60 shadow-md hover:shadow-orange-500/10 transition-all duration-200 cursor-pointer flex flex-col justify-between text-left active:scale-[0.98] min-h-[110px]"
              >
                <div className="flex items-start justify-between gap-2 mb-2 w-full">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-black">
                    {qIdx + 1}
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                </div>
                <div className="text-xs sm:text-sm font-semibold text-zinc-100 group-hover:text-white leading-snug my-1 line-clamp-3">
                  <MathText text={q} inline={true} />
                </div>
                <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] font-bold text-orange-400/90 group-hover:text-orange-400">
                  <span>Poser cette question</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Générateur de messages d'accueil spontanés et chaleureux envoyés en direct par l'IA
function getSpontaneousAiGreeting(modelName: string, activeDocName?: string | null): { title: string; subtitle: string } {
  const hour = new Date().getHours();
  const timeGreeting = hour >= 5 && hour < 12 ? 'Bonjour !' : hour >= 18 ? 'Bonsoir !' : 'Salut !';

  const friendlyTitles = [
    "Comment vas-tu aujourd'hui ?",
    "On fait quoi aujourd'hui ?",
    "Ravi de te retrouver ! Qu'est-ce qu'on étudie ensemble ?",
    `${timeGreeting} Prêt à progresser aujourd'hui ?`,
    "Comment se passe ta journée d'étude ?",
    "Je suis là pour toi. Sur quoi souhaites-tu travailler ?",
    "Dis-moi tout, sur quel sujet veux-tu avancer ?",
    "Une question, un exercice ou une notion à explorer ?",
    "Prêt pour une bonne session d'apprentissage ?",
    "Hello ! Quel défi académique relève-t-on ensemble ?",
    "Je suis à ton écoute, par quoi commence-t-on ?",
    "Besoin d'un coup de pouce sur tes cours aujourd'hui ?",
    "Je suis prêt ! Qu'aimerais-tu découvrir ou réviser ?"
  ];

  let subtitles: string[] = [];
  if (activeDocName) {
    subtitles = [
      `Je suis prêt à analyser « ${activeDocName} » avec toi.`,
      `On explore « ${activeDocName} » ensemble ? Pose-moi toutes tes questions.`,
      `Pose ta question sur « ${activeDocName} » ou demande un résumé clair.`,
      `Dis-moi ce que tu souhaites comprendre ou approfondir dans « ${activeDocName} ».`
    ];
  } else {
    subtitles = [
      "Pose ta question, colle ton cours ou explore tes documents.",
      "Je t'accompagne pas à pas pour comprendre et réussir tes cours.",
      "Demande-moi des explications, des résumés ou de l'aide sur tes exercices.",
      "Pose n'importe quelle question, avance à ton propre rythme.",
      "Colle un exercice difficile ou une notion floue, on débloque ça ensemble.",
      "Synthèses, fiches de révision ou quiz : dis-moi ce dont tu as besoin."
    ];
  }

  const title = friendlyTitles[Math.floor(Math.random() * friendlyTitles.length)];
  const subtitle = subtitles[Math.floor(Math.random() * subtitles.length)];

  return { title, subtitle };
}

function formatCreationsSummaryForPrompt(creations: AiCreation[]): string {
  if (!Array.isArray(creations) || creations.length === 0) {
    return "Aucune création précédente n'a été générée dans cette conversation.";
  }

  const sections: string[] = [];

  creations.slice(0, 10).forEach((cr, index) => {
    const num = index + 1;
    const typeLabel = cr.toolType || 'Module';
    const title = cr.title || 'Sans titre';
    const dateStr = cr.createdAt ? new Date(cr.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const content = cr.content;

    let itemsSummary = '';

    if (content) {
      // 1. Questionnaires / QCM / Quiz
      const questions = Array.isArray(content)
        ? content
        : (Array.isArray(content.questions) ? content.questions : null);

      if (questions && questions.length > 0) {
        const qList = questions.slice(0, 15).map((q: any, qIdx: number) => {
          const qText = q.question || q.title || q.text || `Question ${qIdx + 1}`;
          const qAns = typeof q.answerIndex === 'number' && Array.isArray(q.options)
            ? ` [Réponse: ${q.options[q.answerIndex] || ''}]`
            : (typeof q.correctIndex === 'number' && Array.isArray(q.options)
              ? ` [Réponse: ${q.options[q.correctIndex] || ''}]`
              : '');
          return `     - Q${qIdx + 1} : "${qText}"${qAns}`;
        }).join('\n');
        itemsSummary = `   Questions déjà posées (${questions.length} au total) :\n${qList}`;
      }

      // 2. Vrai ou Faux
      const affirmations = Array.isArray(content.affirmations)
        ? content.affirmations
        : (Array.isArray(content) && content[0]?.statement ? content : null);

      if (!itemsSummary && affirmations && affirmations.length > 0) {
        const affList = affirmations.slice(0, 15).map((a: any, aIdx: number) => {
          const stmt = a.statement || a.text || a.question || `Affirmation ${aIdx + 1}`;
          const truth = a.isTrue !== undefined ? (a.isTrue ? '[VRAI]' : '[FAUX]') : '';
          return `     - Affirmation ${aIdx + 1} : "${stmt}" ${truth}`;
        }).join('\n');
        itemsSummary = `   Affirmations déjà traitées (${affirmations.length} au total) :\n${affList}`;
      }

      // 3. Flashcards / Cartes mémoires
      const flashcards = Array.isArray(content.flashcards)
        ? content.flashcards
        : (Array.isArray(content.cards) ? content.cards : (Array.isArray(content) && content[0]?.front ? content : null));

      if (!itemsSummary && flashcards && flashcards.length > 0) {
        const fcList = flashcards.slice(0, 15).map((fc: any, fcIdx: number) => {
          const front = fc.front || fc.term || fc.question || `Carte ${fcIdx + 1}`;
          const back = fc.back || fc.definition || '';
          const shortBack = back.length > 80 ? back.slice(0, 80) + '...' : back;
          return `     - Notion ${fcIdx + 1} : "${front}" -> "${shortBack}"`;
        }).join('\n');
        itemsSummary = `   Notions et cartes mémoires déjà définies (${flashcards.length} au total) :\n${fcList}`;
      }

      // 4. Cartes Mentales
      if (!itemsSummary && (typeLabel.includes('carte-mentale') || typeLabel.includes('mindmap') || content.root || content.branches)) {
        const rootLabel = content.root?.label || content.root_title || content.label || title;
        const branchLabels: string[] = [];
        const extractBranches = (node: any, depth = 0) => {
          if (!node || depth > 2) return;
          if (node.label && depth > 0) branchLabels.push(node.label);
          if (Array.isArray(node.children)) {
            node.children.forEach((c: any) => extractBranches(c, depth + 1));
          }
        };
        if (content.root) extractBranches(content.root);
        else if (Array.isArray(content.children)) content.children.forEach((c: any) => extractBranches(c, 1));

        itemsSummary = `   Arborescence explorée : Thème central "${rootLabel}" | Branches principales : ${branchLabels.slice(0, 12).join(', ') || 'Nœuds généraux'}`;
      }

      // 5. Résumés / Fiches de synthèse
      if (!itemsSummary && (typeLabel.includes('resume') || typeLabel.includes('summary') || content.overview || content.key_definitions)) {
        const defs = (Array.isArray(content.key_definitions) ? content.key_definitions : (Array.isArray(content.definitions) ? content.definitions : []))
          .map((d: any) => d.concept || d.term || d.name).filter(Boolean);
        const forms = (Array.isArray(content.formulas) ? content.formulas : [])
          .map((f: any) => f.name || f.latex).filter(Boolean);
        const secs = (Array.isArray(content.sections) ? content.sections : [])
          .map((s: any) => s.heading || s.title).filter(Boolean);

        const summaryParts: string[] = [];
        if (content.overview) summaryParts.push(`Synthèse : "${content.overview.slice(0, 120)}..."`);
        if (defs.length > 0) summaryParts.push(`Concepts définis : ${defs.slice(0, 10).join(', ')}`);
        if (forms.length > 0) summaryParts.push(`Formules clés : ${forms.slice(0, 8).join(', ')}`);
        if (secs.length > 0) summaryParts.push(`Sections : ${secs.slice(0, 6).join(', ')}`);

        itemsSummary = `   Points abordés dans la fiche :\n${summaryParts.map(p => `     - ${p}`).join('\n')}`;
      }

      // 6. Exercices Écrits / Devoirs
      const exercises = Array.isArray(content.questions)
        ? content.questions
        : (Array.isArray(content.exercises) ? content.exercises : null);

      if (!itemsSummary && exercises && exercises.length > 0 && (typeLabel.includes('exercice') || typeLabel.includes('devoir'))) {
        const exList = exercises.slice(0, 10).map((ex: any, exIdx: number) => {
          const exText = ex.text || ex.question || ex.statement || ex.title || `Exercice ${exIdx + 1}`;
          return `     - Exercice ${exIdx + 1} : "${exText.slice(0, 120)}"`;
        }).join('\n');
        itemsSummary = `   Exercices déjà générés :\n${exList}`;
      }

      // 7. Documents PDF / Poly
      if (!itemsSummary && (typeLabel === 'pdf' || content.chapters || content.sections)) {
        const chaps = (Array.isArray(content.chapters) ? content.chapters : (Array.isArray(content.sections) ? content.sections : []))
          .map((ch: any) => ch.title || ch.heading).filter(Boolean);
        if (chaps.length > 0) {
          itemsSummary = `   Chapitres/Parties abordées : ${chaps.join(', ')}`;
        }
      }
    }

    sections.push(`[CRÉATION #${num} - Type: ${typeLabel.toUpperCase()} | Titre: "${title}"${dateStr ? ` | ${dateStr}` : ''}]
${itemsSummary || '   Contenu général déjà synthétisé.'}`);
  });

  return sections.join('\n\n');
}

export interface AssistantChatProps {
  onClose: () => void;
  onHasMessagesChange?: (has: boolean) => void;
  activePreviewItem?: any;
  attachedResources?: any[];
  setAttachedResources?: any;
  key?: React.Key;
}

export function AssistantChat({ onClose, onHasMessagesChange, activePreviewItem, attachedResources = [], setAttachedResources }: AssistantChatProps) {
  // Document actif à l'écran (Orange) : prop direct uniquement (ZÉRO restauration locale pour éviter toute rémanence)
  const resolvedActiveItem = activePreviewItem || null;
  const resolvedActiveName = resolvedActiveItem?.name || resolvedActiveItem?.title || resolvedActiveItem?.fileName || undefined;

  const currentUserId = typeof window !== 'undefined'
    ? (safeGetItem('unifolder_user_id') || safeGetItem('studycloud_user_id') || 'default-user')
    : 'default-user';

  // Session courante (Style Gemini)
  const [currentConversationId, setCurrentConversationId] = useState<string>(() => {
    const saved = safeGetItem('studycloud_current_conversation_id');
    if (saved && !saved.startsWith('creation-')) return saved;
    const newId = 'conv-' + Date.now();
    safeSetItem('studycloud_current_conversation_id', newId);
    return newId;
  });
  const [currentConversationTitle, setCurrentConversationTitle] = useState<string>('Nouvelle discussion');

  // Tiroir Historique Gemini
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  const [messages, setMessages] = useState<Message[]>(() => {
    const savedId = safeGetItem('studycloud_current_conversation_id');
    if (savedId && !savedId.startsWith('creation-')) {
      const local = safeGetItem(`studycloud_conv_msgs_${savedId}`);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed
              .filter((m: any) => !(m.sender === 'ai' && (!m.text || !String(m.text).trim()) && !m.isError))
              .map((m: any) => ({ ...m, isStreaming: false }));
          }
        } catch { }
      }
    }
    return [];
  });
  const [inputValue, setInputValue] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [openCreditsMsgIds, setOpenCreditsMsgIds] = useState<Set<string>>(new Set());

  const toggleCreditsVisibility = (msgId: string) => {
    setOpenCreditsMsgIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  const [tokensPerCredit, setTokensPerCredit] = useState<number>(() => getActiveTokensPerCredit());

  useEffect(() => {
    // Synchronisation immédiate du ratio tokens <-> crédits avec la base Cloudflare D1
    getAiBillingConfig().then(res => {
      if (res && res.success && res.config?.tokens_per_credit) {
        setTokensPerCredit(Number(res.config.tokens_per_credit));
      }
    }).catch(() => { });

    const handleConfigUpdate = (e: any) => {
      if (e.detail?.tokens_per_credit) {
        setTokensPerCredit(Number(e.detail.tokens_per_credit));
      }
    };
    window.addEventListener('studycloud_billing_config_updated', handleConfigUpdate);
    return () => window.removeEventListener('studycloud_billing_config_updated', handleConfigUpdate);
  }, []);

  const [isCreditInsufficient, setIsCreditInsufficient] = useState<boolean>(false);

  useEffect(() => {
    const handleInsufficientCredits = () => {
      setIsCreditInsufficient(true);
    };
    const handleCreditsUpdated = (e: any) => {
      if (typeof e.detail?.remaining_balance === 'number') {
        setIsCreditInsufficient(e.detail.remaining_balance <= 0);
      }
    };
    window.addEventListener('studycloud_insufficient_credits', handleInsufficientCredits);
    window.addEventListener('studycloud_user_credits_updated', handleCreditsUpdated);

    // Contrôle initial du solde de crédits
    const uid = currentUserId || (typeof window !== 'undefined' ? localStorage.getItem('unifolder_user_id') : null);
    if (uid && uid !== 'default-user') {
      getUserAiCreditsLive(uid).then(res => {
        if (res && res.credits) {
          const bal = Number(res.credits.balance ?? (res.credits as any).credits_balance ?? 0);
          setIsCreditInsufficient(bal <= 0);
        }
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('studycloud_insufficient_credits', handleInsufficientCredits);
      window.removeEventListener('studycloud_user_credits_updated', handleCreditsUpdated);
    };
  }, [currentUserId]);

  const handleOpenAiSubscriptions = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studycloud_open_ai_subscriptions'));
    }
  };

  const getMessageTokens = (msg: Message): number => {
    if (typeof msg.tokens === 'number' && msg.tokens > 0) return msg.tokens;
    if (typeof (msg as any).usage?.totalTokens === 'number' && (msg as any).usage.totalTokens > 0) return (msg as any).usage.totalTokens;
    if (typeof (msg as any).metadata?.tokens === 'number' && (msg as any).metadata.tokens > 0) return (msg as any).metadata.tokens;
    if (typeof msg.credits === 'number' && msg.credits > 20) return msg.credits;

    // Estimation proportionnelle réaliste au volume textuel (entrées + sorties)
    const textLen = (msg.text || '').length;
    return Math.max(55, Math.ceil(textLen / 3.8));
  };

  const getMessageCreditsDisplay = (msg: Message): string => {
    const rawTokens = getMessageTokens(msg);
    // Si des crédits réels explicites ont été déduits par le serveur
    if (typeof (msg as any).credits_deducted === 'number' && (msg as any).credits_deducted > 0) {
      const val = (msg as any).credits_deducted;
      const fmt = val.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
      return `${fmt} ${val <= 1 ? 'crédit' : 'crédits'}`;
    }
    // Si msg.credits est déjà un crédit calculé distinct des tokens
    if (typeof msg.credits === 'number' && msg.credits > 0 && msg.credits < (msg.tokens || Infinity) && msg.credits < 30) {
      const val = msg.credits;
      const fmt = val.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
      return `${fmt} ${val <= 1 ? 'crédit' : 'crédits'}`;
    }
    // Sinon, convertir directement les tokens en crédits selon le paramètre D1 du tableau de bord
    return formatConsumedCreditsDisplay(rawTokens, tokensPerCredit);
  };

  const [isTyping, setIsTyping] = useState(false);
  const [isWaitingServer, setIsWaitingServer] = useState(false);
  const isChatRequestInFlightRef = useRef<boolean>(false);
  const lastSendTimeRef = useRef<number>(0);
  const lastSendTextRef = useRef<string>('');
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [aiActivityText, setAiActivityText] = useState<string>('Je réfléchis...');
  const activityTimerRef = useRef<any>(null);
  // Cache de signature des médias analysés par session de discussion (évite de ré-extraire et ré-envoyer 20 Mo à chaque question)
  const analyzedMediaPerConvRef = useRef<Record<string, string>>({});
  const cachedDocumentTextRef = useRef<Record<string, string>>({});
  const cachedPerceptionReportsRef = useRef<Record<string, string>>({});
  // Barre de propositions collée au clavier
  const [showProposalBar, setShowProposalBar] = useState(true);

  // Création active suivie pour modification et itération continue
  const [activeCreation, setActiveCreation] = useState<AiCreation | null>(null);

  // Mémoire des créations générées et enregistrées pour CETTE session de conversation uniquement
  const [sessionCreations, setSessionCreations] = useState<AiCreation[]>(() => {
    const savedId = safeGetItem('studycloud_current_conversation_id');
    if (savedId && !savedId.startsWith('creation-')) {
      const local = safeGetItem(`studycloud_conv_creations_${savedId}`);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch { }
      }
      try {
        const genCache = safeGetItem('studycloud_saved_creations_cache');
        if (genCache) {
          const list = JSON.parse(genCache);
          if (Array.isArray(list)) {
            const filtered = list.filter((c: any) => c.conversationId === savedId);
            if (filtered.length > 0) return filtered;
          }
        }
      } catch { }
    }
    return [];
  });

  // Cache des modèles IA actifs pour éviter tout clignotement / disparition à l'écran
  const getCachedActiveModels = (): Array<{ id: string; name: string; nickname?: string; rawName?: string; provider: string; model_id?: string }> => {
    try {
      const raw = safeGetItem('studycloud_active_ai_models_v2', '');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => ({
            ...m,
            name: stripWorkerAi(m.nickname || m.name || m.id),
            nickname: stripWorkerAi(m.nickname || ''),
            rawName: stripWorkerAi(m.rawName || m.name || m.id)
          }));
        }
      }
    } catch (e) { }
    return [];
  };

  // Vérifie si le modèle est le Chef d'équipe désigné (Agent Delmas / Llama 3.3 70B) doté de capacités multi-agents
  const isChefModelId = (id?: string): boolean => {
    if (!id) return true;
    const m = id.toLowerCase();
    return (
      m.includes('llama-3.3') ||
      m.includes('llama') ||
      m.includes('delmas') ||
      m === 'default' ||
      m.includes('chef') ||
      m.includes('multi-ia') ||
      m.includes('multi-agent')
    );
  };

  // Modèles IA actifs uniquement (aucun modèle désactivé n'apparaît même brièvement)
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; nickname?: string; rawName?: string; provider: string; model_id?: string }>>(() => getCachedActiveModels());
  const [isModelsLoading, setIsModelsLoading] = useState<boolean>(() => getCachedActiveModels().length === 0);

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const cached = safeGetItem('studycloud_selected_ai_model', 'gemini-2.0-flash');
    return (cached === 'gemini-3.8-flash' || cached === 'gemini-2.5-flash') ? 'gemini-2.0-flash' : cached;
  });

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    safeSetItem('studycloud_selected_ai_model', selectedModel);
  }, [selectedModel]);

  // Fermer le dropdown des modèles au clic en dehors
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isModelDropdownOpen]);

  // Chargement dynamique des modèles configurés (seuls les modèles activés sont conservés)
  useEffect(() => {
    StudyCloudAPI.getRobotRougeConfig()
      .then((res: any) => {
        if (res && res.success && Array.isArray(res.models)) {
          // Filtrer strictement les modèles actifs (exclut immédiatement les modèles désactivés)
          const active = res.models.filter((m: any) => m.is_active === 1 || m.is_active === true || m.is_active === '1' || m.enabled === 1 || m.enabled === true);
          if (active.length > 0) {
            const cleaned = active.map((m: any) => {
              let id = m.id || m.model_id;
              if (id === '@cf/meta/llama-3.3-70b-instruct') id = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
              if (id === 'gemini-3.8-flash' || id === 'gemini-2.5-flash') id = 'gemini-2.0-flash';

              // Priorité absolue au surnom personnalisé configuré
              const cleanNick = (m.nickname && typeof m.nickname === 'string') ? stripWorkerAi(m.nickname) : '';
              const rawName = stripWorkerAi(m.name || id);
              const displayName = cleanNick.length > 0 ? cleanNick : rawName;

              return {
                id,
                name: displayName,
                rawName: rawName,
                nickname: cleanNick,
                provider: m.provider || 'cloudflare',
                model_id: id,
                api_token: m.api_token,
              };
            });
            setAvailableModels(cleaned);
            safeSetItem('studycloud_active_ai_models_v2', JSON.stringify(cleaned));

            const currentExists = cleaned.some((m: any) => m.id === selectedModel || m.model_id === selectedModel);
            if (!currentExists && res.config?.default_model) {
              let def = res.config.default_model;
              if (def === '@cf/meta/llama-3.3-70b-instruct') def = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
              if (def === 'gemini-3.8-flash' || def === 'gemini-2.5-flash') def = 'gemini-2.0-flash';
              const defExists = cleaned.some((m: any) => m.id === def || m.model_id === def);
              if (defExists) {
                setSelectedModel(def);
              } else if (cleaned[0]) {
                setSelectedModel(cleaned[0].id);
              }
            } else if (!currentExists && cleaned[0]) {
              setSelectedModel(cleaned[0].id);
            }
          } else {
            setAvailableModels([]);
            safeSetItem('studycloud_active_ai_models_v2', JSON.stringify([]));
          }
        }
      })
      .catch((err) => {
        console.warn('[AssistantChat] Erreur chargement modèles IA:', err);
      })
      .finally(() => {
        setIsModelsLoading(false);
      });
  }, []);

  const currentModelDisplay = useMemo(() => {
    const found = availableModels.find(m => m.id === selectedModel || m.model_id === selectedModel);
    if (found) {
      if (found.nickname && found.nickname.trim() !== '') {
        return stripWorkerAi(found.nickname);
      }
      if (isChefModelId(found.id || found.model_id)) {
        return 'Agent Delmas (Chef Multi-IA)';
      }
      return stripWorkerAi(found.name).replace(/Instruct/i, '').replace(/Google /i, '').trim();
    }
    if (isChefModelId(selectedModel)) return 'Agent Delmas (Chef Multi-IA)';
    if (selectedModel.includes('gemini')) return 'Gemini Flash';
    if (selectedModel.includes('deepseek')) return 'DeepSeek R1';
    if (selectedModel.includes('kimi')) return 'Kimi K2.7 Code';
    if (selectedModel.includes('claude')) return 'Claude 3.5';
    if (selectedModel.includes('gpt')) return 'GPT-4o Mini';
    return stripWorkerAi(selectedModel);
  }, [availableModels, selectedModel]);

  // Message d'accueil spontané et dynamique envoyé de manière instantanée et fluide par l'IA sélectionnée
  const [welcomeGreeting, setWelcomeGreeting] = useState<{ title: string; subtitle: string }>(() =>
    getSpontaneousAiGreeting(currentModelDisplay, resolvedActiveName)
  );
  const [displayedWelcomeTitle, setDisplayedWelcomeTitle] = useState<string>('');
  const [displayedWelcomeSubtitle, setDisplayedWelcomeSubtitle] = useState<string>('');
  const [isTypingWelcome, setIsTypingWelcome] = useState<boolean>(true);
  const welcomeAnimTimeoutRef = useRef<any[]>([]);

  useEffect(() => {
    // Nettoyer toute animation précédente
    welcomeAnimTimeoutRef.current.forEach(clearTimeout);
    welcomeAnimTimeoutRef.current = [];

    // Ne s'active que si la conversation est vide
    if (messages.length > 0) return;

    const newGreeting = getSpontaneousAiGreeting(currentModelDisplay, resolvedActiveName);
    setWelcomeGreeting(newGreeting);
    setDisplayedWelcomeTitle('');
    setDisplayedWelcomeSubtitle('');
    setIsTypingWelcome(true);

    const titleText = newGreeting.title;
    const subtitleText = newGreeting.subtitle;

    // Frappe instantanée et fluide du titre (18ms par caractère)
    for (let i = 1; i <= titleText.length; i++) {
      const t = setTimeout(() => {
        setDisplayedWelcomeTitle(titleText.slice(0, i));
      }, i * 18);
      welcomeAnimTimeoutRef.current.push(t);
    }

    // Le sous-titre commence à s'écrire juste après la fin du titre (12ms par caractère)
    const titleDuration = titleText.length * 18 + 70;
    for (let j = 1; j <= subtitleText.length; j++) {
      const t = setTimeout(() => {
        setDisplayedWelcomeSubtitle(subtitleText.slice(0, j));
        if (j === subtitleText.length) {
          setIsTypingWelcome(false);
        }
      }, titleDuration + j * 12);
      welcomeAnimTimeoutRef.current.push(t);
    }

    return () => {
      welcomeAnimTimeoutRef.current.forEach(clearTimeout);
      welcomeAnimTimeoutRef.current = [];
    };
  }, [selectedModel, currentConversationId, messages.length === 0, resolvedActiveName, currentModelDisplay]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<any>(null);
  const watchdogTimerRef = useRef<any>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const currentConversationIdRef = useRef<string>(currentConversationId);
  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  const activeControllersByConvRef = useRef<Record<string, AbortController>>({});
  const activeRequestIdsByConvRef = useRef<Record<string, number>>({});
  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Nettoyage impératif lors du démontage pour éviter les timers orphelins
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
    };
  }, []);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const isScrolledUp = distanceFromBottom > 90;
    isUserScrolledUpRef.current = isScrolledUp;
    setShowScrollBottomBtn(isScrolledUp);
  };

  const scrollToBottom = (smooth = true) => {
    if (scrollContainerRef.current) {
      isUserScrolledUpRef.current = false;
      setShowScrollBottomBtn(false);
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  };

  // Annuler / interrompre la tâche IA pour une conversation spécifique (par défaut la conversation courante)
  // switchingToNewTask: si vrai, une nouvelle tâche prend immédiatement le relais dans cette conversation
  const handleCancelTask = (convIdToCancel?: string | boolean, switchingToNewTask = false) => {
    const isSwitching = typeof convIdToCancel === 'boolean' ? convIdToCancel : switchingToNewTask;
    const targetId = typeof convIdToCancel === 'string' ? convIdToCancel : currentConversationIdRef.current;

    if (activeControllersByConvRef.current[targetId]) {
      try {
        activeControllersByConvRef.current[targetId].abort();
      } catch { }
      delete activeControllersByConvRef.current[targetId];
    }
    // aiBackgroundManager.clearTask(targetId);

    if (targetId === currentConversationIdRef.current) {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      if (activityTimerRef.current) {
        clearInterval(activityTimerRef.current);
        activityTimerRef.current = null;
      }

      if (!isSwitching) {
        activeRequestIdsByConvRef.current[targetId] = (activeRequestIdsByConvRef.current[targetId] || 0) + 1;
        isChatRequestInFlightRef.current = false;
        setIsWaitingServer(false);
        setIsTyping(false);
        setRetryingMessageId(null);
        window.dispatchEvent(new CustomEvent('ai-creation-status-update', {
          detail: { phase: 'idle', isLoading: false, isCancelled: true, resetToPrompts: true }
        }));
      }

      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.sender === 'ai' && last.isStreaming) {
          return prev.map((m, i) => i === prev.length - 1 ? {
            ...m,
            isStreaming: false,
            text: m.text ? `${m.text}\n\n*(Génération interrompue par l'utilisateur)*` : "*(Tâche annulée)*"
          } : m);
        }
        return prev;
      });
    }
  };

  // Sauvegarde ID de session courante (uniquement si ce n'est pas une création directe)
  useEffect(() => {
    if (!currentConversationId.startsWith('creation-')) {
      safeSetItem('studycloud_current_conversation_id', currentConversationId);
    }
  }, [currentConversationId]);

  // Sauvegarde automatique du fil de discussion actif pour reprise immédiate sans perte (sans persister les bulles IA vides)
  useEffect(() => {
    if (currentConversationId && !currentConversationId.startsWith('creation-') && messages.length > 0) {
      const nonEmptyMsgs = messages.filter(m => !(m.sender === 'ai' && (!m.text || !String(m.text).trim()) && !m.isError));
      safeSetItem(`studycloud_conv_msgs_${currentConversationId}`, JSON.stringify(nonEmptyMsgs));
    }
  }, [messages, currentConversationId]);

  useEffect(() => {
    onHasMessagesChange?.(messages.length > 0);
  }, [messages.length, onHasMessagesChange]);

  useEffect(() => {
    // Défilement automatique fluide UNIQUEMENT si l'utilisateur n'a pas délibérément défilé vers le haut
    if (scrollContainerRef.current && !isUserScrolledUpRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping, isWaitingServer]);

  // Chargement de la liste des conversations (Historique Gemini) depuis Cloudflare D1
  const loadConversations = async () => {
    try {
      const res = await StudyCloudAPI.getAiConversations(currentUserId);
      if (res && res.success && Array.isArray(res.data)) {
        // Filtrer strictement les conversations réelles du chat en éliminant les créations directes
        const filtered = res.data.filter((c: any) => !c.id?.startsWith('creation-') && !c.title?.startsWith('Conçois un '));
        setConversations(filtered);
      }
    } catch (e) {
      // Fallback localStorage
      const local = localStorage.getItem('studycloud_conversations_cache');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            setConversations(parsed.filter((c: any) => !c.id?.startsWith('creation-') && !c.title?.startsWith('Conçois un ')));
          }
        } catch { }
      }
    }
  };

  useEffect(() => {
    loadConversations();
    const handleRestore = () => {
      loadConversations();
    };
    window.addEventListener('unifolder_data_restored', handleRestore);
    return () => window.removeEventListener('unifolder_data_restored', handleRestore);
  }, [currentUserId]);

  // Chargement des messages de la conversation active
  const loadConversationMessages = async (convId: string) => {
    if (!convId || convId.startsWith('creation-')) {
      setMessages([]);
      return;
    }
    const isThisConvInFlight = Boolean(isChatRequestInFlightRef.current && currentConversationIdRef.current === convId);

    // 1. Chargement instantané du cache local (zéro latence)
    const local = safeGetItem(`studycloud_conv_msgs_${convId}`);
    let localParsed: Message[] = [];
    if (local) {
      try {
        localParsed = JSON.parse(local);
        if (Array.isArray(localParsed) && localParsed.length > 0) {
          if (!isThisConvInFlight) {
            // Nettoyer tout message IA fantôme vide issu d'un rechargement interrompu
            localParsed = localParsed.filter(m => !(m.sender === 'ai' && (!m.text || !m.text.trim()) && !m.isError));
          }
          setMessages(localParsed);
        }
      } catch { }
    }

    if (isThisConvInFlight) {
      setIsWaitingServer(true);
      setIsTyping(true);
    } else {
      // Si aucune requête de chat en cours pour cette conversation, s'assurer que les messages ne restent pas figés en streaming
      if (localParsed.length > 0 && localParsed[localParsed.length - 1]?.isStreaming) {
        localParsed = localParsed.map((m, idx) => idx === localParsed.length - 1 ? { ...m, isStreaming: false } : m);
        setMessages(localParsed);
        safeSetItem(`studycloud_conv_msgs_${convId}`, JSON.stringify(localParsed));
      }
      setIsWaitingServer(false);
      setIsTyping(false);
    }

    try {
      // 2. Synchronisation en arrière-plan avec la base Cloudflare D1
      const res = await StudyCloudAPI.getAiConversationMessages(convId);
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const loaded: Message[] = res.data.map((row: any) => {
          let attachedFileName = undefined;
          let modelName = undefined;
          let tokens = undefined;
          if (row.metadata) {
            try {
              const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
              const rawName = meta?.attachedFileName;
              if (rawName && rawName !== 'Document d\'étude' && rawName !== 'Document source' && rawName !== 'null' && rawName !== 'undefined') {
                attachedFileName = rawName;
              }
              modelName = meta?.model;
              tokens = meta?.tokens || meta?.credits;
            } catch { }
          }
          return {
            id: row.id,
            text: row.content,
            sender: (row.role === 'user' ? 'user' : 'ai') as 'user' | 'ai',
            attachedFileName,
            model: modelName || row.model,
            createdAt: row.created_at,
            tokens,
            credits: tokens,
          };
        }).filter((m) => {
          if (String(m.id || '').startsWith('ai-bg-') || String(m.id || '').startsWith('agent-')) return false;
          if (m.sender === 'user' && String(m.text || '').startsWith('Conçois immédiatement le module interactif complet')) return false;
          if (m.sender === 'ai') {
            const rawTxt = String(m.text || '').trim();
            if (!rawTxt) return false;
            const cleanedTxt = cleanChatText(stripAiReasoningScratchpad(rawTxt)).trim();
            if (!cleanedTxt) return false;
          }
          return true;
        });

        // Tri déterministe absolu : Chronologique par createdAt (normalisé ISO), et en cas d'égalité, le message utilisateur passe toujours AVANT l'IA
        loaded.sort((a, b) => {
          const normDate = (d?: string) => d ? new Date(d.includes('T') ? d : d.replace(' ', 'T') + 'Z').getTime() : 0;
          const timeA = normDate(a.createdAt);
          const timeB = normDate(b.createdAt);
          if (timeA !== timeB) return timeA - timeB;
          if (a.sender === 'user' && b.sender === 'ai') return -1;
          if (a.sender === 'ai' && b.sender === 'user') return 1;
          return 0;
        });

        // Si l'utilisateur est toujours sur cette conversation, mettre à jour la vue sans écraser les messages en cours de streaming
        if (currentConversationIdRef.current === convId) {
          let mergedForStorage = loaded;
          setMessages(prev => {
            const inFlightStreaming = prev.filter(m => m.isStreaming);
            if (inFlightStreaming.length === 0) return loaded;
            const loadedIds = new Set(loaded.map(m => m.id));
            const pending = inFlightStreaming.filter(m => !loadedIds.has(m.id));
            mergedForStorage = [...loaded, ...pending];
            return mergedForStorage;
          });
          safeSetItem(`studycloud_conv_msgs_${convId}`, JSON.stringify(mergedForStorage));
        } else {
          safeSetItem(`studycloud_conv_msgs_${convId}`, JSON.stringify(loaded));
        }
      }

      // Recharger également les créations associées à cette conversation
      try {
        // 1. D'abord depuis le cache local pour réactivité instantanée
        const localConvCreasRaw = safeGetItem(`studycloud_conv_creations_${convId}`);
        let localCreas: AiCreation[] = [];
        if (localConvCreasRaw) {
          try { localCreas = JSON.parse(localConvCreasRaw) || []; } catch { }
        }
        if (localCreas.length === 0) {
          const genCache = safeGetItem('studycloud_saved_creations_cache');
          if (genCache) {
            try {
              const parsedGen = JSON.parse(genCache);
              if (Array.isArray(parsedGen)) {
                localCreas = parsedGen.filter((c: any) => c.conversationId === convId);
              }
            } catch { }
          }
        }
        if (localCreas.length > 0 && currentConversationIdRef.current === convId) {
          setSessionCreations(localCreas);
          setActiveCreation(localCreas[0]);
        } else if (currentConversationIdRef.current === convId) {
          setSessionCreations([]);
        }

        // 2. Synchronisation en arrière-plan avec la table Cloudflare D1 ai_creations
        const crRes = await StudyCloudAPI.getAiConversationCreations(convId);
        if (crRes && crRes.success && Array.isArray(crRes.data)) {
          const mappedFromD1: AiCreation[] = crRes.data.map((c: any) => {
            let contentParsed = c.content;
            if (typeof contentParsed === 'string') {
              try { contentParsed = JSON.parse(contentParsed); } catch { }
            }
            return {
              id: c.id,
              userId: currentUserId,
              conversationId: convId,
              toolType: c.type,
              title: c.title || 'Création IA',
              content: contentParsed,
              createdAt: c.created_at,
            };
          });

          // Fusion sans doublons avec les créations locales de cette conversation
          const mergedMap = new Map<string, AiCreation>();
          mappedFromD1.forEach(item => mergedMap.set(item.id, item));
          localCreas.forEach(item => {
            if (!mergedMap.has(item.id)) mergedMap.set(item.id, item);
          });
          const mergedList = Array.from(mergedMap.values());
          if (currentConversationIdRef.current === convId) {
            setSessionCreations(mergedList);
            if (mergedList.length > 0) {
              setActiveCreation(mergedList[0]);
            }
          }
          safeSetItem(`studycloud_conv_creations_${convId}`, JSON.stringify(mergedList));
        }
      } catch (err) {
        console.warn('[AssistantChat] Erreur chargement créations conversation:', err);
      }
    } catch (e) {
      console.warn('[AssistantChat] Erreur chargement messages:', e);
    }
  };

  useEffect(() => {
    loadConversationMessages(currentConversationId);
  }, [currentConversationId]);

  // Écoute des événements d'arrière-plan et vérification de reprise post-rechargement
  useEffect(() => {
    const handleTaskCompleted = (e: any) => {
      const { conversationId, creation } = e.detail || {};
      if (conversationId === currentConversationIdRef.current) {
        if (!creation) {
          loadConversationMessages(conversationId);
          setIsWaitingServer(false);
          setIsTyping(false);
        }
      }
    };

    const handleTaskStarted = (e: any) => {
      const { conversationId, isCreation, creationId, toolType } = e.detail || {};
      // Les créations d'arrière-plan ne doivent JAMAIS bloquer le chat !
      if (isCreation || creationId || toolType) return;
      if (conversationId === currentConversationIdRef.current) {
        setIsWaitingServer(true);
        setIsTyping(true);
      }
    };

    window.addEventListener('studycloud-ai-task-completed', handleTaskCompleted as any);
    window.addEventListener('studycloud-ai-task-started', handleTaskStarted as any);

    // Watcher de reprise automatique post-rechargement pour les tâches en cours
    let recoveryTimer: any = null;
    const checkRunningTasks = () => {
      // Ignorer les créations : elles ont leur propre cycle de vie dans RightMenu et ne doivent pas reset le chat
      const activeTasks: any[] = [];
      if (activeTasks.length > 0) {
        activeTasks.forEach(task => {
          StudyCloudAPI.getAiConversationMessages(task.conversationId).then(res => {
            if (res && res.success && Array.isArray(res.data)) {
              // Vérification STRICTEMENT par id unique pour ne jamais confondre avec un ancien message
              const foundMsg = res.data.find((m: any) => m.id === task.aiMsgId);
              if (foundMsg && foundMsg.content && foundMsg.content.trim().length > 0) {
                // aiBackgroundManager.completeAiTask(task.conversationId, task.aiMsgId, foundMsg.content);
                if (task.conversationId === currentConversationIdRef.current) {
                  loadConversationMessages(task.conversationId);
                  setIsWaitingServer(false);
                  setIsTyping(false);
                }
              }
            }
          }).catch(() => { });
        });
      }
    };

    checkRunningTasks();
    recoveryTimer = setInterval(checkRunningTasks, 3000);

    return () => {
      window.removeEventListener('studycloud-ai-task-completed', handleTaskCompleted as any);
      window.removeEventListener('studycloud-ai-task-started', handleTaskStarted as any);
      if (recoveryTimer) clearInterval(recoveryTimer);
    };
  }, []);

  // Synchronisation avec les créations actives du panneau droit et persistance D1
  useEffect(() => {
    const handleReady = (e: any) => {
      const creation = e.detail?.creation;
      if (!creation) return;

      const creationWithConv: AiCreation = {
        ...creation,
        conversationId: creation.conversationId || currentConversationId,
      };

      if (e.detail?.isFromChat) {
        setActiveCreation(creationWithConv);
        StudyCloudAPI.saveAiCreationRecord({
          id: creationWithConv.id,
          conversationId: currentConversationId,
          type: creationWithConv.toolType,
          title: creationWithConv.title,
          content: creationWithConv.content,
        }).catch(() => { });
      }

      setSessionCreations(prev => {
        const updated = [creationWithConv, ...prev.filter(c => c.id !== creationWithConv.id)];
        safeSetItem(`studycloud_conv_creations_${currentConversationId}`, JSON.stringify(updated));
        return updated;
      });

      // Sauvegarde systématique dans la table D1 ai_generated_contents
      if (currentUserId && currentUserId !== 'default-user') {
        StudyCloudAPI.saveAiContent({
          id: creationWithConv.id,
          userId: currentUserId,
          fileId: creationWithConv.fileId || null,
          conversationId: currentConversationId,
          toolType: creationWithConv.toolType || (creationWithConv as any).type || 'creation',
          title: creationWithConv.title || 'Création Studio',
          contentJson: creationWithConv.content || (creationWithConv as any).data,
          sourceFileName: creationWithConv.sourceFileName || undefined,
          isPinned: Boolean(creationWithConv.isPinned),
        }).then(() => {
          window.dispatchEvent(new CustomEvent('studycloud-creation-saved', { detail: { id: creationWithConv.id, creation: creationWithConv } }));
        }).catch(err => {
          console.warn('[AssistantChat] Erreur sauvegarde D1 (handleReady):', err);
        });
      }
    };

    const handleUpdate = (e: any) => {
      if (e.detail?.updatedContent && activeCreation) {
        const updated = { ...activeCreation, content: e.detail.updatedContent };
        setActiveCreation(updated);
        setSessionCreations(prev => {
          const list = prev.map(c => c.id === updated.id ? updated : c);
          safeSetItem(`studycloud_conv_creations_${currentConversationId}`, JSON.stringify(list));
          return list;
        });

        try {
          const cachedRaw = localStorage.getItem('studycloud_saved_creations_cache');
          let currentList = cachedRaw ? JSON.parse(cachedRaw) : [];
          if (Array.isArray(currentList)) {
            const updatedGlobal = currentList.map((c: any) => c.id === updated.id ? { ...c, content: updated.content, data: updated.content } : c);
            localStorage.setItem('studycloud_saved_creations_cache', JSON.stringify(updatedGlobal));
            localStorage.setItem('unifolder_ai_history', JSON.stringify(updatedGlobal));
          }
        } catch { }

        if (e.detail?.isFromChat) {
          StudyCloudAPI.saveAiCreationRecord({
            id: activeCreation.id,
            conversationId: currentConversationId,
            type: activeCreation.toolType,
            title: activeCreation.title,
            content: e.detail.updatedContent,
          }).catch(() => { });
        }

        // Mise à jour dans la base D1
        if (currentUserId && currentUserId !== 'default-user') {
          StudyCloudAPI.saveAiContent({
            id: activeCreation.id,
            userId: currentUserId,
            fileId: activeCreation.fileId || null,
            conversationId: currentConversationId,
            toolType: activeCreation.toolType || activeCreation.type || 'creation',
            title: activeCreation.title || 'Création Studio',
            contentJson: e.detail.updatedContent,
            sourceFileName: activeCreation.sourceFileName || undefined,
          }).then(() => {
            window.dispatchEvent(new CustomEvent('studycloud-creation-saved', { detail: { id: activeCreation.id, creation: updated } }));
          }).catch(err => {
            console.warn('[AssistantChat] Erreur mise à jour création D1:', err);
          });
        }
      }
    };
    window.addEventListener('ai-creation-ready', handleReady as any);
    window.addEventListener('ai-creation-update', handleUpdate as any);
    return () => {
      window.removeEventListener('ai-creation-ready', handleReady as any);
      window.removeEventListener('ai-creation-update', handleUpdate as any);
    };
  }, [activeCreation, currentConversationId, currentUserId]);

  // Nettoyage des timers d'animation et d'activité
  useEffect(() => {
    if (!isWaitingServer && activityTimerRef.current) {
      clearInterval(activityTimerRef.current);
      activityTimerRef.current = null;
    }
  }, [isWaitingServer]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      if (activityTimerRef.current) clearInterval(activityTimerRef.current);
    };
  }, []);

  // Création d'une nouvelle session de discussion
  const handleStartNewConversation = () => {
    const newId = 'conv-' + Date.now();
    currentConversationIdRef.current = newId;
    setCurrentConversationId(newId);
    setCurrentConversationTitle('Nouvelle discussion');
    setMessages([]);
    setActiveCreation(null);
    setSessionCreations([]);
    setRetryingMessageId(null);
    setIsTyping(false);
    setIsWaitingServer(false);
    setIsHistoryDrawerOpen(false);
    setShowProposalBar(true);

    // DÉTACHEMENT STRICT : aucun document de la session précédente ne doit persister
    setAttachedResources?.([]);
    window.dispatchEvent(new CustomEvent('studycloud_new_conversation'));

    // RÉINITIALISATION COMPLÈTE DE LA MÉMOIRE DE PERCEPTION EN BASE D1
    cachedPerceptionReportsRef.current = {};
    analyzedMediaPerConvRef.current = {};
    cachedDocumentTextRef.current = {};
    if (currentUserId && currentUserId !== 'default-user') {
      StudyCloudAPI.clearAiFilePerceptions(currentUserId).catch(() => { });
    }

    safeSetItem('studycloud_current_conversation_id', newId);
    safeLocalStorageRemove(`studycloud_conv_msgs_${newId}`);
    safeLocalStorageRemove(`studycloud_conv_creations_${newId}`);
    safeLocalStorageRemove(`studycloud_analyzed_media_${currentUserId}_${newId}`);
    delete analyzedMediaPerConvRef.current[`${currentUserId}_${newId}`];

    // Initialisation D1
    StudyCloudAPI.createAiConversation({
      id: newId,
      userId: currentUserId,
      title: 'Nouvelle discussion',
    }).catch(() => { });
  };

  // Suppression d'une session
  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (activeControllersByConvRef.current[convId]) {
        try { activeControllersByConvRef.current[convId].abort(); } catch { }
        delete activeControllersByConvRef.current[convId];
      }
      // aiBackgroundManager.clearTask(convId);

      await StudyCloudAPI.deleteAiConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      safeLocalStorageRemove(`studycloud_conv_msgs_${convId}`);
      safeLocalStorageRemove(`studycloud_conv_creations_${convId}`);
      safeLocalStorageRemove(`studycloud_analyzed_media_${currentUserId}_${convId}`);
      delete analyzedMediaPerConvRef.current[`${currentUserId}_${convId}`];
      if (currentConversationId === convId) {
        handleStartNewConversation();
      }
    } catch (err) {
      console.warn('[AssistantChat] Erreur suppression session:', err);
    }
  };

  const handleReaction = async (messageId: string, reaction: 'like' | 'dislike') => {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const next = m.reaction === reaction ? null : reaction;
        return { ...m, reaction: next };
      }
      return m;
    }));

    if (currentUserId) {
      await saveAiReaction({
        userId: currentUserId,
        messageId,
        reaction,
      });
    }
  };

  const handleRemoveAttachment = async (res: any) => {
    setAttachedResources?.((prev: any[]) => prev.filter((r: any) => r.id !== res.id));
    cachedPerceptionReportsRef.current = {};
    if (currentUserId && currentUserId !== 'default-user') {
      StudyCloudAPI.clearAiFilePerceptions(currentUserId).catch(() => { });
    }
    if (currentUserId && res.id) {
      await removeAiAttachment({
        userId: currentUserId,
        fileId: res.id,
        r2Key: res.r2_key || res.r2Key,
      });
    }
  };

  /**
   * Exécuteur de tâche de création en arrière-plan
   * Appelé par le gestionnaire de file d'attente aiBackgroundManager (Max 3 requêtes en simultané)
   */
  const executeCreationApiCall = async (params: {
    userText: string;
    targetConvId: string;
    targetUserId: string;
    explicitToolType: AiCreationType;
    mainDocName: string;
    creationId: string;
    creationTitle: string;
    allDocs: any[];
    messages: Message[];
    selectedModel: string;
    availableModels: any[];
    currentConversationId: string;
    sessionCreations: AiCreation[];
    resolvedActiveItem: any;
    attachedResources: any[];
    activePreviewItem: any;
    currentModelDisplay: string;
    activeDocumentInfo?: any;
    activeImageInfo?: any;
  }): Promise<{ response?: string; creation?: any }> => {
    let activeImageInfo: { base64: string; mimeType: string } | null = params.activeImageInfo || null;
    let activeDocumentInfo: {
      textContent: string;
      documentBase64?: string;
      documentMimeType?: string;
      documentImages?: Array<{ base64: string; mimeType: string; name?: string }>;
      fileName?: string;
    } | null = params.activeDocumentInfo || null;

    if (!activeDocumentInfo && !activeImageInfo) {
      if (params.resolvedActiveItem) {
        if (isDocumentItem(params.resolvedActiveItem)) {
          (params.resolvedActiveItem as any)._needsCanvas = true;
          activeDocumentInfo = await extractDocumentDetails(params.resolvedActiveItem);
        } else if (!isVideoItem(params.resolvedActiveItem) && !isAudioItem(params.resolvedActiveItem)) {
          activeImageInfo = await extractImageBase64FromItem(params.resolvedActiveItem);
        }
      }

      if (Array.isArray(params.attachedResources)) {
        for (const res of params.attachedResources) {
          if (!activeDocumentInfo && isDocumentItem(res)) {
            (res as any)._needsCanvas = true;
            activeDocumentInfo = await extractDocumentDetails(res);
          } else if (!activeImageInfo && !isVideoItem(res) && !isAudioItem(res)) {
            activeImageInfo = await extractImageBase64FromItem(res);
          }
        }
      }
    }

    const agentMediaSig = computeActiveMediaSignature(params.resolvedActiveItem, params.attachedResources || []);
    const agentPerception = (agentMediaSig ? cachedPerceptionReportsRef.current[agentMediaSig] : '') || '';
    const resolvedAttachedText = activeDocumentInfo?.textContent ||
      (agentMediaSig ? cachedDocumentTextRef.current[agentMediaSig] : '') ||
      (params.resolvedActiveItem as any)?.content ||
      (params.resolvedActiveItem as any)?.text ||
      (params.resolvedActiveItem as any)?.rawText ||
      '';

    const getAgentRoleDescription = (type: string): string => {
      switch (type) {
        case 'resume':
          return "Tu es le Sous-Agent Spécialiste de la Synthèse et des Fiches de Révision Masterclass. Ton rôle exclusif est d'analyser l'intégralité du document joint et de rédiger une fiche de révision d'une richesse exceptionnelle : toutes les définitions, toutes les formules avec \\dfrac{}{} et étapes de démonstration, la logique profonde et toutes les zones d'ombre éclaircies.";
        case 'questionnaire':
        case 'questionnaire-test':
          return "Tu es le Sous-Agent Spécialiste de la Docimologie et des Évaluations Formatives (QCM). Ton rôle exclusif est de créer 15 à 18 questions d'excellence couvrant tout le document (concepts, formules canoniques en LaTeX, logique, zones d'ombre et calculs de TD) avec des explications détaillées.";
        case 'vrai-ou-faux':
        case 'vrai-ou-faux-test':
          return "Tu es le Sous-Agent Spécialiste de l'Analyse Critique et des Épreuves Vrai/Faux. Ton rôle exclusif est de tester la précision conceptuelle de l'étudiant sur toutes les subtilités, conditions de validité, formules et zones d'ombre du document.";
        case 'carte-mentale':
        case 'carte-mentale-2':
          return "Tu es le Sous-Agent Cartographe Conceptuel. Ton rôle exclusif est de décomposer l'intégralité du cours et de ses TD en une arborescence profonde à 4 paliers avec toutes les formules en LaTeX, la logique et les zones d'ombre.";
        case 'carte-memoire':
          return "Tu es le Sous-Agent Spécialiste de la Mémorisation Active et Répétition Espacée. Ton rôle exclusif est de fabriquer 15 à 20 cartes mémoires (flashcards) ultra-riches couvrant toutes les définitions, formules, démonstrations et zones d'ombre du document.";
        case 'devoir-complet':
          return "Tu es le Sous-Agent Concepteur d'Épreuves d'Examen et Concours. Ton rôle exclusif est de rédiger un devoir complet sur 20 points exploitant tout le document et ses TD, avec corrigé type démontré pas à pas.";
        case 'exercices-ecrits':
          return "Tu es le Sous-Agent Rédacteur d'Exercices d'Application. Ton rôle exclusif est de concevoir 8 à 10 exercices progressifs sur 20 points basés sur le cours et les TD du document avec solutions démontrées étape par étape.";
        case 'infographie':
          return "Tu es le Sous-Agent Infographiste Pédagogique. Ton rôle exclusif est de structurer toutes les notions, formules, étapes logiques et zones d'ombre du document sous forme de tableau de bord visuel complet.";
        case 'pdf':
          return "Tu es le Sous-Agent Rédacteur Académique. Ton rôle exclusif est de rédiger un polycopié complet, structuré et approfondi couvrant tout le document et prêt pour l'exportation PDF.";
        default:
          return `Tu es le Sous-Agent Pédagogique Spécialisé pour le support "${type}".`;
      }
    };

    let systemContent = `Tu es l'intelligence pédagogique centrale autonome de StudyCloud (${params.currentModelDisplay || 'IA'}).
${getAgentRoleDescription(params.explicitToolType)}
Tu es en mission de conception officielle StudyCloud pour fabriquer le support : "${params.explicitToolType}".

${getCommonDeepCreationDirective(params.mainDocName)}

${getTargetJsonInstructions(params.explicitToolType, params.mainDocName, params.creationTitle)}

RÈGLES D'EXCELLENCE POUR LA MISE EN PAGE, LES TITRES ET LES FRACTIONS :
0. LANGUE FRANÇAISE STRICTE ET ZÉRO MONOLOGUE INTERNE (ANTI-SCRATCHPAD) :
   - TU RÉPONDS EXCLUSIVEMENT ET TOTALEMENT EN FRANÇAIS SOIGNÉ, CLAIR ET PÉDAGOGIQUE.
   - IL EST STRICTEMENT INTERDIT D'ÉCRIRE EN ANGLAIS ET D'AFFICHER UN MONOLOGUE DE RÉFLEXION INTERNE ('Let's think', 'Waitcheck', 'Hmm', etc.).
1. INTERDICTION FORMELLE D'ÉCRIRE DES FRACTIONS AVEC LE SLASH '/' :
   - TOUTE fraction mathématique ou scientifique DOIT IMPÉRATIVEMENT être écrite avec \\dfrac{numérateur}{dénominateur} : $$ \\omega_0 = \\dfrac{1}{\\sqrt{LC}} $$.
2. POSITION ALÉATOIRE ET DIVERSITÉ (15 À 18 ITEMS POUR QUESTIONNAIRES ET VRAI OU FAUX, 18 MAXIMUM) :
   - Génère entre 15 et 18 questions/affirmations riches couvrant tout le document (sans jamais dépasser 18).
   - Bonne réponse répartie de façon équitable et aléatoire entre A, B, C, D (ne jamais la mettre toujours au début).
   - Distracteurs plausibles ciblant les erreurs classiques et zones d'ombre.`;

    // Mémoire des créations de cette conversation pour anti-répétition
    let relevantCreations: AiCreation[] = params.sessionCreations;
    if (!relevantCreations || relevantCreations.length === 0) {
      try {
        const rawLocal = safeGetItem(`studycloud_conv_creations_${params.targetConvId}`);
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (Array.isArray(parsed)) relevantCreations = parsed;
        }
      } catch { }
    }

    if (relevantCreations && relevantCreations.length > 0) {
      const formattedCreationsContext = formatCreationsSummaryForPrompt(relevantCreations);
      systemContent += `\n\n══════════════════════════════════════════════════════════════════════════════
[MÉMOIRE DES CRÉATIONS ENREGISTRÉES DANS CETTE CONVERSATION (SESSION : ${params.targetConvId})] :
Tu as un accès exclusif aux modules et contenus pédagogiques déjà générés et enregistrés dans la base de données au cours de CETTE session :
${formattedCreationsContext}

DIRECTIVES STRICTES DE NON-RÉPÉTITION :
- INTERDICTION FORMELLE DE RÉPÉTER LES MÊMES QUESTIONS OU ITEMS.
- Formule des questions sous de nouveaux angles (max 1-2 questions de révision pour la mémorisation espacée).
══════════════════════════════════════════════════════════════════════════════`;
    }

    if (params.mainDocName) {
      systemContent += `\n\nDOCUMENT FOURNI PAR L'ÉTUDIANT : "${params.mainDocName}". Tu as un accès direct et intégral au contenu textuel et visuel de ce document.`;
    }
    if (resolvedAttachedText && resolvedAttachedText.trim().length > 0) {
      systemContent += `\n\n══════════════════════════════════════════════════════════════════════════════
[CONTENU TEXTUEL INTÉGRAL DU DOCUMENT JOINT (« ${params.mainDocName || "Document d'étude"} »)] :
Exploite 100 % de ce document (tous les chapitres, toutes les formules avec \\dfrac{}{}, toutes les démonstrations, la logique physique/mathématique, les zones d'ombre et les TD) :
${resolvedAttachedText.slice(0, 45000)}
══════════════════════════════════════════════════════════════════════════════`;
    }
    if (agentPerception && agentPerception.trim().length > 0 && agentPerception.trim() !== resolvedAttachedText.trim()) {
      systemContent += `\n\n══════════════════════════════════════════════════════════════════════════════
[DOSSIER D'OBSERVATION VISUELLE & SCHÉMAS DU DOCUMENT (« ${params.mainDocName || "Document d'étude"} »)] :
${agentPerception.slice(0, 30000)}
══════════════════════════════════════════════════════════════════════════════`;
    }

    const normTypeEarly = normalizeCreationType(params.explicitToolType);
    const formatDisplayTitle = CREATION_NAME_MAP[normTypeEarly] || CREATION_FORMAT_LABELS[normTypeEarly] || normTypeEarly;
    const agentExplicitPrompt = `Conçois immédiatement le module interactif complet, exhaustif et d'une richesse académique impressionnante de type "${normTypeEarly}" (${formatDisplayTitle}) intitulé "${params.creationTitle}" sur ${params.mainDocName ? `le document « ${params.mainDocName} »` : `le sujet : ${params.userText}`}. Exploite l'intégralité du document (tous les chapitres, toutes les formules en LaTeX avec \\dfrac{}{}, la logique profonde, les démonstrations, toutes les zones d'ombre/pièges d'examen et les TD). Consigne de l'étudiant : "${params.userText}". Réponds EXCLUSIVEMENT avec l'objet JSON complet pour CE SEUL format "${normTypeEarly}" entouré de \`\`\`json et \`\`\`.`;

    const chatHistory = [
      { role: 'system', content: systemContent },
      { role: 'user', content: agentExplicitPrompt }
    ];

    const aiResult = await sendChatMessageToAi({
      messages: chatHistory,
      prompt: agentExplicitPrompt,
      message: agentExplicitPrompt,
      userId: params.targetUserId,
      sessionId: params.targetConvId,
      conversationId: params.targetConvId,
      userMsgId: Date.now().toString(),
      aiMsgId: 'ai-bg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      creationId: params.creationId,
      creationTitle: params.creationTitle,
      model: params.selectedModel,
      selectedModel: params.selectedModel,
      apiKey: getGeminiApiKey() || undefined,
      requested_type: normTypeEarly,
      isAgentCreationTask: true,
      mode: 'agent_creation',
      attachedFileName: params.mainDocName,
      attachedFileContent: resolvedAttachedText,
      perceptionReport: agentPerception || undefined,
      imageBase64: activeImageInfo?.base64,
      mimeType: activeImageInfo?.mimeType,
      documentBase64: (!resolvedAttachedText || resolvedAttachedText.trim().length < 120) ? activeDocumentInfo?.documentBase64 : undefined,
      documentMimeType: activeDocumentInfo?.documentMimeType,
      documentImages: activeDocumentInfo?.documentImages,
      mediaType: activeDocumentInfo ? 'document' : (activeImageInfo ? 'image' : undefined),
    });

    if ((aiResult as any)?.code === 'INSUFFICIENT_CREDITS' || (aiResult as any)?.status === 402 || (aiResult as any)?.isInsufficientCredits) {
      const creditErr = new Error((aiResult as any)?.error || "Crédit IA insuffisant");
      (creditErr as any).isInsufficientCredits = true;
      (creditErr as any).code = 'INSUFFICIENT_CREDITS';
      (creditErr as any).status = 402;
      throw creditErr;
    }

    const rawResponseText = (aiResult as any).raw_response || (aiResult as any).rawResponse || aiResult.response || "";
    let finalContent: any = aiResult.creation_data;

    // Extraction JSON robuste multi-tentatives
    if (!finalContent) {
      // Tentative 1 : bloc ```json ... ``` ou ```...```
      const codeBlockMatch = rawResponseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (codeBlockMatch) {
        const parsedBlock = safeJsonParse(codeBlockMatch[1]);
        if (parsedBlock && typeof parsedBlock === 'object') {
          finalContent = parsedBlock.creation_data || (parsedBlock.questions || parsedBlock.affirmations || parsedBlock.cards || parsedBlock.root || parsedBlock.branches || parsedBlock.overview || parsedBlock.exercises || parsedBlock.complete_exam || parsedBlock.written_exercise ? parsedBlock : null);
        }
      }
    }
    if (!finalContent) {
      // Tentative 2 : premier grand objet JSON dans le texte (glouton)
      const allBraces = rawResponseText.match(/\{[\s\S]*\}/);
      if (allBraces) {
        const parsedBraces = safeJsonParse(allBraces[0]);
        if (parsedBraces && typeof parsedBraces === 'object') {
          finalContent = parsedBraces.creation_data || (parsedBraces.questions || parsedBraces.affirmations || parsedBraces.cards || parsedBraces.root || parsedBraces.branches || parsedBraces.overview || parsedBraces.exercises || parsedBraces.complete_exam || parsedBraces.written_exercise ? parsedBraces : null) || (Object.keys(parsedBraces).length > 0 ? parsedBraces : null);
        }
      }
    }
    if (!finalContent) {
      // Tentative 3 : tableau JSON brut (ex: [{...}, {...}])
      const arrayMatch = rawResponseText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          const parsedArr = JSON.parse(arrayMatch[0]);
          if (Array.isArray(parsedArr) && parsedArr.length > 0) finalContent = parsedArr;
        } catch { }
      }
    }
    const normType = normalizeCreationType(params.explicitToolType);
    if (normType === 'vrai-ou-faux' || normType === 'vrai-ou-faux-test') {
      const rawAffs = Array.isArray(finalContent)
        ? finalContent
        : (finalContent?.affirmations || finalContent?.questions || finalContent?.items || finalContent?.statements || finalContent?.propositions || finalContent?.data);
      if (Array.isArray(rawAffs) && rawAffs.length > 0) {
        const mappedAffs = rawAffs.map((a: any, idx: number) => {
          let isTrue = true;
          if (typeof a.is_true === 'boolean') isTrue = a.is_true;
          else if (typeof a.isTrue === 'boolean') isTrue = a.isTrue;
          else if (typeof a.reponse === 'boolean') isTrue = a.reponse;
          else if (typeof a.correctAnswer === 'boolean') isTrue = a.correctAnswer;
          else if (typeof a.correct === 'boolean') isTrue = a.correct;
          else if (typeof a.is_correct === 'boolean') isTrue = a.is_correct;
          else if (typeof a.is_true === 'string') isTrue = a.is_true.toLowerCase() === 'true' || a.is_true.toLowerCase() === 'vrai';
          else if (typeof a.isTrue === 'string') isTrue = a.isTrue.toLowerCase() === 'true' || a.is_true.toLowerCase() === 'vrai';
          else if (typeof a.reponse === 'string') isTrue = a.reponse.toLowerCase() === 'true' || a.reponse.toLowerCase() === 'vrai';
          else if (typeof a.correctAnswer === 'string') isTrue = a.correctAnswer.toLowerCase() === 'true' || a.correctAnswer.toLowerCase() === 'vrai';

          const stmt = extractStatementText(a);
          const explText = typeof a?.explanation === 'string'
            ? a.explanation
            : (typeof a?.explication === 'string'
              ? a.explication
              : (typeof a?.justification === 'string' ? a.justification : ''));

          return {
            id: a?.id || `vf_${idx + 1}`,
            statement: stmt,
            is_true: isTrue,
            isTrue,
            explanation: explText
          };
        }).filter((a: any) => a.statement && a.statement.length > 0 && !/^Affirmation\s*(?:n°\s*\d+)?$/i.test(a.statement));

        if (mappedAffs.length > 0) {
          finalContent = { affirmations: mappedAffs.slice(0, 18) };
        } else {
          finalContent = null;
        }
      }
    } else if (normType === 'questionnaire' || normType === 'questionnaire-test') {
      const rawQs = Array.isArray(finalContent) ? finalContent : finalContent?.questions;
      if (Array.isArray(rawQs) && rawQs.length > 0) {
        finalContent = {
          ...(typeof finalContent === 'object' && !Array.isArray(finalContent) ? finalContent : {}),
          questions: rawQs.slice(0, 18).map((q: any, idx: number) => {
            const opts = Array.isArray(q?.options) ? q.options : (Array.isArray(q?.choices) ? q.choices : []);
            const rawIdx = q?.correct_index !== undefined
              ? q.correct_index
              : (q?.correctIndex !== undefined
                ? q.correctIndex
                : (q?.answerIndex !== undefined
                  ? q.answerIndex
                  : (q?.correctAnswer !== undefined ? q.correctAnswer : 0)));
            let corrIdx = Number(rawIdx);
            if (isNaN(corrIdx) || corrIdx < 0 || (opts.length > 0 && corrIdx >= opts.length)) corrIdx = 0;
            return {
              ...q,
              id: q?.id || `q_${idx + 1}`,
              question: q?.question || q?.texte || q?.title || `Question ${idx + 1}`,
              options: opts,
              correct_index: corrIdx,
              correctIndex: corrIdx,
              answerIndex: corrIdx,
              correctAnswer: corrIdx,
              explanation: q?.explanation || q?.explication || ''
            };
          })
        };
      }
    } else if (normType === 'carte-memoire') {
      const rawCards = Array.isArray(finalContent) ? finalContent : (finalContent?.cards || finalContent?.flashcards || finalContent?.data);
      if (Array.isArray(rawCards) && rawCards.length > 0) {
        finalContent = {
          cards: rawCards.map((c: any, idx: number) => {
            const qText = typeof c === 'string' ? c : (c?.question || c?.front || c?.recto || c?.terme || c?.term || `Concept ${idx + 1}`);
            const aText = typeof c === 'string' ? '' : (c?.answer || c?.back || c?.verso || c?.definition || c?.explication || '');
            const hText = typeof c === 'object' ? (c?.hint || c?.indice || '') : '';
            const tText = typeof c === 'object' ? (c?.tag || c?.theme || c?.chapitre || 'Général') : 'Général';
            return {
              id: c?.id || `card_${idx + 1}`,
              front: qText,
              back: aText,
              question: qText,
              answer: aText,
              hint: hText,
              tag: tText
            };
          })
        };
      }
    } else if (normType === 'exercices-ecrits') {
      if (finalContent && typeof finalContent === 'object') {
        const we = finalContent.written_exercise || finalContent;
        const rawExs = Array.isArray(we.questions) ? we.questions : (Array.isArray(we.exercises) ? we.exercises : (Array.isArray(we.exercices) ? we.exercices : (Array.isArray(finalContent) ? finalContent : null)));
        if (Array.isArray(rawExs) && rawExs.length > 0) {
          finalContent = {
            written_exercise: {
              title: we.title || params.creationTitle,
              theme: we.theme || params.mainDocName,
              context: we.context || we.enonce || '',
              questions: rawExs,
              correction: we.correction || undefined
            }
          };
        }
      }
    } else if (normType === 'devoir-complet') {
      if (finalContent && typeof finalContent === 'object') {
        const ce = finalContent.complete_exam || finalContent;
        if (Array.isArray(ce.sections) && ce.sections.length > 0) {
          finalContent = {
            complete_exam: {
              exam_title: ce.exam_title || ce.title || params.creationTitle,
              title: ce.title || ce.exam_title || params.creationTitle,
              total_points: ce.total_points || ce.baremeTotal || 20,
              baremeTotal: ce.baremeTotal || ce.total_points || 20,
              time_allowed: ce.time_allowed || ce.duree || '2 heures',
              duree: ce.duree || ce.time_allowed || '2h00',
              sections: ce.sections
            }
          };
        }
      }
    } else if (normType === 'carte-mentale' || normType === 'carte-mentale-2') {
      if (finalContent && typeof finalContent === 'object') {
        const rootNode = finalContent.root || finalContent;
        const rawChildren = Array.isArray(rootNode?.children)
          ? rootNode.children
          : (Array.isArray(finalContent.branches) ? finalContent.branches : (Array.isArray(finalContent.nodes) ? finalContent.nodes : (Array.isArray(finalContent.columns) ? finalContent.columns : (Array.isArray(finalContent.children) ? finalContent.children : []))));
        const rootLabel = rootNode?.label || rootNode?.title || finalContent.title || params.mainDocName || params.creationTitle;
        if (rawChildren.length > 0 || finalContent.root) {
          finalContent = {
            ...finalContent,
            root: {
              id: rootNode?.id || 'root-1',
              label: rootLabel,
              details: rootNode?.details || 'Thème central',
              children: rawChildren
            },
            root_title: rootLabel,
            columns: rawChildren
          };
        }
      }
    } else if (normType === 'resume') {
      const rObj = finalContent?.summary || finalContent?.creation_data || finalContent;
      if (rObj && typeof rObj === 'object') {
        const rawFormulas = Array.isArray(rObj.formulas) ? rObj.formulas : [];
        const normFormulas = rawFormulas.map((f: any) => ({
          ...f,
          name: f?.name || f?.title || 'Relation fondamentale',
          latex: String(f?.latex || f?.formula || '').replace(/(?<!\\)\$/g, '').trim(),
          formula: f?.formula || f?.latex || '',
          variables: f?.variables || f?.meaning || f?.units || '',
          meaning: f?.meaning || f?.variables || '',
          target_goal: f?.target_goal || f?.when_to_use || '',
          when_to_use: f?.when_to_use || f?.target_goal || '',
          how_to_derive: f?.how_to_derive || '',
          demonstration_steps: Array.isArray(f?.demonstration_steps) ? f.demonstration_steps : [],
          exam_trap: f?.exam_trap || f?.trap || ''
        }));
        const rawTraps = Array.isArray(rObj.traps_and_tips) ? rObj.traps_and_tips : [];
        const normTraps = rawTraps.map((t: any, idx: number) =>
          typeof t === 'string'
            ? { type: idx % 2 === 0 ? 'trap' : 'tip', title: idx % 2 === 0 ? "ZONE D'OMBRE & PIÈGE D'EXAMEN" : 'ASTUCE MÉTHODOLOGIQUE', content: t }
            : {
              type: t?.type || 'trap',
              title: t?.title || (t?.type === 'tip' ? 'ASTUCE MÉTHODOLOGIQUE' : "ZONE D'OMBRE & PIÈGE D'EXAMEN"),
              content: t?.content || t?.text || t?.description || ''
            }
        );
        finalContent = {
          title: rObj.title || params.creationTitle,
          theme: rObj.theme || rObj.domaine || '',
          overview: typeof rObj.overview === 'string' ? rObj.overview : '',
          key_definitions: Array.isArray(rObj.key_definitions) ? rObj.key_definitions : (Array.isArray(rObj.definitions) ? rObj.definitions : []),
          formulas: normFormulas,
          comparison_table: rObj.comparison_table || null,
          traps_and_tips: normTraps,
          practical_example: rObj.practical_example || null,
          sections: Array.isArray(rObj.sections) ? rObj.sections : [],
          markdown: typeof rObj.markdown === 'string' ? rObj.markdown : '',
        };
      }
    }

    // Filet de sécurité absolu : Si finalContent est incomplet ou invalide pour le type demandé,
    // appel de secours à parseOrBuildAiCreation avec le normType strict
    if (!hasRealCreationData(normType, finalContent)) {
      try {
        const built = parseOrBuildAiCreation(normType as any, rawResponseText, params.mainDocName, params.userText);
        if (built?.content && hasRealCreationData(normType, built.content)) {
          finalContent = built.content;
        }
      } catch (_fallbackErr) { }
    }

    // Filet de dernier recours : Si finalContent est toujours null/vide apres tous les essais,
    // construire un contenu minimal valide pour eviter que la creation reste bloquee en 'generating'.
    if (!finalContent || (typeof finalContent === 'object' && !Array.isArray(finalContent) && Object.keys(finalContent).length === 0)) {
      console.warn('[executeCreationApiCall] finalContent null pour', normType, '- construction contenu minimal');
      const rawPreview = rawResponseText.slice(0, 800) || 'Contenu non disponible';
      switch (normType) {
        case 'questionnaire': case 'questionnaire-test':
          finalContent = { questions: [] }; break;
        case 'vrai-ou-faux': case 'vrai-ou-faux-test':
          finalContent = { affirmations: [] }; break;
        case 'carte-memoire':
          finalContent = { cards: [] }; break;
        case 'carte-mentale': case 'carte-mentale-2':
          finalContent = { root: { id: 'root-1', label: params.mainDocName || params.creationTitle, children: [] } }; break;
        case 'resume':
          finalContent = { title: params.creationTitle, overview: rawPreview, key_definitions: [], sections: [], formulas: [], traps_and_tips: [], markdown: rawPreview }; break;
        default:
          finalContent = { title: params.creationTitle, content: rawPreview };
      }
    }

    const activeTpc = getActiveTokensPerCredit();
    const respTokens = Number(aiResult?.tokens || (aiResult as any)?.usage?.totalTokens || 0) || Math.max(120, Math.ceil((rawResponseText.length + (resolvedAttachedText || '').slice(0, 4000).length) / 3.8));
    const respCredits = Number(aiResult?.credits_deducted || aiResult?.credits || (aiResult as any)?.usage?.creditsDeducted || 0) || convertTokensToCredits(respTokens, activeTpc);

    if (finalContent && typeof finalContent === 'object' && !Array.isArray(finalContent)) {
      finalContent.tokens = respTokens;
      finalContent.credits = respCredits;
    }

    const newCreation: AiCreation = {
      id: params.creationId,
      userId: params.targetUserId,
      fileId: params.activePreviewItem?.id,
      conversationId: params.targetConvId,
      toolType: normType,
      title: params.creationTitle,
      content: finalContent,
      sourceFileName: params.mainDocName,
      createdAt: new Date().toISOString(),
      version: 1,
      status: 'ready',
      tokens: respTokens,
      credits: respCredits,
    };

    try {
      const localConvCreasRaw = safeGetItem(`studycloud_conv_creations_${params.targetConvId}`);
      let localConvCreas: AiCreation[] = [];
      if (localConvCreasRaw) {
        try { localConvCreas = JSON.parse(localConvCreasRaw) || []; } catch { }
      }
      const updatedConvCreas = [newCreation, ...localConvCreas.filter(c => c.id !== newCreation.id)];
      safeSetItem(`studycloud_conv_creations_${params.targetConvId}`, JSON.stringify(updatedConvCreas));

      const cachedRaw = localStorage.getItem('studycloud_saved_creations_cache');
      let currentList = cachedRaw ? JSON.parse(cachedRaw) : [];
      if (!Array.isArray(currentList)) currentList = [];
      const updatedList = [newCreation, ...currentList.filter((c: any) => c.id !== newCreation.id)].slice(0, 50);
      localStorage.setItem('studycloud_saved_creations_cache', JSON.stringify(updatedList));
      localStorage.setItem('unifolder_ai_history', JSON.stringify(updatedList));
    } catch { }

    StudyCloudAPI.saveAiCreationRecord({
      id: newCreation.id,
      conversationId: params.targetConvId,
      type: normType,
      title: newCreation.title,
      content: newCreation.content,
    }).catch(() => { });

    if (params.targetUserId && params.targetUserId !== 'default-user') {
      await StudyCloudAPI.saveAiContent({
        id: newCreation.id,
        userId: params.targetUserId,
        fileId: params.activePreviewItem?.id || null,
        conversationId: params.targetConvId,
        toolType: normType,
        title: newCreation.title,
        contentJson: newCreation.content,
        sourceFileName: params.mainDocName || undefined,
        isPinned: false,
      }).catch(() => { });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studycloud-creation-saved', { detail: { id: newCreation.id, creation: newCreation } }));
      window.dispatchEvent(new CustomEvent('studycloud-creation-status-changed', { detail: { creationId: newCreation.id, status: 'ready', creation: newCreation } }));
      window.dispatchEvent(new CustomEvent('ai-creation-ready', { detail: { creation: newCreation } }));
    }

    return { response: "Création terminée", creation: newCreation };
  };

  const sendMessage = async (textToSend: string, requestedTypeOverride?: string, options?: { isContinuation?: boolean; forceReanalysis?: boolean }) => {
    const userText = (textToSend || '').trim();
    if (!userText) return;

    // Protection anti-rebond et anti-doublon (empêche tout double lancement accidentel par double-clic ou répétition instantanée)
    const now = Date.now();
    if (isChatRequestInFlightRef.current) {
      console.warn('[AssistantChat] Une requête est déjà en cours de traitement, envoi ignoré.');
      return;
    }
    if (userText === lastSendTextRef.current && (now - lastSendTimeRef.current) < 1200) {
      console.warn('[AssistantChat] Double soumission détectée dans un intervalle < 1200ms, envoi ignoré.');
      return;
    }
    lastSendTimeRef.current = now;
    lastSendTextRef.current = userText;
    isChatRequestInFlightRef.current = true;

    // Fixer la conversation cible de manière immuable pour cette requête
    const targetConvId = currentConversationIdRef.current;
    const targetUserId = currentUserId;

    const newUserMsgId = Date.now().toString();
    const newUserMsg: Message = { id: newUserMsgId, text: userText, sender: 'user' };

    // Récupérer les messages existants de la conversation cible (en filtrant toute bulle IA vide)
    let convBaseMessages: Message[] = [];
    if (currentConversationIdRef.current === targetConvId && messagesRef.current.length > 0) {
      convBaseMessages = messagesRef.current.filter(m => !(m.sender === 'ai' && (!m.text || !String(m.text).trim()) && !m.isError));
    } else {
      const local = safeGetItem(`studycloud_conv_msgs_${targetConvId}`);
      if (local) {
        try {
          const parsed = JSON.parse(local) || [];
          convBaseMessages = Array.isArray(parsed)
            ? parsed.filter((m: any) => !(m.sender === 'ai' && (!m.text || !String(m.text).trim()) && !m.isError))
            : [];
        } catch { }
      }
    }

    const directFormatsInText = detectAllCreationFormats(userText, requestedTypeOverride, undefined);
    const detectedFormats = detectAllCreationFormats(userText, requestedTypeOverride, convBaseMessages);
    const isInheritedFromClarification = directFormatsInText.length === 0 && detectedFormats.length > 0;
    const isCreationIntent = detectedFormats.length > 0;
    const detectedFormat = detectedFormats.length > 0 ? detectedFormats[0] : null;
    const effectiveRequestedType = requestedTypeOverride || (isCreationIntent ? (detectedFormat as any) : undefined);
    const isExplicitCreationRequest = isCreationIntent;

    let abortSignal: AbortSignal;
    const controller = new AbortController();
    abortSignal = controller.signal;

    // Réinitialise le défilement pour suivre le nouveau prompt
    isUserScrolledUpRef.current = false;
    setShowScrollBottomBtn(false);

    const aiMsgId = 'ai-msg-' + (Date.now() + 1).toString();
    const creationId = 'crea-' + (Date.now() + 2).toString();
    const initialAiMsg: Message = {
      id: aiMsgId,
      text: '',
      sender: 'ai',
      isStreaming: true,
      model: currentModelDisplay,
    };

    const updatedMessages = [...convBaseMessages, newUserMsg];
    const updatedMessagesWithPending = [...updatedMessages, initialAiMsg];
    safeSetItem(`studycloud_conv_msgs_${targetConvId}`, JSON.stringify(updatedMessages));
    isChatRequestInFlightRef.current = true;

    if (currentConversationIdRef.current === targetConvId) {
      messagesRef.current = updatedMessages;
      setMessages(updatedMessagesWithPending);
      setInputValue('');
      setIsTyping(true);
      setIsWaitingServer(true);
    }

    // Sauvegarde Cloudflare D1 immédiate du message utilisateur (horodatage garanti AVANT l'IA)
    StudyCloudAPI.saveAiMessage({
      id: newUserMsgId,
      conversationId: targetConvId,
      role: 'user',
      content: userText,
      created_at: new Date(Date.now() - 50).toISOString(),
    }).catch(() => { });


    // Détection immédiate hors ligne avant envoi réseau
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      isChatRequestInFlightRef.current = false;
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "Veuillez vérifier que votre appareil est bien connecté à Internet (Wi-Fi ou données mobiles).",
        sender: 'ai',
        isStreaming: false,
        isError: true,
        errorType: 'network',
        retryPrompt: userText,
      };
      const reverted = convBaseMessages.concat([newUserMsg, errorMsg]);
      safeSetItem(`studycloud_conv_msgs_${targetConvId}`, JSON.stringify(reverted));
      if (currentConversationIdRef.current === targetConvId) {
        setIsWaitingServer(false);
        setIsTyping(false);
        setRetryingMessageId(null);
        window.dispatchEvent(new CustomEvent('ai-creation-status-update', {
          detail: { phase: 'idle', isLoading: false, isError: true, resetToPrompts: true }
        }));
        setMessages(reverted);
      }
      return;
    }

    try {
      // 1. Rassemblement et vérification préalable de tous les documents (Actif en Orange + Pièces jointes en Bleu)
      const allDocs: any[] = [];
      const currentActive = resolvedActiveItem;
      if (currentActive && (currentActive.id || currentActive.name || currentActive.title || currentActive.file || currentActive.blob)) {
        allDocs.push({ ...currentActive, isOrangeActive: true });
      }
      if (Array.isArray(attachedResources)) {
        for (const res of attachedResources) {
          if (res) {
            const alreadyIn = allDocs.some(d =>
              (d.id && res.id && d.id === res.id) ||
              (d.name && res.name && d.name === res.name) ||
              (d.title && res.title && d.title === res.title)
            );
            if (!alreadyIn) {
              allDocs.push({ ...res, isOrangeActive: false });
            }
          }
        }
      }

      // Signature stable des médias présents dans ce tour pour la session active
      const currentMediaSignature = allDocs
        .map(getMediaItemSignature)
        .filter(sig => sig && sig !== '::::')
        .sort()
        .join('|');

      // Clé unique liée au userId ET à la conversation active pour une isolation totale par utilisateur
      const convCacheKey = `${currentUserId}_${currentConversationId}`;
      const sessionMediaSig = analyzedMediaPerConvRef.current[convCacheKey];

      // Détection si l'utilisateur demande explicitement une réanalyse, un réexamen, ou une nouvelle inspection
      const isExplicitReanalysisRequested = /(?:r[ée]-?analyse|r[ée]examine|re-?regarde|regarde\s+[àa]\s*nouveau|revois|refais\s+(?:l'|une\s+)?analyse|nouvelle\s+analyse|analyse\s+encore|inspecte\s+[àa]\s*nouveau|relis\s+attentivement|zoom\s+sur|v[ée]rifie\s+[àa]\s*nouveau|autre\s+analyse|analyse\s+compl[èe]te|scanne\s+[àa]\s*nouveau|re-?v[ée]rifie)/i.test(userText);

      // Détection si la demande porte spécifiquement sur des détails visuels nécessitant une observation directe
      const isVisualSpecificDetailRequested = /(?:sch[ée]ma|diagramme|circuit|figure|graphique|dessin|illustration|courbe|tableau\s+visuel|photo|planche|image|fichier|document)/i.test(userText) &&
        /(?:d[ée]tail|zoom|pr[ée]cis|regarde|observe|montre|identifie|lis|d[ée]crit|explique\s+le\s+sch[ée]ma|r[ée]sous\s+avec|d'apr[èe]s\s+le\s+sch[ée]ma|dans\s+l'image|sur\s+la\s+photo|as[- ]tu\s+vu|tu\s+as\s+vu|tu\s+vois|mon\s+image|ma\s+photo|mon\s+fichier|mon\s+document)/i.test(userText);

      // Si la situation ou la question nécessite une nouvelle analyse approfondie
      const requiresFreshAnalysis = Boolean(
        options?.forceReanalysis ||
        isExplicitReanalysisRequested ||
        isVisualSpecificDetailRequested
      );

      let existingPerception = (currentMediaSignature ? cachedPerceptionReportsRef.current[currentMediaSignature] : '') ||
        (currentMediaSignature ? cachedDocumentTextRef.current[currentMediaSignature] : '');

      // Récupération asynchrone sécurisée depuis la base D1 (expire après 30 min) si non présente en mémoire vive
      if (!existingPerception && currentMediaSignature && currentUserId && currentUserId !== 'default-user' && !requiresFreshAnalysis) {
        try {
          const d1Perception = await StudyCloudAPI.getAiFilePerception(currentUserId, currentMediaSignature);
          if (d1Perception) {
            existingPerception = d1Perception;
            cachedPerceptionReportsRef.current[currentMediaSignature] = d1Perception;
          }
        } catch { }
      }

      // Le média est considéré comme déjà analysé UNIQUEMENT si on possède déjà son dossier de perception
      const isMediaAlreadyAnalyzed = Boolean(!requiresFreshAnalysis && currentMediaSignature && (sessionMediaSig === currentMediaSignature || existingPerception) && existingPerception);

      const hasAttachedDoc = allDocs.length > 0;

      // Pré-extraction universelle des médias pour l'Orchestrateur et les sous-agents
      let activeVideoInfo: {
        videoBase64?: string;
        videoFrames: Array<{ base64: string; mimeType: string; timestamp: number }>;
        mimeType: string;
      } | null = null;
      let activeAudioInfo: {
        audioBase64: string;
        mimeType: string;
      } | null = null;
      let activeImageInfo: { base64: string; mimeType: string } | null = null;
      let activeDocumentInfo: {
        textContent: string;
        documentBase64?: string;
        documentMimeType?: string;
        documentImages?: Array<{ base64: string; mimeType: string; name?: string }>;
        fileName?: string;
      } | null = null;

      if (hasAttachedDoc) {
        if (resolvedActiveItem) {
          if (isVideoItem(resolvedActiveItem)) {
            activeVideoInfo = await extractVideoContentFromItem(resolvedActiveItem);
          } else if (isAudioItem(resolvedActiveItem)) {
            activeAudioInfo = await extractAudioContentFromItem(resolvedActiveItem);
          } else if (isDocumentItem(resolvedActiveItem)) {
            // Marquage _needsCanvas : rendu Canvas PDF si le prompt contient des termes visuels ou s'il s'agit d'une création
            const visualTerms = /schéma|schema|figure|graphe|graphique|circuit|dessin|tableau|image|diagramme|courbe|illustration|diagram/i;
            (resolvedActiveItem as any)._needsCanvas = visualTerms.test(userText) || isCreationIntent;
            activeDocumentInfo = await extractDocumentDetails(resolvedActiveItem);
          } else {
            activeImageInfo = await extractImageBase64FromItem(resolvedActiveItem);
          }
        }
        if (Array.isArray(attachedResources) && attachedResources.length > 0) {
          for (const res of attachedResources) {
            if (!activeVideoInfo && isVideoItem(res)) {
              const foundVid = await extractVideoContentFromItem(res);
              if (foundVid) activeVideoInfo = foundVid;
            } else if (!activeAudioInfo && isAudioItem(res)) {
              const foundAud = await extractAudioContentFromItem(res);
              if (foundAud) activeAudioInfo = foundAud;
            } else if (!activeDocumentInfo && isDocumentItem(res)) {
              const visualTerms2 = /schéma|schema|figure|graphe|graphique|circuit|dessin|tableau|image|diagramme|courbe|illustration|diagram/i;
              (res as any)._needsCanvas = visualTerms2.test(userText) || isCreationIntent;
              const foundDoc = await extractDocumentDetails(res);
              if (foundDoc) activeDocumentInfo = foundDoc;
            } else if (!activeImageInfo) {
              const foundImg = await extractImageBase64FromItem(res);
              if (foundImg) activeImageInfo = foundImg;
            }
          }
        }
        if (activeDocumentInfo?.textContent && currentMediaSignature) {
          cachedDocumentTextRef.current[currentMediaSignature] = activeDocumentInfo.textContent;
        }
      }

      const resolvedAttachedText = hasAttachedDoc ? (
        activeDocumentInfo?.textContent ||
        (currentMediaSignature ? cachedDocumentTextRef.current[currentMediaSignature] : '') ||
        (resolvedActiveItem as any)?.content ||
        (resolvedActiveItem as any)?.text ||
        (resolvedActiveItem as any)?.rawText ||
        ''
      ) : '';
      const hasPromptSubject = detectHasSpecificSubject(userText);
      const hasConversationContext = hasRecentAcademicContext(messages);

      // Vérification multi-documents : si l'utilisateur a joint plusieurs fichiers (>= 2)
      const docChoice = detectTargetDocumentChoice(userText, allDocs);
      const hasMultipleDocs = allDocs.length > 1;
      // Si plusieurs documents sont joints et qu'aucun document précis n'est ciblé ni une synthèse globale demandée :
      // On doit demander à l'utilisateur de préciser sur quoi il souhaite travailler !
      const needsMultiDocClarification = hasMultipleDocs && !docChoice.targetedDoc && !docChoice.isAllDocs;

      // Détection d'un document actif ou joint dans l'espace de travail
      const hasRealAttachedDoc = Boolean(
        allDocs.length > 0 ||
        Boolean(resolvedActiveItem) ||
        Boolean(activePreviewItem) ||
        (Array.isArray(attachedResources) && attachedResources.length > 0)
      );

      const hasRealDocContent = Boolean(
        hasRealAttachedDoc && (
          (resolvedAttachedText && resolvedAttachedText.trim().length > 0) ||
          Boolean(activeDocumentInfo?.documentBase64) ||
          Boolean(activeDocumentInfo?.textContent && activeDocumentInfo.textContent.trim().length > 0) ||
          Boolean(activeImageInfo?.base64) ||
          Boolean(activeAudioInfo?.audioBase64) ||
          Boolean(activeVideoInfo?.videoBase64) ||
          Boolean((resolvedActiveItem as any)?.content) ||
          Boolean((resolvedActiveItem as any)?.text) ||
          Boolean((resolvedActiveItem as any)?.rawText) ||
          Boolean(resolvedActiveName && resolvedActiveName.trim().length > 0) ||
          allDocs.length > 0
        )
      );

      // 2. Le prompt contient-il un sujet précis ou un texte de cours collé ?
      const hasPastedCourseContent = userText.trim().length >= 100 && !/^(?:bonjour|salut|peux-tu|fais-moi|crée|conçois)/i.test(userText.trim().slice(0, 15));
      const hasSpecificTopic = hasPromptSubject || hasPastedCourseContent;

      // Contexte éducatif suffisant : document actif/joint OU sujet précis dans le prompt OU contexte de discussion / réponse à clarification
      const isMeaningfulClarificationAnswer = isInheritedFromClarification && userText.trim().length >= 3 && !/^(?:oui|ok|d'accord|vas-y|lance|fais-le)$/i.test(userText.trim());
      const hasEducationalContext = hasRealDocContent || hasSpecificTopic || hasConversationContext || isMeaningfulClarificationAnswer;

      // Si création demandée sans document actif/joint et sans sujet précis : l'IA sélectionnée demandera naturellement de préciser !
      const needsSubjectClarification = isCreationIntent && !hasEducationalContext;

      if (activityTimerRef.current) clearInterval(activityTimerRef.current);
      const startTimestamp = Date.now();
      const activeDocName = resolvedActiveItem?.name || resolvedActiveItem?.title || '';
      const initialDocNames: string[] = activeDocName ? [activeDocName] : [];
      if (Array.isArray(attachedResources)) {
        for (const r of attachedResources) {
          if (r?.name && !initialDocNames.includes(r.name)) initialDocNames.push(r.name);
        }
      }
      const docNames = initialDocNames;
      const attachedFileName = resolvedActiveName || (Array.isArray(attachedResources) ? attachedResources.map((r: any) => r?.name).filter(Boolean).join(', ') : '');
      const mainDocName = hasAttachedDoc ? (resolvedActiveName || (attachedResources[0]?.name) || undefined) : undefined;

      // ══════════════════════════════════════════════════════════════════════════
      // ORCHESTRATION PAR L'IA SÉLECTIONNÉE & POOL DES 3 AGENTS EN PARALLÈLE
      // - Si ce n'est pas une création : l'IA sélectionnée répond directement.
      // - Si c'est une création SANS contexte ni fichier : l'IA sélectionnée demande naturellement à l'étudiant de préciser.
      // - Si c'est une création AVEC contexte ou fichier joint/actif :
      //   1 tâche -> 1 Agent | 2 tâches -> 2 Agents | 3 tâches -> 3 Agents max
      //   4ème tâche et + -> En attente (prise automatiquement dès qu'un agent finit)
      //   Et l'IA sélectionnée vient discuter avec l'utilisateur pendant que les agents travaillent !
      // ══════════════════════════════════════════════════════════════════════════
      let orchestratorMode: '' | 'agents_launched' | 'clarify_subject' | 'clarify_multidoc' = '';
      let orchestratorInstruction = '';
      let hasDispatchedAgents = false;

      const dispatchAgentsForFormats = (
        formatsToDispatch: AiCreationType[]
      ): Array<{ id: string; title: string; toolType: string; formatLabel: string; isQueued: boolean }> => {
        if (hasDispatchedAgents || !Array.isArray(formatsToDispatch) || formatsToDispatch.length === 0) {
          return [];
        }
        hasDispatchedAgents = true;
        orchestratorMode = 'agents_launched';

        const dispatchedTasks: Array<{ id: string; title: string; toolType: string; formatLabel: string; isQueued: boolean }> = [];
        const fmtOccurrences: Record<string, number> = {};
        const fmtTotals: Record<string, number> = {};
        for (const f of formatsToDispatch) {
          fmtTotals[f] = (fmtTotals[f] || 0) + 1;
        }

        for (let idx = 0; idx < formatsToDispatch.length; idx++) {
          const fmt = formatsToDispatch[idx];
          fmtOccurrences[fmt] = (fmtOccurrences[fmt] || 0) + 1;
          const baseFormatTitle = CREATION_NAME_MAP[fmt] || CREATION_FORMAT_LABELS[fmt] || "Support d'apprentissage";
          const formatTitle = fmtTotals[fmt] > 1 ? `${baseFormatTitle} #${fmtOccurrences[fmt]}` : baseFormatTitle;
          const currentCreationId = 'crea-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).slice(2, 6);
          const currentTaskId = 'task-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).slice(2, 6);
          const cTitle = mainDocName ? `${formatTitle} : ${mainDocName}` : `${formatTitle} : ${userText.slice(0, 35).trim() || "Thème d'étude"}`;
          const willQueuePreview = aiBackgroundManager.getRunningCount() >= 3;

          // Notifier immédiatement le menu de droite AVANT d'enfiler pour que la carte apparaisse sans course critique
          window.dispatchEvent(new CustomEvent('studycloud-creation-enqueued', {
            detail: {
              id: currentCreationId,
              conversationId: targetConvId,
              title: cTitle,
              toolType: fmt,
              sourceFileName: mainDocName || undefined,
              createdAt: new Date(Date.now() + idx).toISOString(),
              status: willQueuePreview ? 'queued' : 'generating',
              progressText: willQueuePreview ? 'En attente...' : 'Création en cours...',
              isBackground: !requestedTypeOverride,
            }
          }));

          const enqRes = aiBackgroundManager.enqueueCreationTask({
            taskId: currentTaskId,
            conversationId: targetConvId,
            userId: targetUserId,
            creationId: currentCreationId,
            title: cTitle,
            toolType: fmt,
            prompt: userText,
            mainDocName: mainDocName || undefined,
          }, async () => {
            return await executeCreationApiCall({
              userText,
              targetConvId,
              targetUserId,
              explicitToolType: fmt,
              mainDocName: mainDocName || '',
              creationId: currentCreationId,
              creationTitle: cTitle,
              allDocs,
              messages: updatedMessages,
              selectedModel,
              availableModels,
              currentConversationId: targetConvId,
              sessionCreations,
              resolvedActiveItem,
              attachedResources,
              activePreviewItem,
              currentModelDisplay,
              activeDocumentInfo,
              activeImageInfo,
            });
          });

          dispatchedTasks.push({
            id: currentCreationId,
            title: cTitle,
            toolType: fmt,
            formatLabel: formatTitle,
            isQueued: enqRes.isQueued,
          });
        }

        if (requestedTypeOverride && dispatchedTasks.length === 1 && !dispatchedTasks[0].isQueued) {
          window.dispatchEvent(new CustomEvent('ai-creation-status-update', {
            detail: {
              phase: 'creating',
              isCreating: true,
              isLoading: true,
              isCreation: true,
              toolType: dispatchedTasks[0].toolType,
              statusText: "L'IA conçoit votre support d'apprentissage..."
            }
          }));
        }

        return dispatchedTasks;
      };

      if (isExplicitCreationRequest && detectedFormats.length > 0) {
        const requestedLabels = detectedFormats.map(f => CREATION_NAME_MAP[f] || CREATION_FORMAT_LABELS[f] || f).join(', ');

        if (needsMultiDocClarification) {
          orchestratorMode = 'clarify_multidoc';
          const docList = allDocs.map((d, i) => `${i + 1}. "${d.name || d.title || `Document ${i + 1}`}"`).join(', ');
          orchestratorInstruction = `══════════════════════════════════════════════════════════════════════════════
[ORCHESTRATION : PLUSIEURS DOCUMENTS DÉTECTÉS - PRÉCISION REQUISE] :
L'étudiant souhaite créer : ${requestedLabels}.
Il a actuellement plusieurs documents dans son espace (${docList}) sans avoir précisé sur lequel travailler.
Aucun agent de création n'a encore été lancé.
TA MISSION :
1. Réponds naturellement et chaleureusement avec tes propres mots pour lui demander sur lequel de ces documents il souhaite que tu lances le(s) agent(s) pour concevoir son support (${requestedLabels}), ou s'il préfère une synthèse globale de tous les documents.
2. Termine ta réponse par un bloc [QUESTIONS_SUGGÉRÉES] proposant chaque document en bouton cliquable.
3. N'écris AUCUN bloc JSON.
══════════════════════════════════════════════════════════════════════════════`;
        } else if (needsSubjectClarification) {
          orchestratorMode = 'clarify_subject';
          const suggestions = getSuggestedPromptsForFormat(detectedFormats[0]);
          orchestratorInstruction = `══════════════════════════════════════════════════════════════════════════════
[ORCHESTRATION : AUCUN FICHIER JOINT NI SUJET PRÉCISÉ - DEMANDE DE PRÉCISION PAR L'IA] :
L'étudiant souhaite créer : ${requestedLabels}.
Cependant, aucun fichier n'est actuellement sélectionné ou joint dans l'espace d'étude, et l'étudiant n'a précisé aucun cours, chapitre ou sujet dans son message ni dans la discussion.
Aucun agent de création n'a été lancé pour ne pas créer dans le vide.
TA MISSION :
1. Réponds directement, naturellement et chaleureusement avec tes propres mots pour demander à l'étudiant de préciser sur quel cours, sujet ou chapitre il souhaite créer ce support (${requestedLabels}), ou invite-le à sélectionner/joindre son fichier de cours.
2. Termine ta réponse par le bloc [QUESTIONS_SUGGÉRÉES] avec 3 ou 4 exemples d'idées :
[QUESTIONS_SUGGÉRÉES]
${suggestions.map(s => `- ${s}`).join('\n')}
3. N'écris AUCUN bloc JSON.
══════════════════════════════════════════════════════════════════════════════`;
        } else {
          const dispatchedTasks = dispatchAgentsForFormats(detectedFormats);
          const activeAgentTasks = dispatchedTasks.filter(t => !t.isQueued);
          const queuedAgentTasks = dispatchedTasks.filter(t => t.isQueued);
          const activeListStr = activeAgentTasks.map((t, i) => `Agent ${i + 1} : "${t.formatLabel}" (En cours)`).join(', ');
          const queuedListStr = queuedAgentTasks.length > 0
            ? ` | En file d'attente (démarrage automatique dès qu'un agent termine) : ${queuedAgentTasks.map(t => `"${t.formatLabel}" (En attente)`).join(', ')}`
            : '';

          orchestratorInstruction = `══════════════════════════════════════════════════════════════════════════════
[ORCHESTRATION : LANCEMENT EFFECTIF DES AGENTS DE CRÉATION EN ARRIÈRE-PLAN] :
L'étudiant a demandé ${dispatchedTasks.length} création(s) (${dispatchedTasks.map(t => t.formatLabel).join(', ')}) sur ${mainDocName ? `le document actif « ${mainDocName} »` : `le sujet « ${userText} »`}.
Tu viens de lancer automatiquement les agents spécialisés en arrière-plan (maximum 3 agents en parallèle) :
- Agents au travail maintenant (${activeAgentTasks.length} agent(s)) : ${activeListStr}${queuedListStr}
- L'étudiant voit dès maintenant ces créations marquées "En cours" (et "En attente" le cas échéant) dans son menu "Mes Créations" à droite.
TA MISSION DANS LE CHAT :
1. Réponds directement, naturellement et chaleureusement avec tes propres mots (en 2 à 4 phrases courtes) pour confirmer à l'étudiant que tu viens de lancer ${activeAgentTasks.length === 1 ? "un agent" : `${activeAgentTasks.length} agents en parallèle`} sur ${mainDocName ? `son fichier « ${mainDocName} »` : "son sujet"} pour préparer ${dispatchedTasks.map(t => t.formatLabel).join(' et ')}${queuedAgentTasks.length > 0 ? ` (en précisant que ${queuedAgentTasks.map(t => t.formatLabel).join(', ')} est en attente et sera pris en charge dès qu'un agent aura fini)` : ''}.
2. Dis-lui qu'il peut surveiller l'avancement dans "Mes Créations" et que tu es disponible immédiatement pour continuer à discuter du cours, répondre à ses questions ou lancer d'autres tâches avec lui.
3. INTERDICTION FORMELLE : Ne génère AUCUN bloc JSON et ne rédige PAS le contenu du quiz, de la carte mentale ou du résumé dans le chat ! Les agents en arrière-plan s'en chargent intégralement.
══════════════════════════════════════════════════════════════════════════════`;
        }
      }

      const initialLiveStatus = (requiresFreshAnalysis && hasAttachedDoc
        ? "Nouvelle analyse approfondie en cours..."
        : (isMediaAlreadyAnalyzed
          ? "Je réfléchis à votre question..."
          : getLiveAiActivity(userText, initialDocNames, 0, effectiveRequestedType)));
      setAiActivityText(initialLiveStatus);

      // Mise à jour du titre de conversation si c'est le 1er message
      if (messages.length === 0) {
        const generatedTitle = userText.slice(0, 38).trim() + (userText.length > 38 ? '...' : '');
        setCurrentConversationTitle(generatedTitle);
        StudyCloudAPI.createAiConversation({
          id: currentConversationId,
          userId: currentUserId,
          title: generatedTitle,
        }).then(() => loadConversations()).catch(() => { });
      }

      const isHesitating = /(je ne sais pas|que (peux|doit|puis)-tu|propose|id[eé]es|aide-moi à (choisir|r[eé]viser)|quelles options|que me conseilles-tu|conseille-moi|que faire)/i.test(userText);
      if (isHesitating) {
        setShowProposalBar(true);
      }

      const isExplicitOverride = Boolean(requestedTypeOverride);
      const explicitToolType = requestedTypeOverride as AiCreationType | undefined;

      let systemContent = `Tu es l'intelligence pédagogique centrale autonome de StudyCloud (${currentModelDisplay || 'Agent Delmas'}).
Tu es directement connectée à l'espace d'étude de l'étudiant en mode CHAT, RAISONNEMENT ET ORCHESTRATION PÉDAGOGIQUE DIRECTE.

CONSIGNES STRICTES POUR TA RÉPONSE DE CHAT :
1. Tu réponds DIRECTEMENT, NATURELLEMENT ET CHALEUREUSEMENT à l'étudiant en texte Markdown fluide avec ton propre raisonnement.
2. Si l'étudiant discute, pose une question de cours, demande une explication, une méthode, une formule, ou la résolution pas à pas d'un exercice : réponds avec clarté, bienveillance et rigueur pédagogique complète.
3. Formules mathématiques et scientifiques rédigées impérativement en syntaxe LaTeX standard ($...$ en ligne, $...$ en bloc centré avec \\dfrac{num}{den}).
4. N'inclus JAMAIS de bloc JSON brut dans le chat : toutes les créations de supports interactifs sont gérées par les 3 agents spécialisés en arrière-plan dans "Mes Créations".
5. Parle directement à l'étudiant comme un excellent professeur tuteur.`;

      if (orchestratorInstruction) {
        systemContent += "\n\n" + orchestratorInstruction;
      } else if (hasEducationalContext && !needsMultiDocClarification) {
        systemContent += `\n\n[RÈGLE D'ORCHESTRATION DES AGENTS DE CRÉATION] :
- Si le message de l'étudiant est une question de cours, un exercice à résoudre ou une discussion normale : réponds directement et pédagogiquement sans parler de création.
- Si l'étudiant te demande de créer un ou plusieurs supports interactifs (Carte Mentale, Questionnaire QCM, Questionnaire Test, Vrai ou Faux, Vrai ou Faux Test, Cartes Mémoires, Fiche de Résumé / Révision, Exercices Écrits, Devoir Complet, Infographie, Document PDF), confirme-lui chaleureusement le lancement de ses supports sur ${mainDocName ? `son document actif « ${mainDocName} »` : 'son sujet'} et ajoute OBLIGATOIREMENT à la toute fin de ta réponse la balise :
[LANCER_AGENTS: format1, format2]
(valeurs possibles : carte-mentale, carte-mentale-2, questionnaire, questionnaire-test, vrai-ou-faux, vrai-ou-faux-test, carte-memoire, resume, exercices-ecrits, devoir-complet, infographie, pdf).`;
      }

      systemContent += `\n\nRÈGLES D'EXCELLENCE POUR LA MISE EN PAGE, LES TITRES ET LES FRACTIONS :
0. LANGUE FRANÇAISE STRICTE ET ZÉRO MONOLOGUE INTERNE (ANTI-SCRATCHPAD) :
   - TU RÉPONDS EXCLUSIVEMENT ET TOTALEMENT EN FRANÇAIS SOIGNÉ, CLAIR ET PÉDAGOGIQUE.
   - IL EST STRICTEMENT INTERDIT D'ÉCRIRE EN ANGLAIS ET D'AFFICHER UN MONOLOGUE DE RÉFLEXION INTERNE, DU BRAINSTORMING OU UN BROUILLON ('Let's think', 'Waitcheck', 'The figure caption text', 'Hmm', 'Actually', etc.).
   - NE DIVAGUE PAS. DONNE DIRECTEMENT LA RÉPONSE PÉDAGOGIQUE COMPLÈTE ET STRUCTURÉE POUR L'ÉTUDIANT.
   - AÈRE AU MAXIMUM : GRANDS TITRES (#, ##, ###), DOUBLES SAUTS DE LIGNE ENTRE CHAQUE ÉTAPE, ET FORMULES ISOLÉES EN BLOC $$ ... $$.

1. INTERDICTION FORMELLE D'ÉCRIRE DES FRACTIONS AVEC LE SLASH '/' :
   - IL EST STRICTEMENT INTERDIT d'écrire des fractions sous la forme a/b ou 1/√(LC) ou A0 = -R2/R1 ou (1/Q0)(p/w0).
   - TOUTE fraction mathématique ou scientifique DOIT IMPÉRATIVEMENT être écrite sous forme de vraie fraction verticale avec \\dfrac{numérateur}{dénominateur} :
     * Le numérateur en haut,
     * La barre horizontale nette au milieu,
     * Le dénominateur en bas.
   - Exemples obligatoires :
     * JAMAIS : w0 = 1/√(LC)  --> TOUJOURS : $$ \\omega_0 = \\dfrac{1}{\\sqrt{LC}} $$
     * JAMAIS : f0 = 1/(2π√(LC)) --> TOUJOURS : $$ f_0 = \\dfrac{1}{2\\pi \\sqrt{LC}} $$
     * JAMAIS : Q0 = Lw0/R1 --> TOUJOURS : $$ Q_0 = \\dfrac{L\\omega_0}{R_1} = \\dfrac{1}{R_1 C \\omega_0} = \\dfrac{1}{R_1}\\sqrt{\\dfrac{L}{C}} $$
     * JAMAIS : A0 = -R2/R1 --> TOUJOURS : $$ A_0 = -\\dfrac{R_2}{R_1} $$
     * JAMAIS : T(p) = -R2 C p / [...] --> TOUJOURS : $$ T(p) = \\dfrac{-R_2 C p}{1 + \\dfrac{1}{Q_0}\\dfrac{p}{\\omega_0} + \\left(\\dfrac{p}{\\omega_0}\\right)^2} $$
   - Utilise TOUJOURS les symboles scientifiques corrects : \\omega_0 (jamais w0), \\pi (jamais pi), \\tau, \\alpha, \\beta, \\Omega.

2. STRUCTURE AÉRÉE, GRANDS TITRES ET MISE EN VALEUR :
   - Structure TOUJOURS ta réponse avec des grands titres clairs (# Grand Titre pour le sujet, ## Titre pour chaque question ou étape majeure, ### Sous-titre).
   - Sépare clairement chaque question ou étape (ex: ## Question 5 : Expressions canoniques de A₀, f₀, Q₀).
   - Fais de VRAIS sauts de ligne doubles entre chaque paragraphe ou étape pour que le texte ne soit JAMAIS compacté ni groupé.
   - Pour chaque formule majeure, écris-la isolée sur sa propre ligne entre doubles dollars $$ ... $$ pour qu'elle s'affiche en grand, centrée et aérée.
   - Encadre systématiquement le résultat final de chaque question avec \\boxed{...} dans un bloc centré $$ \\boxed{...} $$.
   - Souligne les concepts essentiels avec **gras** ou \\underline{...}.

3. GESTION DES EXERCICES LONGS ET DÉCOUPAGE PÉDAGOGIQUE INTELLIGENT (ZÉRO COUPURE BRUTALE) :
   - Tu dois TOUT FAIRE et résoudre le sujet avec une rigueur absolue.
   - SI L'EXERCICE OU LA DÉMONSTRATION EST PARTICULIÈREMENT LONGUE OU DENSE (plusieurs questions successives, gros calculs) :
     * Résous méthodiquement les étapes ou questions en cours jusqu'au bout, avec leurs résultats intermédiaires encadrés dans \\boxed{...}.
     * NE TE COUPE JAMAIS EN PLEIN MILIEU d'une équation ou d'une phrase !
     * Si une étape/question importante est achevée et que la suite risque d'être trop lourde ou volumineuse pour un seul message, ARRÊTE-TOI AU BON MOMENT à la fin de cette étape propre.
     * Demande alors clairement à l'étudiant : "Voulez-vous que je poursuive avec la question suivante / la suite de la démonstration ?"
   - SI L'ÉTUDIANT RÉPOND "OUI", "CONTINUE", OU DEMANDE LA SUITE :
     * Enchaîne IMMÉDIATEMENT avec la suite exacte (les questions suivantes ou la seconde partie de la démonstration), sans répéter ce qui a déjà été expliqué.

4. SCHÉMAS, CIRCUITS ET DESSINS VECTORIELS (DESSINER SI NÉCESSAIRE) :
   - Si la résolution ou l'explication concerne un circuit électronique (ex: AOP, filtre RLC, quadripôle, pont diviseur), un repère géométrique, un signal ou un schéma bloc :
     DESSINE-LE DIRECTEMENT sous forme de schéma vectoriel SVG propre et net dans un bloc de code \`\`\`svg ... \`\`\` :
     * Utilise une balise <svg viewBox="0 0 550 250" xmlns="http://www.w3.org/2000/svg" className="w-full">
     * Style moderne et sombre : fond sombre (#0d0f17) ou transparent, traits en orange (#f97316) ou cyan (#38bdf8), textes lisibles en blanc (#f3f4f6) avec font-size adaptée.
     * Indique clairement les composants (Ve, Vs, R1, R2, C, L, noeuds, masse GND, entrées + et - de l'AOP).

5. DÉCISION AUTONOME SUR LES QUESTIONS SUGGÉRÉES (PROPOSITIONS SOUS FORME DE CARTES BOUTONS) :
   - À la fin d'un problème, exercice, démonstration ou situation, C'EST TOI L'IA QUI DÉCIDES AUTONOMEMENT s'il est pertinent de suggérer des questions de prolongement ou d'approfondissement à l'étudiant.
   - Si tu juges pertinent d'en proposer (et uniquement quand la situation s'y prête bien), ajoute à la toute fin de ta réponse le bloc :
[QUESTIONS_SUGGÉRÉES]
- Question ou piste de calcul 1
- Question ou piste de calcul 2
- Question ou piste de calcul 3
   Ces questions seront automatiquement transformées en boutons carrés cliquables pour l'étudiant. Si la situation ne nécessite aucun prolongement, ne mets pas ce bloc.

6. STRUCTURATION STRICTE, ALINÉAS ET SÉPARATION DES COMMENTAIRES :
   - NE CONFONDS JAMAIS les commentaires avec les calculs ou les explications théoriques !
   - EXPLICATIONS : Rédige des phrases claires et aérées avec de grands titres (#, ##, ###).
   - ALINÉAS : Pour les sous-questions ou sous-étapes, utilise systématiquement des alinéas avec 'a) ', 'b) ', 'c) ' ou '1) ', '2) ' pour que chaque étape soit bien indentée et aérée.
   - CALCULS PURS : Isole chaque formule majeure dans un bloc centré $$ ... $$ avec \\dfrac{}{} et le résultat final encadré dans $$ \\boxed{...} $$.
   - COMMENTAIRES ET REMARQUES : Mets TOUJOURS tes commentaires, observations physiques, astuces ou conseils sous la forme :
> **Remarque :** Ton commentaire méthodologique ici.
ou
> **Note :** Ta note de vigilance ici.
   Ils seront ainsi isolés dans un encadré distinct bleu ciel sans jamais se mélanger aux calculs.
- DANS LES CRÉATIONS (Questionnaires, QCM, Cartes, Exercices) : Toute formule dans l'énoncé et dans CHAQUE option de réponse DOIT impérativement être entourée de dollars, par exemple : "$T(j\\omega) = \\dfrac{T_0}{1 + j\\dfrac{\\omega}{\\omega_0}}$".

6.bis RÉSOLUTION COMPLÈTE ET DIRECTE DES EXERCICES SUR IMAGES ET DOCUMENTS (ANTI-SURVOL & ZÉRO FUITE D'OUTILS) :
   - Quand l'étudiant demande de résoudre un exercice (qu'il provienne d'une image, d'un devoir ou d'un document) :
     * IL EST STRICTEMENT INTERDIT de te contenter de lister des étapes théoriques ou d'expliquer la méthode de loin sans résoudre ("Étape 1 : poser la formule...").
     * TU DOIS RÉSOUDRE EFFECTIVEMENT ET COMPLÈTEMENT CHAQUE QUESTION : énonce la formule, remplace par les vraies valeurs numériques de l'exercice, mène le calcul jusqu'au bout et encadre impérativement le résultat final avec unité : $$ \\boxed{\\text{Résultat avec unité}} $$.
     * IL EST FORMELLEMENT INTERDIT de mentionner des termes techniques internes tels que "outil de vision", "expert vision", "rapport OCR", etc. Parle directement à l'étudiant comme un professeur qui a sa feuille d'exercice sous les yeux ("Sur ton image...", "Pour l'exercice 1 :", etc.).

7. RÈGLE FONDAMENTALE DE DÉCISION — OBLIGATION D'UN SUJET D'ÉTUDE POUR TOUTE CRÉATION :
   - IL EST STRICTEMENT INTERDIT de concevoir ou créer un module d'apprentissage (QCM, carte mentale, résumé, devoir, flashcards, exercices, infographie, etc.) « DANS LE VIDE », sans sujet, sans cours, ou sans contexte !
   - Si l'étudiant te demande une création (ou a cliqué sur un bouton de création) MAIS qu'il n'a joint AUCUN document, n'a précisé AUCUN sujet de cours dans son message, ET que la discussion précédente ne porte sur aucun sujet d'étude précis :
     -> TU NE DOIS EN AUCUN CAS PRODUIRE D'OBJET JSON DE CRÉATION NI CRÉER DANS LE VIDE.
     -> TU DOIS IMPÉRATIVEMENT L'INTERPELLER DANS LE CHAT en lui demandant avec bienveillance d'indiquer la matière ou le chapitre précis qu'il souhaite réviser, ou de joindre son fichier de cours.
     -> TU DOIS OBLIGATOIREMENT terminer ta réponse par le bloc [QUESTIONS_SUGGÉRÉES] avec 4 exemples concrets de prompts de création portant sur des matières variées (Maths, Physique, SVT, Informatique, etc.) sous forme de boutons cliquables.

7.bis GESTION DES DOCUMENTS JOINTS/ACTIFS (1 DOCUMENT VS PLUSIEURS DOCUMENTS) :
   - RÈGLE ABSOLUE SI 1 SEUL DOCUMENT EST JOINT OU ACTIF :
     -> Lorsque l'étudiant a 1 seul document sélectionné ou joint dans son espace (ex: PDF, Word, image), IL EST STRICTEMENT INTERDIT de lui demander sur quel document, cours ou chapitre il souhaite travailler !
     -> Toute demande de l'étudiant porte AUTOMATIQUEMENT et DIRECTEMENT sur ce document unique joint/actif.
   - Si l'étudiant a joint PLUSIEURS documents distincts (>= 2) et que sa demande est générale ou non ciblée sur un fichier précis :
     -> Ne choisis pas un document au hasard et ne produis pas de création confuse à l'aveugle.
     -> Présente brièvement les documents joints et demande-lui clairement dans le chat sur quel document il souhaite se concentrer, ou s'il préfère une synthèse globale croisée de l'ensemble des documents.
     -> Termine OBLIGATOIREMENT par le bloc [QUESTIONS_SUGGÉRÉES] proposant chaque document en bouton cliquable direct.
   - UNIQUEMENT SI AUCUN DOCUMENT N'EST JOINT (0 document) et qu'aucun sujet n'est précisé dans le message ni dans la conversation :
     -> Pose des questions de clarification pédagogiques et propose 3 à 4 options d'angles d'attaque claires sous [QUESTIONS_SUGGÉRÉES].`;

      if (docNames.length > 0) {
        systemContent += `\n\nDOCUMENTS FOURNIS PAR L'ÉTUDIANT :\nL'utilisateur a ouvert ${docNames.length} document(s) d'étude : ${docNames.map(n => `"${n}"`).join(', ')}. Tu as un accès direct et complet au contenu textuel de ces documents.${docNames.length === 1 ? ` Ce document unique (« ${docNames[0]} ») est la source directe de travail : ne demande JAMAIS à l'étudiant de confirmer s'il veut travailler dessus.` : ''}`;
      }

      const isContinuation = Boolean(
        options?.isContinuation ||
        /^(?:oui\s*,?\s*)?(?:continue|la suite|poursuis|poursuivre|encha[îi]ne|suite\s+s'il\s+te\s+pla[îi]t)/i.test(userText)
      );

      // 4. Préparation et sanitarisation de l'historique complet pour garantir une alternance user <-> assistant
      const sanitizedHistory: Array<{ role: string; content: string }> = [];
      const recentMsgs = updatedMessages.slice(-20);
      for (let i = 0; i < recentMsgs.length; i++) {
        const m = recentMsgs[i];
        if (!m || !m.text) continue;
        const role = m.sender === 'user' ? 'user' : 'assistant';
        const lastInHistory = sanitizedHistory[sanitizedHistory.length - 1];

        if (lastInHistory && lastInHistory.role === role) {
          if (role === 'user') {
            // L'étudiant a enchaîné ou interrompu une consigne par une nouvelle : on retient la consigne active
            lastInHistory.content = m.text;
          } else {
            lastInHistory.content = `${lastInHistory.content}\n\n${m.text}`;
          }
        } else {
          sanitizedHistory.push({ role, content: m.text });
        }
      }

      let effectiveSystemContent = systemContent;

      if (hasAttachedDoc && requiresFreshAnalysis && mainDocName) {
        effectiveSystemContent += `\n\n══════════════════════════════════════════════════════════════════════════════
[NOUVELLE ANALYSE APPROFONDIE DU FICHIER « ${mainDocName} » DEMANDÉE] :
L'étudiant a formulé une consigne nécessitant une NOUVELLE analyse minutieuse (ou réexamen visuel ciblé) du document « ${mainDocName} ».
Observe et inspecte à nouveau avec une attention maximale tous les éléments demandés (texte, formules, schémas, graphiques, figures ou audio/vidéo).
Réponds précisément et rigoureusement avec bienveillance et clarté.
══════════════════════════════════════════════════════════════════════════════`;
      } else if (hasAttachedDoc && isMediaAlreadyAnalyzed && mainDocName) {
        effectiveSystemContent += `\n\n══════════════════════════════════════════════════════════════════════════════
[SUITE DE DISCUSSION SUR LE FICHIER « ${mainDocName} » DÉJÀ ANALYSÉ] :
Tu as DÉJÀ analysé et assimilé le document/média « ${mainDocName} » lors du premier tour de cette discussion.
Voici ce qui a été observé et extrait de ce fichier :
${existingPerception}

CONSIGNES STRICTES :
1. RÉPONSE DIRECTE ET IMMÉDIATE :
   - Réponds directement, précisément et pédagogiquement à la question de l'étudiant.
   - Si l'élève te demande si tu as vu son image, sa photo ou son document (ex: "Tu as vu mon image ?"), réponds OUI IMMÉDIATEMENT et cite les éléments précis visibles sur l'image ci-dessus ! Ne dis JAMAIS que tu ne vois pas d'image.
   - Ne dis JAMAIS "Bonjour", "D'après votre document", "J'ai bien reçu votre fichier", ou toute formule d'introduction robotique.
   - Ne réanalyse pas le document depuis le début.
2. DIALOGUE NATUREL :
   - Poursuis la discussion de manière fluide comme un professeur bienveillant qui est déjà en train de travailler sur le cours avec son élève.
══════════════════════════════════════════════════════════════════════════════`;
      } else if (hasAttachedDoc && mainDocName) {
        effectiveSystemContent += `\n\n══════════════════════════════════════════════════════════════════════════════
[NOUVEAU DOCUMENT ATTACHÉ PAR L'ÉTUDIANT : « ${mainDocName} »] :
L'étudiant vient d'attacher ou de changer de document pour travailler sur « ${mainDocName} ».
CONSIGNES STRICTES :
1. RUPTURE NETTE AVEC LES ANCIENS SUJETS OU ANCIENNES IMAGES :
   - Concentre-toi EXCLUSIVEMENT sur ce nouveau document (« ${mainDocName} »).
   - Ne mentionne plus aucune ancienne image ou ancien sujet évoqué plus haut dans l'historique.
2. RÉPONSE DIRECTE ET IMMÉDIATE :
   - Réponds directement et précisément à la question de l'élève à propos de ce document « ${mainDocName} ».
   - Ne dis JAMAIS que tu ne vois pas d'image ou de document. Le document est actif à l'écran.
   - Ne demande JAMAIS de renvoyer le document.
══════════════════════════════════════════════════════════════════════════════`;
      } else if (!hasAttachedDoc) {
        effectiveSystemContent += `\n\n══════════════════════════════════════════════════════════════════════════════
[AUCUN DOCUMENT OU FICHIER JOINT DANS CETTE DISCUSSION] :
L'étudiant n'a joint AUCUN document, AUCUN fichier, et AUCUNE image dans cette discussion.
CONSIGNES STRICTES :
1. NE DIS JAMAIS et N'AFFIRME JAMAIS que tu as un document ou un fichier sous les yeux, que tu analyses un document, ou que tu as reçu un "Document d'étude".
2. Ne fais référence à aucun document imaginaire et n'utilise pas de formule comme "d'après ton document".
3. Réponds directement, naturellement et pédagogiquement à l'étudiant en te basant sur son message.
══════════════════════════════════════════════════════════════════════════════`;
      }

      if (isContinuation) {
        const lastAssistant = sanitizedHistory.slice().reverse().find(m => m.role === 'assistant');
        const stopExcerpt = lastAssistant ? lastAssistant.content.slice(-400) : '';

        effectiveSystemContent += `\n\n══════════════════════════════════════════════════════════════════════════════
[ORDRE DE CONTINUATION DIRECTE - STRICT ET NON NÉGOCIABLE] :
L'étudiant a cliqué sur "Poursuivre la suite" pour continuer ta réponse précédente.
Tu as DÉJÀ rédigé la première partie dans le message précédent (fin du message précédent : "...${stopExcerpt.replace(/\n+/g, ' ')}").

CONSIGNES STRICTES DE CONTINUATION :
1. INTERDICTION FORMELLE DE RECOMMENCER DU DÉBUT :
   - Ne dis JAMAIS "Bonjour", ne présente pas le cours, ne réanalyse pas le document depuis le début.
   - Ne répète AUCUNE des questions, formules ou explications déjà fournies plus haut.
2. ENCHAÎNEMENT DIRECT ET IMMÉDIAT :
   - Reprends EXACTEMENT là où s'arrête ton message précédent.
   - Si tu t'es arrêté après la Question 2, commence DIRECTEMENT par "## Question 3 : ...".
   - Si tu étais au milieu d'un calcul ou d'une démonstration, poursuis immédiatement les étapes suivantes.
3. COMMENCE DIRECTEMENT PAR LE CONTENU UTILE :
   - La toute première ligne de ta réponse doit être le titre ou la formule de la suite immédiate (ex: "## Question 3 : ..."). Zéro bavardage préliminaire.
4. COHÉRENCE TOTALE :
   - Utilise les mêmes notations, les mêmes variables et les résultats déjà établis précédemment sans les recalculer.
══════════════════════════════════════════════════════════════════════════════`;
      }

      // Injection de la mémoire des créations enregistrées strictement issues de CETTE session de conversation
      let relevantCreations: AiCreation[] = sessionCreations;
      if (!relevantCreations || relevantCreations.length === 0) {
        try {
          const rawLocal = safeGetItem(`studycloud_conv_creations_${currentConversationId}`);
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (Array.isArray(parsed)) relevantCreations = parsed;
          }
          if (!relevantCreations || relevantCreations.length === 0) {
            const genCache = safeGetItem('studycloud_saved_creations_cache');
            if (genCache) {
              const list = JSON.parse(genCache);
              if (Array.isArray(list)) {
                relevantCreations = list.filter((c: any) => c.conversationId === currentConversationId);
              }
            }
          }
        } catch { }
      }

      if (relevantCreations && relevantCreations.length > 0) {
        const formattedCreationsContext = formatCreationsSummaryForPrompt(relevantCreations);
        effectiveSystemContent += `\n\n══════════════════════════════════════════════════════════════════════════════
[MÉMOIRE DES CRÉATIONS ENREGISTRÉES DANS CETTE CONVERSATION (SESSION : ${currentConversationId})] :
Tu as un accès exclusif aux modules et contenus pédagogiques déjà générés et enregistrés dans la base de données au cours de CETTE session de conversation actuelle :

${formattedCreationsContext}

DIRECTIVES STRICTES DE NON-RÉPÉTITION ET DE RENOUVELLEMENT :
1. PÉRIMÈTRE STRICT À CETTE CONVERSATION :
   Tu as UNIQUEMENT accès aux créations de cette conversation ci-dessus. Aucune création d'une autre discussion ne doit interférer.
2. INTERDICTION FORMELLE DE RÉPÉTER LES MÊMES CRÉATIONS OU LES MÊMES QUESTIONS :
   Si l'utilisateur te demande à nouveau une création (ex: nouveau questionnaire, autre QCM, nouvelles cartes mémoires, autre carte mentale, nouveaux exercices, nouveau résumé, etc.) sur le même cours, le même document ou le même sujet :
   - TU NE DOIS EN AUCUN CAS RÉPÉTER LES MÊMES QUESTIONS, LES MÊMES ITEMS OU LES MÊMES ÉNONCÉS que ceux listés ci-dessus.
   - L'utilisateur ne doit JAMAIS recevoir un questionnaire ou un module identique ou redondant.
3. EXPLORATION DE NOUVELLES INFORMATIONS ET FORMULATION DE NOUVELLES IDÉES :
   - Va chercher d'autres éléments dans le document ou cours : d'autres notions, théorèmes, définitions, cas particuliers, démonstrations, schémas ou exemples d'application qui n'ont pas encore été interrogés.
   - Formule des questions sous de nouveaux angles (ex: questions d'analyse, cas limites, pièges courants, calculs inverses, applications concrètes).
4. RÈGLE PÉDAGOGIQUE DES 1 À 2 QUESTIONS DE RAPPEL (MÉMORISATION ESPACÉE) :
   - Pour favoriser l'ancrage mémoriel et la rétention, tu peux réintégrer AU MAXIMUM 1 ou 2 questions clés de rappel issues des créations précédentes.
   - TOUT LE RESTE DU QUESTIONNAIRE OU DU MODULE (80% à 90% minimum) DOIT ÊTRE ENTIÈREMENT NOUVEAU ET INÉDIT.
5. APPLICATION UNIFORME À TOUS LES TYPES DE CRÉATION :
   - QCM / Questionnaire : Nouvelles questions avec nouveaux choix et nouvelles explications (max 1-2 questions de révision).
   - Vrai ou Faux : Nouvelles affirmations explorant d'autres nuances ou pièges du cours.
   - Flashcards : Nouveaux termes, formules et notions du cours pas encore synthétisés.
   - Carte Mentale : Développer d'autres branches, sous-branches plus fines ou perspectives transversales.
   - Résumé : Mettre l'accent sur d'autres chapitres, sections ou subtilités du cours.
   - Exercices Écrits / Devoirs : Nouveaux énoncés d'exercices, nouvelles données numériques et cas d'application originaux.
══════════════════════════════════════════════════════════════════════════════`;
      }

      const chatHistory = [
        { role: 'system', content: effectiveSystemContent },
        ...sanitizedHistory,
      ];

      // 5. Appel au moteur d'IA officiel StudyCloud (Multimodal Gemini 2.0 Flash conforme Google Cookbook)
      const selectedModelObj = availableModels.find(m => m.id === selectedModel || m.model_id === selectedModel);
      const rawConfiguredToken = selectedModelObj?.api_token;
      // Pour les modèles Worker Cloudflare (Gemini 2.0 Flash) ou clés compromises, ne pas envoyer de token obsolète
      const isWorkerModel = selectedModel === 'gemini-2.0-flash' || selectedModelObj?.provider === 'cloudflare';
      const isDeadKey = Boolean(rawConfiguredToken && (rawConfiguredToken.startsWith('AIzaSyDKct') || rawConfiguredToken.length < 25));
      const configuredToken = (isWorkerModel || isDeadKey) ? undefined : rawConfiguredToken;

      // Les médias (Vidéo, Audio, Image ou Document PDF/Word) ont déjà été pré-extraits en amont dans ce même appel.
      const hasMedia = Boolean(
        activeImageInfo ||
        (activeVideoInfo && (activeVideoInfo.videoFrames.length > 0 || activeVideoInfo.videoBase64)) ||
        (activeAudioInfo && activeAudioInfo.audioBase64) ||
        (activeDocumentInfo && (activeDocumentInfo.documentBase64 || (activeDocumentInfo.documentImages && activeDocumentInfo.documentImages.length > 0)))
      );
      // Le modèle sélectionné par l'utilisateur répond directement dans son propre style.
      const effectiveModelToSend = selectedModel;

      const detectedMediaType = activeVideoInfo ? 'video' : (activeAudioInfo ? 'audio' : (activeImageInfo ? 'image' : 'document'));

      const shouldSendRawDocBase64 = Boolean(
        hasAttachedDoc &&
        activeDocumentInfo?.documentBase64 &&
        (!resolvedAttachedText || resolvedAttachedText.trim().length < 120 || requiresFreshAnalysis)
      );

      const aiResult = await sendChatMessageToAi({
        messages: chatHistory,
        prompt: userText,
        message: userText,
        userId: targetUserId,
        sessionId: targetConvId,
        conversationId: targetConvId,
        userMsgId: newUserMsgId,
        aiMsgId,
        creationId,
        model: effectiveModelToSend,
        selectedModel: effectiveModelToSend,
        isContinuation,
        is_continuation: isContinuation,
        apiKey: configuredToken || getGeminiApiKey() || undefined,
        apiToken: configuredToken || undefined,
        geminiApiKey: configuredToken || getGeminiApiKey() || undefined,
        requested_type: undefined,
        isOrchestratorChat: Boolean(orchestratorMode),
        orchestratorMode: orchestratorMode || undefined,
        orchestratorInstruction: orchestratorInstruction || undefined,
        attachedFileName: hasAttachedDoc ? mainDocName : undefined,
        attachedFileContent: hasAttachedDoc ? resolvedAttachedText : undefined,
        perceptionReport: hasAttachedDoc ? (existingPerception || undefined) : undefined,
        imageBase64: hasAttachedDoc ? activeImageInfo?.base64 : undefined,
        mimeType: hasAttachedDoc ? activeImageInfo?.mimeType : undefined,
        videoBase64: hasAttachedDoc ? activeVideoInfo?.videoBase64 : undefined,
        videoFrames: hasAttachedDoc ? activeVideoInfo?.videoFrames : undefined,
        videoMimeType: hasAttachedDoc ? activeVideoInfo?.mimeType : undefined,
        audioBase64: hasAttachedDoc ? activeAudioInfo?.audioBase64 : undefined,
        audioMimeType: hasAttachedDoc ? activeAudioInfo?.mimeType : undefined,
        documentBase64: shouldSendRawDocBase64 ? activeDocumentInfo?.documentBase64 : undefined,
        documentMimeType: shouldSendRawDocBase64 ? activeDocumentInfo?.documentMimeType : undefined,
        documentImages: hasAttachedDoc ? activeDocumentInfo?.documentImages : undefined,
        mediaType: hasAttachedDoc ? detectedMediaType : undefined,
        signal: abortSignal,
        abortSignal,
      });

      // Si cette requête a été annulée
      if (abortSignal.aborted) {
        isChatRequestInFlightRef.current = false;
        if (currentConversationIdRef.current === targetConvId) {
          setIsWaitingServer(false);
          setIsTyping(false);
          setRetryingMessageId(null);
          window.dispatchEvent(new CustomEvent('ai-creation-status-update', { detail: { phase: 'idle', isLoading: false, isCancelled: true, resetToPrompts: false } }));
        }
        return;
      }

      // Enregistrement de la perception dans Cloudflare D1 avec TTL 30 min (Zéro localStorage)
      if (currentMediaSignature && hasAttachedDoc) {
        if (aiResult?.perceptionReport) {
          cachedPerceptionReportsRef.current[currentMediaSignature] = aiResult.perceptionReport;
          StudyCloudAPI.saveAiFilePerception({
            userId: currentUserId,
            fileSignature: currentMediaSignature,
            fileName: mainDocName || 'Document d\'étude',
            perceptionReport: aiResult.perceptionReport
          }).catch(err => console.warn('[AssistantChat] Erreur sauvegarde perception D1:', err));
        }
        analyzedMediaPerConvRef.current[convCacheKey] = currentMediaSignature;
      }

      const fullAiText = (aiResult as any).raw_response || (aiResult as any).rawResponse || aiResult.response || "Désolé, je n'ai pas pu obtenir de réponse.";
      const rawResponseText = fullAiText;
      setIsWaitingServer(false);
      setRetryingMessageId(null);

      let fullResponseText = aiResult.response || rawResponseText;
      fullResponseText = cleanTechnicalMediaJargon(fullResponseText)
        .replace(/(?:grâce à|via|selon|d'après|avec)\s+l'outil\s+de\s+vision/gi, "d'après votre document")
        .replace(/l'outil\s+de\s+vision\s+(?:a\s+extrait|montre|indique|permet\s+de)/gi, "l'analyse visuelle montre")
        .replace(/vous\s+pouvez\s+utiliser\s+l'outil\s+de\s+vision\s*(?:pour[^.\n]*)?[.]?/gi, "")
        .replace(/l'outil\s+de\s+vision/gi, "l'analyse multimédia")
        .replace(/expert\s+vision/gi, "l'analyse multimédia")
        .replace(/rapport\s+(?:ocr|vision|d'extraction)/gi, "énoncé");

      // 6. L'IA CHEF D'ORCHESTRE AUTONOME : DÉCISION DE L'IA ENTRE CHAT ET CRÉATION
      const hasCreationClues = Boolean(
        aiResult.mode === 'creation' ||
        (aiResult.creation_type && aiResult.creation_data) ||
        (isExplicitOverride && explicitToolType) ||
        /"decision"\s*:\s*"creation"/i.test(fullAiText) ||
        /"creation_data"/i.test(fullAiText) ||
        /<creation/i.test(fullAiText)
      );

      let creationParsed: any = null;
      let companionChatMessage = '';

      if (aiResult.creation_data) {
        window.dispatchEvent(new CustomEvent('ai-creation-status-update', {
          detail: {
            phase: 'creating',
            isCreating: true,
            isLoading: true,
            isCreation: true,
            statusText: "Création en cours...",
            toolType: aiResult.creation_type || explicitToolType
          }
        }));
        let normType = normalizeCreationType(aiResult.creation_type || explicitToolType || 'questionnaire');
        if (explicitToolType && (explicitToolType.includes('vrai') || explicitToolType.includes('faux'))) {
          normType = explicitToolType.includes('test') ? 'vrai-ou-faux-test' : 'vrai-ou-faux';
        }
        let finalContent = aiResult.creation_data;
        if (normType === 'resume') {
          const rObj = finalContent?.summary || finalContent?.creation_data || finalContent;
          finalContent = {
            title: rObj.title || aiResult.creation_title || `Fiche de Résumé : ${mainDocName}`,
            theme: rObj.theme || rObj.domaine || '',
            overview: typeof rObj.overview === 'string' && !/^(?:j'ai\s+con[çc]u|j'ai\s+cr[ée][ée]|voici\s+votre|✨)/i.test(rObj.overview.trim()) ? rObj.overview : '',
            key_definitions: Array.isArray(rObj.key_definitions) ? rObj.key_definitions : (Array.isArray(rObj.definitions) ? rObj.definitions : []),
            formulas: Array.isArray(rObj.formulas) ? rObj.formulas : [],
            comparison_table: rObj.comparison_table || null,
            traps_and_tips: Array.isArray(rObj.traps_and_tips) ? rObj.traps_and_tips : [],
            practical_example: rObj.practical_example || null,
            sections: Array.isArray(rObj.sections) ? rObj.sections : [],
            markdown: typeof rObj.markdown === 'string' ? rObj.markdown : '',
          };
        } else if (normType === 'vrai-ou-faux' || normType === 'vrai-ou-faux-test') {
          const rawAffs = Array.isArray(finalContent)
            ? finalContent
            : (finalContent?.affirmations || finalContent?.questions || finalContent?.items || finalContent?.statements || finalContent?.data);
          if (Array.isArray(rawAffs) && rawAffs.length > 0) {
            finalContent = {
              affirmations: rawAffs.slice(0, 18).map((a: any, idx: number) => {
                let isTrue = true;
                if (typeof a.is_true === 'boolean') isTrue = a.is_true;
                else if (typeof a.isTrue === 'boolean') isTrue = a.isTrue;
                else if (typeof a.reponse === 'boolean') isTrue = a.reponse;
                else if (typeof a.correctAnswer === 'boolean') isTrue = a.correctAnswer;
                else if (typeof a.is_true === 'string') isTrue = a.is_true.toLowerCase() === 'true' || a.is_true.toLowerCase() === 'vrai';
                else if (typeof a.isTrue === 'string') isTrue = a.isTrue.toLowerCase() === 'true' || a.is_true.toLowerCase() === 'vrai';
                else if (typeof a.reponse === 'string') isTrue = a.reponse.toLowerCase() === 'true' || a.reponse.toLowerCase() === 'vrai';
                const stmt = extractStatementText(a);
                return {
                  id: a.id || `vf_${idx + 1}`,
                  statement: stmt,
                  is_true: isTrue,
                  isTrue,
                  explanation: a.explanation || a.explication || a.justification || ''
                };
              }).filter((a: any) => a.statement && a.statement.length > 0 && !/^Affirmation\s*(?:n°\s*\d+)?$/i.test(a.statement))
            };
          }
        } else if (normType === 'questionnaire' || normType === 'questionnaire-test') {
          const rawQs = Array.isArray(finalContent) ? finalContent : finalContent.questions;
          if (Array.isArray(rawQs)) {
            finalContent = {
              ...(typeof finalContent === 'object' && !Array.isArray(finalContent) ? finalContent : {}),
              questions: rawQs.slice(0, 18)
            };
          }
        }
        creationParsed = {
          title: aiResult.creation_title || `${normType.toUpperCase()} : ${mainDocName}`,
          content: finalContent,
          toolType: normType,
        };
        companionChatMessage = aiResult.chat_response || '';
      } else if (hasCreationClues || rawResponseText.includes('mindmap')) {
        const jsonMatch = rawResponseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i) || rawResponseText.match(/(\{[\s\S]*\})/);
        const candidate = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawResponseText;
        const parsed = safeJsonParse(candidate);

        if (parsed && typeof parsed === 'object') {
          const parsedData = parsed.creation_data || (parsed.questions || parsed.affirmations || parsed.cards || parsed.root || parsed.branches || parsed.mermaid || parsed.overview || parsed.sections || parsed.chapters || parsed.pages || parsed.exercises || parsed.exercices || parsed.written_exercise || parsed.complete_exam ? parsed : null);
          if (parsedData) {
            let detectedType = parsed.creation_type;
            if (explicitToolType && (explicitToolType.includes('vrai') || explicitToolType.includes('faux'))) {
              detectedType = explicitToolType;
            } else if (!detectedType) {
              if (explicitToolType) {
                detectedType = explicitToolType;
              } else if (parsed.affirmations) {
                detectedType = 'vrai-ou-faux';
              } else if (parsed.questions) {
                detectedType = 'questionnaire';
              } else if (parsed.cards) {
                detectedType = 'carte-memoire';
              } else if (parsed.root || parsed.branches || parsed.mermaid) {
                detectedType = 'carte-mentale';
              } else if (parsed.overview) {
                detectedType = 'resume';
              } else if (parsed.chapters || parsed.pages) {
                detectedType = 'pdf';
              } else {
                detectedType = 'questionnaire';
              }
            }
            const normType = normalizeCreationType(detectedType);
            let finalContent = parsedData;
            if (normType === 'vrai-ou-faux' || normType === 'vrai-ou-faux-test') {
              const rawAffs = Array.isArray(finalContent)
                ? finalContent
                : (finalContent?.affirmations || finalContent?.questions || finalContent?.items || finalContent?.statements || finalContent?.data || parsed?.affirmations || parsed?.questions || []);
              if (Array.isArray(rawAffs) && rawAffs.length > 0) {
                finalContent = {
                  affirmations: rawAffs.slice(0, 18).map((a: any, idx: number) => {
                    let isTrue = true;
                    if (typeof a.is_true === 'boolean') isTrue = a.is_true;
                    else if (typeof a.isTrue === 'boolean') isTrue = a.isTrue;
                    else if (typeof a.reponse === 'boolean') isTrue = a.reponse;
                    else if (typeof a.correctAnswer === 'boolean') isTrue = a.correctAnswer;
                    else if (typeof a.is_true === 'string') isTrue = a.is_true.toLowerCase() === 'true' || a.is_true.toLowerCase() === 'vrai';
                    else if (typeof a.isTrue === 'string') isTrue = a.isTrue.toLowerCase() === 'true' || a.is_true.toLowerCase() === 'vrai';
                    else if (typeof a.reponse === 'string') isTrue = a.reponse.toLowerCase() === 'true' || a.reponse.toLowerCase() === 'vrai';
                    const stmt = extractStatementText(a);
                    return {
                      id: a.id || `vf_${idx + 1}`,
                      statement: stmt,
                      is_true: isTrue,
                      isTrue,
                      explanation: a.explanation || a.explication || a.justification || ''
                    };
                  }).filter((a: any) => a.statement && a.statement.length > 0 && !/^Affirmation\s*(?:n°\s*\d+)?$/i.test(a.statement))
                };
              }
            } else if (normType === 'questionnaire' || normType === 'questionnaire-test') {
              const rawQs = Array.isArray(finalContent) ? finalContent : (finalContent.questions || parsed.questions || []);
              if (Array.isArray(rawQs)) {
                finalContent = {
                  ...(typeof finalContent === 'object' && !Array.isArray(finalContent) ? finalContent : {}),
                  questions: rawQs.slice(0, 18)
                };
              }
            }
            creationParsed = {
              title: parsed.creation_title || parsed.title || `${normType.toUpperCase()} : ${mainDocName}`,
              content: finalContent,
              toolType: normType,
            };
            companionChatMessage = parsed.chat_message || parsed.chat_response || '';
          }
        }

        // Détection de Mermaid Mindmap direct dans la réponse
        if (!creationParsed) {
          const mermaidMindmapMatch = rawResponseText.match(/```(?:mermaid)?\s*(mindmap[\s\S]*?)```/i) || (rawResponseText.trim().startsWith('mindmap') ? [rawResponseText, rawResponseText] : null);
          if (mermaidMindmapMatch) {
            creationParsed = {
              title: `Carte Mentale : ${mainDocName}`,
              content: { mermaid: mermaidMindmapMatch[1].trim() },
              toolType: 'carte-mentale'
            };
            companionChatMessage = "J'ai conçu votre carte mentale logique interactive !";
          }
        }

        // Si l'utilisateur a explicitement cliqué sur un bouton d'action ou demandé un module dans son message avec une véritable intention
        const explicitOrInferredType = explicitToolType || (hasExplicitCreationIntent(userText) ? (
          /vrai.*faux/i.test(userText) ? (/test/i.test(userText) ? 'vrai-ou-faux-test' : 'vrai-ou-faux') :
            /(?:questionnaire|quiz|quizz|qcms?|q\.?c\.?m\.?|choix\s+multiples?)/i.test(userText) ? (/test/i.test(userText) ? 'questionnaire-test' : 'questionnaire') :
              /carte\s*mentale|mindmap/i.test(userText) ? 'carte-mentale' :
                /flashcard|carte\s*m[ée]moire/i.test(userText) ? 'carte-memoire' :
                  /r[ée]sum[ée]|synth[èe]se/i.test(userText) ? 'resume' :
                    /(?:document\s+pdf|polycopi[eé]|en\s+pdf|sous\s+forme\s+de\s+(?:document\s+)?pdf)/i.test(userText) ? 'pdf' :
                      /exercice|devoir/i.test(userText) ? (/devoir/i.test(userText) ? 'devoir-complet' : 'exercices-ecrits') :
                        /infographie/i.test(userText) ? 'infographie' : null
        ) : null);

        if (!creationParsed && explicitOrInferredType) {
          const p = parseOrBuildAiCreation(explicitOrInferredType as any, fullAiText, mainDocName, userText);
          const hasValidOverview = p.content?.overview && typeof p.content.overview === 'string' && !/^(?:j'ai\s+con[çc]u|j'ai\s+cr[ée][ée]|voici\s+votre|✨)/i.test(p.content.overview.trim());
          const hasRealData = Boolean(
            (p.content?.questions && p.content.questions.length > 0) ||
            (p.content?.affirmations && p.content.affirmations.length > 0) ||
            (p.content?.formulas && p.content.formulas.length > 0) ||
            (p.content?.key_definitions && p.content.key_definitions.length > 0) ||
            (p.content?.cards && p.content.cards.length > 0) ||
            (p.content?.exercises && p.content.exercises.length > 0) ||
            (p.content?.exercices && p.content.exercices.length > 0) ||
            (p.content?.sections && p.content.sections.length > 0) ||
            p.content?.root || p.content?.columns || p.content?.metrics || p.content?.chapters || p.content?.pages ||
            hasValidOverview
          );
          if (p.content && hasRealData) {
            creationParsed = {
              title: p.title,
              content: p.content,
              toolType: explicitOrInferredType,
            };
          } else if (isExplicitOverride && explicitToolType) {
            creationParsed = {
              title: p.title || `${explicitToolType} : ${mainDocName}`,
              content: p.content || null,
              toolType: explicitToolType,
            };
          }
        }
      }

      // Sécurité anti-création dans le vide pour TOUS les modèles IA (actuels et futurs) :
      if (creationParsed && (!allDocs || allDocs.length === 0) && !hasPromptSubject && !hasConversationContext) {
        creationParsed = null;
        fullResponseText = `Pour que je puisse concevoir votre **création**, merci de me préciser sur quel cours ou sujet elle doit porter, ou de joindre votre fichier de cours (PDF, Word, photo d'exercice).\n\n[QUESTIONS_SUGGÉRÉES]\n- Questionnaire Test noté sur les Lois de Newton en Physique\n- Vrai ou Faux Test sur la Génétique et l'ADN en SVT\n- Carte Conceptuelle sur les Fonctions et Dérivées en Mathématiques\n- Devoir Complet d'examen officiel sur la Thermodynamique`;
        window.dispatchEvent(new CustomEvent('ai-creation-status-update', { detail: { phase: 'idle', isLoading: false, isCreation: false, resetToPrompts: true } }));
      }
      // RÈGLE ANTI-DÉTOURNEMENT POUR LES QUESTIONS CONVERSATIONNELLES OU D'OBSERVATION D'IMAGE :
      // Si l'étudiant pose une question simple sur l'image ou entame un dialogue direct sans avoir explicitement demandé un format de création,
      // on force le mode CHAT et on annule la création autonome !
      const isPureConversationalOrVisionQuery = !isExplicitOverride && !explicitToolType && (
        /^(?:tu\s+vois|tu\s+peux\s+voir|est-ce\s+que\s+tu\s+vois|vois-tu|qu'est-ce\s+que\s+tu\s+vois|que\s+vois-tu|d[eé]cris|lis|peux-tu\s+lire|tu\s+arrives\s+à\s+voir|bonjour|salut|coucou)/i.test(userText.trim()) ||
        /^(?:tu\s+vois\s+l['’]image|tu\s+vois\s+limage|tu\s+la\s+vois|c'est\s+quoi\s+sur\s+l'image)/i.test(userText.trim().replace(/\s+/g, ' '))
      );

      if (isPureConversationalOrVisionQuery && creationParsed) {
        creationParsed = null;
      }

      // RÈGLE ABSOLUE POUR LA CONVERSATION :
      // Si l'étudiant n'a pas expressément demandé une création (isExplicitCreationRequest est faux),
      // ou si des créations d'arrière-plan sont actives : le message reste STRICTEMENT une discussion de chat !
      // Aucune création n'est créée, l'espace création ne bouge pas et ne bascule pas.
      // Toutes les créations demandées sont exécutées par le pool des 3 agents en arrière-plan
      if (!isExplicitCreationRequest || Boolean(orchestratorMode)) {
        creationParsed = null;
      }

      if (creationParsed && creationParsed.content) {
        window.dispatchEvent(new CustomEvent('ai-creation-status-update', {
          detail: {
            phase: 'creating',
            isCreating: true,
            isLoading: true,
            isCreation: true,
            statusText: "Création en cours...",
            toolType: creationParsed.toolType || explicitToolType
          }
        }));
        let effectiveToolType = creationParsed.toolType || explicitToolType || 'questionnaire';
        if (effectiveToolType === 'vrai-ou-faux' || effectiveToolType === 'vrai-ou-faux-test') {
          const rawAffs = Array.isArray(creationParsed.content)
            ? creationParsed.content
            : (creationParsed.content?.affirmations || creationParsed.content?.questions || creationParsed.content?.items || creationParsed.content?.statements || creationParsed.content?.data || []);
          if (Array.isArray(rawAffs) && rawAffs.length > 0) {
            creationParsed.content = {
              affirmations: rawAffs.slice(0, 18).map((a: any, idx: number) => {
                let isTrue = true;
                if (typeof a.is_true === 'boolean') isTrue = a.is_true;
                else if (typeof a.isTrue === 'boolean') isTrue = a.isTrue;
                else if (typeof a.reponse === 'boolean') isTrue = a.reponse;
                else if (typeof a.correctAnswer === 'boolean') isTrue = a.correctAnswer;
                else if (typeof a.is_true === 'string') isTrue = a.is_true.toLowerCase() === 'true' || a.is_true.toLowerCase() === 'vrai';
                else if (typeof a.isTrue === 'string') isTrue = a.isTrue.toLowerCase() === 'true' || a.isTrue.toLowerCase() === 'vrai';
                else if (typeof a.reponse === 'string') isTrue = a.reponse.toLowerCase() === 'true' || a.reponse.toLowerCase() === 'vrai';
                const stmt = extractStatementText(a);
                return {
                  id: a.id || `vf_${idx + 1}`,
                  statement: stmt,
                  is_true: isTrue,
                  isTrue,
                  explanation: a.explanation || a.explication || a.justification || ''
                };
              }).filter((a: any) => a.statement && a.statement.length > 0 && !/^Affirmation\s*(?:n°\s*\d+)?$/i.test(a.statement))
            };
          }
        } else if (effectiveToolType === 'questionnaire' || effectiveToolType === 'questionnaire-test') {
          const rawQs = Array.isArray(creationParsed.content) ? creationParsed.content : creationParsed.content.questions;
          if (Array.isArray(rawQs)) {
            creationParsed.content = {
              ...(typeof creationParsed.content === 'object' && !Array.isArray(creationParsed.content) ? creationParsed.content : {}),
              questions: rawQs.slice(0, 18)
            };
          }
        }
        let newCreation: AiCreation | null = null;
        if (creationParsed && creationParsed.content) {
          const estimatedPromptTokens = Math.max(55, Math.ceil(((userText || '').length + (aiResult.response || '').length) / 3.8));
          const respTokens = aiResult.tokens || (typeof aiResult.usage?.totalTokens === 'number' ? aiResult.usage.totalTokens : estimatedPromptTokens);
          const respCredits = typeof aiResult.credits_deducted === 'number' && aiResult.credits_deducted > 0
            ? aiResult.credits_deducted
            : (typeof aiResult.credits === 'number' && aiResult.credits > 0 ? aiResult.credits : convertTokensToCredits(respTokens, tokensPerCredit));

          if (creationParsed.content && typeof creationParsed.content === 'object') {
            creationParsed.content.tokens = respTokens;
            creationParsed.content.credits = respCredits;
          }

          newCreation = {
            id: creationId || (aiResult as any).creation_id || ('ai-' + Date.now()),
            userId: targetUserId,
            fileId: activePreviewItem?.id,
            conversationId: targetConvId,
            toolType: effectiveToolType,
            title: creationParsed.title,
            content: creationParsed.content,
            sourceFileName: mainDocName,
            createdAt: new Date().toISOString(),
            version: 1,
            status: 'ready',
            tokens: respTokens,
            credits: respCredits,
          };

          // Sauvegarde dans le cache local spécifique à CETTE conversation
          const localConvCreasRaw = safeGetItem(`studycloud_conv_creations_${targetConvId}`);
          let localConvCreas: AiCreation[] = [];
          if (localConvCreasRaw) {
            try { localConvCreas = JSON.parse(localConvCreasRaw) || []; } catch { }
          }
          const updatedConvCreas = [newCreation, ...localConvCreas.filter(c => c.id !== newCreation!.id)];
          safeSetItem(`studycloud_conv_creations_${targetConvId}`, JSON.stringify(updatedConvCreas));

          // Sauvegarde dans le cache global persistant
          try {
            const cachedRaw = localStorage.getItem('studycloud_saved_creations_cache');
            let currentList = cachedRaw ? JSON.parse(cachedRaw) : [];
            if (!Array.isArray(currentList)) currentList = [];
            const updatedList = [newCreation, ...currentList.filter((c: any) => c.id !== newCreation!.id)].slice(0, 50);
            localStorage.setItem('studycloud_saved_creations_cache', JSON.stringify(updatedList));
            localStorage.setItem('unifolder_ai_history', JSON.stringify(updatedList));
            localStorage.setItem('studycloud_active_creation', JSON.stringify(newCreation));
          } catch { }

          // Sauvegarde dans la table Cloudflare D1 ai_creations liée à targetConvId
          StudyCloudAPI.saveAiCreationRecord({
            id: newCreation.id,
            conversationId: targetConvId,
            type: effectiveToolType,
            title: newCreation.title,
            content: newCreation.content,
          }).catch(err => {
            console.warn('[AssistantChat] Erreur saveAiCreationRecord:', err);
          });

          // Sauvegarde immédiate dans la base de données D1 liée à l'utilisateur
          if (targetUserId && targetUserId !== 'default-user') {
            StudyCloudAPI.saveAiContent({
              id: newCreation.id,
              userId: targetUserId,
              fileId: activePreviewItem?.id || null,
              conversationId: targetConvId,
              toolType: effectiveToolType,
              title: newCreation.title || 'Création Studio',
              contentJson: newCreation.content,
              sourceFileName: mainDocName || undefined,
              isPinned: false,
            }).then(() => {
              window.dispatchEvent(new CustomEvent('studycloud-creation-saved', { detail: { id: newCreation!.id, creation: newCreation } }));
            }).catch(err => {
              console.warn('[AssistantChat] Erreur sauvegarde D1 création générée:', err);
            });
          }

          // Si l'utilisateur est toujours dans CETTE conversation, mise à jour immédiate de l'affichage Création
          if (currentConversationIdRef.current === targetConvId) {
            setActiveCreation(newCreation);
            setSessionCreations(updatedConvCreas);
            window.dispatchEvent(new CustomEvent('studycloud-creation-status-changed', { detail: { creationId: newCreation.id, status: 'ready', creation: newCreation } }));
            window.dispatchEvent(new CustomEvent('ai-creation-ready', { detail: { creation: newCreation } }));
            window.dispatchEvent(new CustomEvent('ai-creation-status-update', { detail: { phase: 'idle', isLoading: false } }));
            window.dispatchEvent(new CustomEvent('switch-mobile-tab', { detail: { tab: 2 } }));
          }

          // Nettoyage radical du texte pour la discussion : JAMAIS de JSON brut !
          const candidateIntro = companionChatMessage || aiResult.chat_response || '';
          const cleanIntro = cleanChatText(candidateIntro);

          fullResponseText = `${cleanIntro ? cleanIntro + '\n\n' : ''}✨ J'ai généré votre **${newCreation.title}** directement dans votre espace **Création** !

👉 *Retrouvez et testez votre création dans le volet de droite (ou l'onglet Création sur mobile).*`;
        }
      } else {
        // BRANCHE DISCUSSION SIMPLE DANS LE CHAT : Réponse directe sans rien déranger dans l'espace création
        const candidateText = (rawResponseText && !rawResponseText.trim().startsWith('{') && rawResponseText.length > (aiResult.chat_response?.length || 0))
          ? rawResponseText
          : (aiResult.response || aiResult.chat_response || rawResponseText);
        const cleaned = cleanChatText(candidateText);
        fullResponseText = stripAiReasoningScratchpad(cleaned) || "✨ Votre demande a été traitée avec succès.";

        // FILET DE SÉCURITÉ D'ORCHESTRATION POST-RÉPONSE :
        // Si les agents n'avaient pas encore été lancés en amont (ex: faute de frappe inédite ou formulation libre)
        // MAIS que l'IA sélectionnée a compris qu'il s'agit d'une demande de création (via [LANCER_AGENTS: ...] ou en annonçant la génération dans "Mes Créations"),
        // on déclenche immédiatement les agents en arrière-plan !
        const agentTagMatch = fullResponseText.match(/\[LANCER_AGENTS\s*:\s*([^\]]+)\]/i);
        if (agentTagMatch) {
          fullResponseText = fullResponseText.replace(/\[LANCER_AGENTS\s*:\s*[^\]]+\]/gi, '').trim();
        }
        const aiAnnouncedGeneration = Boolean(
          agentTagMatch ||
          /(?:en\s+cours\s+de\s+g[eé]n[eé]ration|lance\s+(?:imm[eé]diatement\s+)?la\s+(?:conception|cr[eé]ation|g[eé]n[eé]ration)|dans\s+(?:ton|votre|l['’])?\s*(?:onglet|menu|espace)\s*["«*]*Mes\s+Cr[eé]ations)/i.test(fullResponseText)
        );
        if (!hasDispatchedAgents && hasEducationalContext && !needsMultiDocClarification && aiAnnouncedGeneration) {
          let postDetectedFormats: AiCreationType[] = [];
          if (agentTagMatch && agentTagMatch[1]) {
            const rawTokens = agentTagMatch[1].split(/[,;|]+/).map(s => s.trim()).filter(Boolean);
            for (const tok of rawTokens) {
              const fromTok = detectAllCreationFormats(tok, undefined, undefined);
              if (fromTok.length > 0) {
                postDetectedFormats.push(...fromTok);
              } else {
                postDetectedFormats.push(normalizeCreationType(tok) as AiCreationType);
              }
            }
          }
          if (postDetectedFormats.length === 0) {
            postDetectedFormats = detectAllCreationFormats(userText, undefined, convBaseMessages);
          }
          // Déduplication stricte des formats pour ne jamais lancer deux fois la même création ni ajouter de format non demandé
          const uniquePostFormats: AiCreationType[] = [];
          for (const f of postDetectedFormats) {
            if (!uniquePostFormats.includes(f)) {
              uniquePostFormats.push(f);
            }
          }
          if (uniquePostFormats.length > 0) {
            dispatchAgentsForFormats(uniquePostFormats);
          }
        }

        // Si aucun agent de création ne tourne en arrière-plan, s'assurer que l'écran d'attente est au repos
        if (!hasDispatchedAgents && aiBackgroundManager.getRunningCount() === 0 && aiBackgroundManager.getQueuedCount() === 0) {
          window.dispatchEvent(new CustomEvent('ai-creation-status-update', { detail: { phase: 'idle', isLoading: false, isCreation: false, resetToPrompts: false } }));
        }
      }

      const effectiveModelName = aiResult.model || currentModelDisplay;
      const respTokens = aiResult.tokens || (typeof aiResult.usage?.totalTokens === 'number' ? aiResult.usage.totalTokens : Math.max(55, Math.ceil(((userText || '').length + fullResponseText.length) / 3.8)));
      const respCredits = typeof aiResult.credits_deducted === 'number' && aiResult.credits_deducted > 0
        ? aiResult.credits_deducted
        : convertTokensToCredits(respTokens, tokensPerCredit);

      // Mettre à jour le cache local pour targetConvId en remplaçant le message streaming par la réponse finale
      const currentConvMsgsRaw = safeGetItem(`studycloud_conv_msgs_${targetConvId}`);
      let currentConvMsgs: Message[] = [];
      if (currentConvMsgsRaw) {
        try { currentConvMsgs = JSON.parse(currentConvMsgsRaw) || []; } catch { }
      }
      const finalizedConvMsgs = currentConvMsgs.map(m =>
        m.id === aiMsgId ? { ...m, text: fullResponseText, isStreaming: false, model: effectiveModelName, tokens: respTokens, credits: respCredits } : m
      );
      if (!finalizedConvMsgs.some(m => m.id === aiMsgId)) {
        finalizedConvMsgs.push({ id: aiMsgId, text: fullResponseText, sender: 'ai', isStreaming: false, model: effectiveModelName, tokens: respTokens, credits: respCredits });
      }
      safeSetItem(`studycloud_conv_msgs_${targetConvId}`, JSON.stringify(finalizedConvMsgs));

      // Sauvegarde Cloudflare D1 du message assistant complet avec horodatage ultérieur et crédits
      StudyCloudAPI.saveAiMessage({
        id: aiMsgId,
        conversationId: targetConvId,
        role: 'assistant',
        content: fullResponseText,
        created_at: new Date(Date.now() + 100).toISOString(),
        metadata: { model: effectiveModelName, tokens: respTokens, credits: respCredits }
      }).catch(() => { });

      // Marquer la tâche comme terminée dans le manager d'arrière-plan
      // aiBackgroundManager.completeAiTask(targetConvId, aiMsgId, fullResponseText, (creationParsed as any)?.content ? { title: creationParsed?.title, toolType: creationParsed?.toolType } : undefined);

      if (currentMediaSignature && hasAttachedDoc) {
        if (aiResult?.perceptionReport) {
          cachedPerceptionReportsRef.current[currentMediaSignature] = aiResult.perceptionReport;
          StudyCloudAPI.saveAiFilePerception({
            userId: currentUserId,
            fileSignature: currentMediaSignature,
            fileName: mainDocName || 'Document d\'étude',
            perceptionReport: aiResult.perceptionReport
          }).catch(err => console.warn('[AssistantChat] Erreur sauvegarde perception D1:', err));
        }
        analyzedMediaPerConvRef.current[convCacheKey] = currentMediaSignature;
      }

      // Si l'utilisateur est toujours dans CETTE conversation, mise à jour fluide de l'affichage
      if (currentConversationIdRef.current === targetConvId) {
        if (typingTimerRef.current) {
          clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
        }
        if (watchdogTimerRef.current) {
          clearTimeout(watchdogTimerRef.current);
          watchdogTimerRef.current = null;
        }

        let isAiMsgFinalized = false;
        const finalizeAiMessage = () => {
          if (isAiMsgFinalized || abortSignal.aborted) return;
          isAiMsgFinalized = true;
          isChatRequestInFlightRef.current = false;
          if (typingTimerRef.current) {
            clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
          }
          if (watchdogTimerRef.current) {
            clearTimeout(watchdogTimerRef.current);
            watchdogTimerRef.current = null;
          }

          if (currentConversationIdRef.current === targetConvId) {
            setMessages(prev => {
              const exists = prev.some(m => m.id === aiMsgId);
              if (!exists) {
                return [...prev, { id: aiMsgId, text: fullResponseText, sender: 'ai', isStreaming: false, model: effectiveModelName, tokens: respTokens, credits: respCredits }];
              }
              return prev.map(m =>
                m.id === aiMsgId ? { ...m, text: fullResponseText, isStreaming: false, model: effectiveModelName, tokens: respTokens, credits: respCredits } : m
              );
            });
            setIsTyping(false);
            setIsWaitingServer(false);
            setRetryingMessageId(null);
            window.dispatchEvent(new CustomEvent('open-assistant-chat'));
            window.dispatchEvent(new CustomEvent('switch-mobile-tab', { detail: { tab: 1 } }));
            if (scrollContainerRef.current && !isUserScrolledUpRef.current) {
              scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            }
          }
        };

        if ((typeof document !== 'undefined' && document.hidden) || fullResponseText.length < 30) {
          finalizeAiMessage();
          return;
        }

        const tickSpeed = 16;
        const targetDurationMs = Math.min(1000, Math.max(300, fullResponseText.length * 2));
        const totalTicks = Math.max(1, Math.floor(targetDurationMs / tickSpeed));
        const chunkSize = Math.max(8, Math.ceil(fullResponseText.length / totalTicks));
        let index = 0;

        watchdogTimerRef.current = setTimeout(() => {
          finalizeAiMessage();
        }, targetDurationMs + 600);

        typingTimerRef.current = setInterval(() => {
          try {
            if (abortSignal.aborted || currentConversationIdRef.current !== targetConvId) {
              finalizeAiMessage();
              return;
            }
            index += chunkSize;
            if (index >= fullResponseText.length) {
              finalizeAiMessage();
            } else {
              const partial = fullResponseText.slice(0, index);
              setMessages(prev => {
                const exists = prev.some(m => m.id === aiMsgId);
                if (!exists) {
                  return [...prev, { id: aiMsgId, text: partial, sender: 'ai', isStreaming: true, model: effectiveModelName }];
                }
                return prev.map(m =>
                  m.id === aiMsgId ? { ...m, text: partial, model: effectiveModelName } : m
                );
              });
            }
            if (scrollContainerRef.current && !isUserScrolledUpRef.current) {
              scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            }
          } catch (_err) {
            finalizeAiMessage();
          }
        }, tickSpeed);
      } else {
        // L'utilisateur navigue sur une autre conversation : la tâche d'arrière-plan a persisté en toute discrétion
        isChatRequestInFlightRef.current = false;
        setIsWaitingServer(false);
        setIsTyping(false);
      }

    } catch (err: any) {
      isChatRequestInFlightRef.current = false;
      if (abortSignal.aborted) {
        return;
      }
      // aiBackgroundManager.clearTask(targetConvId);

      // Nettoyer le streaming dans le cache local
      const convMsgsRaw = safeGetItem(`studycloud_conv_msgs_${targetConvId}`);
      if (convMsgsRaw) {
        try {
          const list = JSON.parse(convMsgsRaw);
          if (Array.isArray(list)) {
            const cleanedList = list.filter(m => m.id !== aiMsgId);
            safeSetItem(`studycloud_conv_msgs_${targetConvId}`, JSON.stringify(cleanedList));
          }
        } catch { }
      }

      if (currentConversationIdRef.current === targetConvId) {
        setRetryingMessageId(null);
        if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
          setIsWaitingServer(false);
          setIsTyping(false);
          return;
        }
        console.error('[AssistantChat] Erreur appel IA:', err);
        setIsWaitingServer(false);
        setIsTyping(false);
        window.dispatchEvent(new CustomEvent('ai-creation-error', { detail: { error: err.message } }));
        if (creationId) {
          window.dispatchEvent(new CustomEvent('studycloud-creation-status-changed', {
            detail: { creationId, status: 'error', errorText: err?.message }
          }));
          if (targetUserId && targetUserId !== 'default-user') {
            StudyCloudAPI.deleteAiContent(creationId, targetUserId).catch(() => { });
          }
        }
        window.dispatchEvent(new CustomEvent('ai-creation-status-update', { detail: { phase: 'idle', isLoading: false, isError: true, resetToPrompts: true } }));

        const isNetwork = isNetworkError(err);
        const isFriendlyMsg = err.message && (err.message.includes("StudyCloud") || err.message.includes("disponible"));

        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          text: isNetwork
            ? "Veuillez vérifier que votre appareil est bien connecté à Internet (Wi-Fi ou données mobiles)."
            : (isFriendlyMsg ? `⚠️ ${err.message}` : `⚠️ Erreur : ${err.message || "L'assistante StudyCloud n'est pas disponible pour le moment."}`),
          sender: 'ai',
          isStreaming: false,
          isError: true,
          errorType: isNetwork ? 'network' : 'server',
          retryPrompt: userText,
        };
        setMessages(prev => [...prev.filter(m => m.id !== aiMsgId), errorMsg]);
      }
    }
  };

  useEffect(() => {
    const handleAutoPrompt = (e: any) => {
      const promptText = e.detail?.prompt || e.detail?.text;
      const reqType = e.detail?.requested_type || e.detail?.requestedType || e.detail?.toolType;
      if (promptText) {
        window.dispatchEvent(new CustomEvent('open-assistant-chat'));
        window.dispatchEvent(new CustomEvent('switch-mobile-tab', { detail: { tab: 1 } }));
        sendMessage(promptText, reqType);
      }
    };
    window.addEventListener('auto-prompt', handleAutoPrompt as any);
    window.addEventListener('studycloud-trigger-creation', handleAutoPrompt as any);
    window.addEventListener('studycloud-submit-prompt', handleAutoPrompt as any);
    return () => {
      window.removeEventListener('auto-prompt', handleAutoPrompt as any);
      window.removeEventListener('studycloud-trigger-creation', handleAutoPrompt as any);
      window.removeEventListener('studycloud-submit-prompt', handleAutoPrompt as any);
    };
  }, [messages, isTyping, activePreviewItem, attachedResources, activeCreation, currentConversationId]);

  useEffect(() => {
    const handleCancelFromCreation = (e: any) => {
      const creationId = e?.detail?.creationId;
      if (creationId) {
        aiBackgroundManager.clearTask(creationId);
      }
    };
    window.addEventListener('studycloud-cancel-creation', handleCancelFromCreation as any);
    return () => window.removeEventListener('studycloud-cancel-creation', handleCancelFromCreation as any);
  }, []);

  const handleSend = () => {
    if (!inputValue.trim() || isChatRequestInFlightRef.current || isWaitingServer) return;
    sendMessage(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (toolType: AiCreationType) => {
    const docName = activePreviewItem?.name || 'ce document';
    let prompt = '';
    switch (toolType) {
      case 'quiz':
        prompt = `Prépare un questionnaire QCM interactif sur "${docName}"`;
        break;
      case 'summary':
        prompt = `Génère un résumé détaillé et structuré de "${docName}"`;
        break;
      case 'mindmap':
        prompt = `Crée une carte mentale complète à partir de "${docName}"`;
        break;
      case 'infographic':
        prompt = `Élabore une infographie de synthèse sur "${docName}"`;
        break;
      case 'document':
        prompt = `Rédige une fiche d'étude exportable en PDF sur "${docName}"`;
        break;
    }
    sendMessage(prompt, toolType);
  };

  // Groupement temporel des conversations façon Gemini (Aujourd'hui, Hier, 7 derniers jours, Plus ancien)
  const filteredConversations = conversations.filter(c =>
    !historySearch.trim() || c.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#1e2024] font-nunito relative z-50 overflow-hidden">

      {/* EN-TÊTE SUPÉRIEUR (BOUTON HISTORIQUE, NOUVELLE CONVERSATION, PUISSANT/MOYEN, FERMER) */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-[#23252a] border-b border-zinc-700/60 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Bouton Historique */}
          <button
            type="button"
            onClick={() => setIsHistoryDrawerOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all cursor-pointer border border-zinc-700 active:scale-95 shrink-0"
            title="Historique des discussions"
          >
            <Clock className="w-3.5 h-3.5 text-orange-400" />
            <span>Historique</span>
            {conversations.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-orange-500/25 text-orange-400 text-[10px] font-black">
                {conversations.length}
              </span>
            )}
          </button>

          {/* Bouton + (Nouvelle discussion) */}
          <button
            type="button"
            onClick={handleStartNewConversation}
            className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer border border-zinc-700 active:scale-95 shrink-0 flex items-center justify-center"
            title="Nouvelle discussion"
          >
            <Plus className="w-4 h-4 text-orange-400" />
          </button>

          {/* Sélecteur de Modèle IA */}
          <div className="relative shrink-0" ref={modelDropdownRef}>
            <button
              type="button"
              onClick={() => setIsModelDropdownOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white active:scale-95 shrink-0 shadow-xs"
              title={isChefModelId(selectedModel) ? "Agent Delmas (Chef Multi-IA : Orchestre l'équipe Gemini Perception, R1 Maths, DeepSeek)" : "Modèle individuel autonome"}
            >
              {isChefModelId(selectedModel) && (
                <span className="text-[10px] px-1 py-0.2 rounded-full bg-orange-500/20 text-orange-400 font-extrabold border border-orange-500/30 flex items-center shrink-0">
                  👑
                </span>
              )}
              <span className="max-w-[110px] sm:max-w-[150px] truncate">{currentModelDisplay}</span>
              <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-72 sm:w-80 bg-[#181a20] border border-zinc-700 rounded-xl shadow-2xl py-1.5 z-50 animate-fadeIn backdrop-blur-md">
                <div className="px-3 py-1.5 border-b border-zinc-800/80 text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Modèles IA</span>
                  <span className="text-[9px] text-zinc-500 font-normal">Espace d'étude</span>
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {isModelsLoading && availableModels.length === 0 ? (
                    <div className="px-3 py-3 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                      <div className="w-3 h-3 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                      <span>Chargement des modèles...</span>
                    </div>
                  ) : availableModels.length === 0 ? (
                    <div className="px-3 py-3 text-center text-xs text-zinc-500">
                      Aucun modèle actif
                    </div>
                  ) : (
                    availableModels.map((m) => {
                      const modelIdStr = m.id || m.model_id || '';
                      const isSelected = selectedModel === m.id || selectedModel === m.model_id;
                      const isChef = isChefModelId(modelIdStr);
                      const providerColor =
                        m.provider === 'google' ? 'bg-blue-400' :
                          m.provider === 'cloudflare' ? 'bg-orange-400' :
                            m.provider === 'anthropic' ? 'bg-amber-400' : 'bg-emerald-400';
                      const displayName = stripWorkerAi(m.nickname || m.name || m.model_id || m.id);

                      return (
                        <button
                          key={m.id || m.model_id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(m.id || m.model_id);
                            setIsModelDropdownOpen(false);
                          }}
                          className={`w-full flex flex-col gap-1 px-3 py-2 text-left text-xs transition-colors cursor-pointer border-b border-zinc-800/40 last:border-b-0 ${isSelected ? 'bg-orange-500/15 text-orange-400 font-bold' : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                            }`}
                        >
                          <div className="w-full flex items-center justify-between">
                            <div className="flex items-center gap-2 truncate pr-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${providerColor}`} />
                              <span className="truncate font-semibold">{displayName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isSelected && <Check className="w-3.5 h-3.5 text-orange-400 shrink-0 ml-0.5" />}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Bouton Fermer */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/50 text-orange-400 text-[10px] font-black cursor-pointer hover:bg-orange-500/30 transition-colors"
              title="Fermer l'Assistante DKD"
            >
              <DelmasRobot size={20} />
              <span>Fermer</span>
            </button>
          )}
        </div>
      </div>

      {/* TIROIR HISTORIQUE COULISSANT STYLE GEMINI */}
      {isHistoryDrawerOpen && (
        <div
          className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex animate-fadeIn"
          onClick={() => setIsHistoryDrawerOpen(false)}
        >
          <div
            className="w-full max-w-[310px] sm:max-w-[340px] h-full bg-[#1e2024] border-r border-zinc-800 flex flex-col p-4 shadow-2xl animate-slideInLeft"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-700/60 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Discussions Récentes</h3>
              </div>
              <button
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New Conversation Button inside drawer */}
            <button
              onClick={handleStartNewConversation}
              className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nouvelle discussion</span>
            </button>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Rechercher une discussion..."
                className="w-full bg-[#282a2f] border border-zinc-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-400 outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
              {filteredConversations.length === 0 ? (
                <div className="text-center text-zinc-500 text-xs py-8">
                  Aucune discussion trouvée
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const isActive = conv.id === currentConversationId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        setCurrentConversationId(conv.id);
                        setCurrentConversationTitle(conv.title);
                        setIsHistoryDrawerOpen(false);
                      }}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer group flex items-center justify-between gap-2 ${isActive
                          ? 'bg-orange-500/15 border-orange-500/50 text-white shadow-sm'
                          : 'bg-[#26282d] border-zinc-800 text-zinc-300 hover:bg-[#2c2f35] hover:border-zinc-700'
                        }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-orange-400' : 'text-zinc-400'}`} />
                        <span className="text-xs font-bold truncate">
                          {conv.title}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer shrink-0"
                        title="Supprimer cette discussion"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6 flex flex-col select-text chat-selectable"
      >
        {messages.length === 0 && !isTyping && !isWaitingServer ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-h-full my-auto pb-10 px-4 animate-fadeIn">
            {/* Logo ADN officiel */}
            <div className="mb-3 relative group">
              <DnaLogo className="w-12 h-12 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.35)] transition-transform duration-300 group-hover:scale-105" glow={false} />
            </div>

            {/* Badge de l'IA active sélectionnée qui s'adresse spontanément à l'utilisateur */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2.5 rounded-full bg-zinc-800/85 border border-zinc-700/60 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[11px] font-semibold text-zinc-300 tracking-wide">
                {currentModelDisplay}
              </span>
              {isChefModelId(selectedModel) && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-orange-500/25 text-orange-300 font-extrabold border border-orange-500/40">
                  👑 Agent Delmas (Chef Multi-IA)
                </span>
              )}
            </div>

            {/* Titre spontané et fluide envoyé en temps réel par l'IA */}
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight min-h-[32px] flex items-center justify-center">
              <span>{displayedWelcomeTitle || welcomeGreeting.title}</span>
              {isTypingWelcome && (
                <span className="inline-block w-0.5 h-5 bg-orange-400 ml-1.5 animate-pulse align-middle" />
              )}
            </h2>

            {/* Sous-titre dynamique bienveillant */}
            <p className="text-xs sm:text-sm font-medium text-white/85 max-w-sm leading-relaxed min-h-[22px]">
              {displayedWelcomeSubtitle || (!isTypingWelcome ? welcomeGreeting.subtitle : '')}
            </p>
          </div>
        ) : (
          messages
            .filter(msg => {
              if (String(msg.id || '').startsWith('ai-bg-') || String(msg.id || '').startsWith('agent-')) return false;
              if (msg.sender === 'ai' && !msg.isError) {
                const raw = String(msg.text || '').trim();
                if (!raw) return false;
                if (!msg.isStreaming && !cleanChatText(stripAiReasoningScratchpad(raw)).trim()) return false;
              }
              return true;
            })
            .map(msg => (
              <div key={msg.id} className="w-full shrink-0">
                {msg.sender === 'user' ? (
                  <div className="flex justify-end w-full group relative">
                    <div className="flex items-center gap-1.5 max-w-[85%]">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.text);
                          setCopiedMsgId(msg.id);
                          setTimeout(() => setCopiedMsgId(null), 2000);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 cursor-pointer shrink-0"
                        title="Copier mon message"
                      >
                        {copiedMsgId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <div className="bg-[#2a2b2f] text-zinc-100 px-4 py-2.5 rounded-[24px] rounded-tr-[4px] text-[14px] sm:text-[15px] md:text-[16px] break-words shadow-sm select-text chat-selectable cursor-text">
                        <ChatMessageText text={msg.text} isUser={true} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col w-full text-zinc-100">
                    <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <DnaLogo className="w-5 h-5 drop-shadow-[0_0_2px_rgba(0,0,0,1)] text-orange-500" glow={true} />
                        <span className="text-xs font-bold text-orange-500/90 tracking-wide uppercase">Assistant StudyCloud</span>
                        {(msg.model || currentModelDisplay) && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold shadow-xs ${isChefModelId(msg.model || selectedModel)
                                ? 'bg-orange-500/15 border-orange-500/30 text-orange-300'
                                : 'bg-zinc-800/95 border-zinc-700 text-zinc-300'
                              }`}
                            title={`Modèle ayant généré cette réponse : ${stripWorkerAi(msg.model || currentModelDisplay)}`}
                          >
                            {isChefModelId(msg.model || selectedModel) && <span className="text-[10px]">👑</span>}
                            <span>{stripWorkerAi(msg.model || currentModelDisplay)}</span>
                          </span>
                        )}
                        {msg.isPowerMode && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-300 shadow-xs">
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span>Puissant</span>
                          </span>
                        )}
                      </div>
                      {msg.attachedFileName && msg.attachedFileName !== 'Document d\'étude' && msg.attachedFileName !== 'Document source' && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {msg.attachedFileName.split(', ')
                            .filter(docName => docName && docName !== 'Document d\'étude' && docName !== 'Document source')
                            .map((docName, idx) => (
                              <div key={idx} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-[10px] font-semibold text-orange-300">
                                <FileText className="w-3 h-3 text-orange-400 shrink-0" />
                                <span className="truncate max-w-[140px] sm:max-w-[200px]">{docName}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {isNetworkErrorMessage(msg) ? (
                      <NetworkErrorCard
                        retryPrompt={msg.retryPrompt}
                        isRetrying={retryingMessageId === msg.id && (isWaitingServer || isTyping)}
                        onRetry={() => {
                          const targetPrompt = msg.retryPrompt || (() => {
                            const idx = messages.findIndex(m => m.id === msg.id);
                            const before = idx >= 0 ? messages.slice(0, idx) : messages;
                            const lastUser = [...before].reverse().find(m => m.sender === 'user');
                            return lastUser?.text || '';
                          })();
                          setRetryingMessageId(msg.id);
                          if (targetPrompt) {
                            sendMessage(targetPrompt);
                          } else {
                            setRetryingMessageId(null);
                          }
                        }}
                      />
                    ) : msg.isError ? (
                      <div className="my-2 p-3 sm:p-3.5 rounded-2xl bg-[#1e2026] border border-zinc-700/80 text-zinc-200 flex items-start gap-3 w-full max-w-xl animate-fadeIn">
                        <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs sm:text-sm text-white mb-1">Service temporairement indisponible</div>
                          <div className="text-xs text-zinc-300 leading-relaxed font-normal">
                            {msg.text.replace(/^⚠️\s*(Erreur\s*(du\s*serveur|IA)?\s*:\s*)?/i, '')}
                          </div>
                          <button
                            type="button"
                            disabled={retryingMessageId === msg.id && (isWaitingServer || isTyping)}
                            onClick={() => {
                              const targetPrompt = msg.retryPrompt || (() => {
                                const idx = messages.findIndex(m => m.id === msg.id);
                                const before = idx >= 0 ? messages.slice(0, idx) : messages;
                                const lastUser = [...before].reverse().find(m => m.sender === 'user');
                                return lastUser?.text || '';
                              })();
                              setRetryingMessageId(msg.id);
                              if (targetPrompt) {
                                sendMessage(targetPrompt);
                              } else {
                                setRetryingMessageId(null);
                              }
                            }}
                            className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all cursor-pointer border border-zinc-700 active:scale-95 disabled:opacity-60"
                          >
                            <RotateCw className={`w-3 h-3 text-orange-400 ${retryingMessageId === msg.id && (isWaitingServer || isTyping) ? 'animate-spin' : ''}`} />
                            <span>{retryingMessageId === msg.id && (isWaitingServer || isTyping) ? 'Connexion...' : 'Réessayer'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (!msg.text || !msg.text.trim()) ? (
                      <div className="flex items-center gap-2.5 bg-[#26282d] px-3.5 py-2.5 rounded-2xl w-fit max-w-[90%] shadow-md mt-1 animate-fadeIn">
                        <DnaLogo className="w-5 h-5 animate-dna-spin-float shrink-0 text-orange-500" glow={true} />
                        <span className="text-xs sm:text-[13px] font-medium text-zinc-200 animate-pulse tracking-wide select-none">
                          {aiActivityText || 'Je réfléchis...'}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[15px] sm:text-[16px] md:text-[17px] leading-[1.8] font-normal text-zinc-100 pl-1 select-text chat-selectable cursor-text">
                        <ChatMessageText text={msg.text} isUser={false} isStreaming={msg.isStreaming} onSelectSuggestion={(q) => sendMessage(q)} />
                      </div>
                    )}

                    {!msg.isStreaming && msg.text && !msg.isError && !isNetworkErrorMessage(msg) && (() => {
                      const isLastAssistant = msg.id === messages[messages.length - 1]?.id;
                      const offersContinuation = isLastAssistant && /(voulez-vous|souhaitez-vous|veux-tu|on continue|continuer\s*\?|la suite\s*\?|je poursuis|dois-je continuer|on passe à la suite|continuer\s*:\s*oui|calcul\s+est\s+vaste)/i.test(msg.text);
                      if (!offersContinuation) return null;

                      const lastHeadingMatches = [...msg.text.matchAll(/(?:^|\n)(#{1,3}\s+[^\n]+|Question\s+\d+|Exercice\s+\d+|[EÉ]tape\s+\d+|Partie\s+[A-Z0-9]+)/gi)];
                      const lastHeading = lastHeadingMatches.length > 0
                        ? lastHeadingMatches[lastHeadingMatches.length - 1][1].trim().replace(/^#{1,3}\s*/, '')
                        : '';

                      const continuePrompt = lastHeading
                        ? `Oui, continue s'il te plaît avec la suite exacte (tu t'es arrêté à « ${lastHeading} », enchaîne directement sans répéter le début).`
                        : `Oui, continue s'il te plaît avec la suite exacte de ce que tu viens d'expliquer (enchaîne directement là où tu t'es arrêté, sans répéter ce qui a déjà été dit).`;

                      return (
                        <div className="mt-3.5 mb-1 pl-1 flex items-center gap-2 flex-wrap animate-fadeIn">
                          <button
                            type="button"
                            onClick={() => sendMessage(continuePrompt, undefined, { isContinuation: true })}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-orange-500/30 active:scale-95 transition-all cursor-pointer border border-amber-300/40 group"
                          >
                            <Sparkles className="w-4 h-4 text-yellow-100 animate-pulse" />
                            <span>Poursuivre la suite exacte</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      );
                    })()}

                    {!msg.isStreaming && msg.text && !msg.isError && !isNetworkErrorMessage(msg) && (
                      <div className="flex flex-col mt-3 pl-1">
                        {/* Affichage dépliable de la consommation totale en crédits (Tracé rouge Image 1) */}
                        {openCreditsMsgIds.has(msg.id) && (
                          <div className="mb-2.5 px-2.5 py-1 rounded-lg bg-zinc-900/95 border border-amber-500/35 text-amber-300 inline-flex items-center gap-1.5 text-xs animate-fadeIn shadow-xs w-fit">
                            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-[11px] font-medium text-zinc-300">Consommation :</span>
                            <span className="text-xs font-bold text-amber-300">{getMessageCreditsDisplay(msg)}</span>
                          </div>
                        )}

                        <div className="flex items-center">
                          <div className="flex items-center gap-1 sm:gap-2 text-zinc-400">
                            <button
                              type="button"
                              onClick={() => handleReaction(msg.id, 'like')}
                              className={`p-1.5 sm:p-2 rounded-full transition-colors cursor-pointer ${msg.reaction === 'like'
                                  ? 'text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30'
                                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                }`}
                              title="Bonne réponse (j'aime)"
                            >
                              <ThumbsUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReaction(msg.id, 'dislike')}
                              className={`p-1.5 sm:p-2 rounded-full transition-colors cursor-pointer ${msg.reaction === 'dislike'
                                  ? 'text-rose-400 bg-rose-500/20 hover:bg-rose-500/30'
                                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                }`}
                              title="Mauvaise réponse"
                            >
                              <ThumbsDown className="w-4 h-4" />
                            </button>
                            <div className="w-1 sm:w-2" />
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(msg.text);
                                setCopiedMsgId(msg.id);
                                setTimeout(() => setCopiedMsgId(null), 2000);
                              }}
                              className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer text-zinc-400 hover:text-white flex items-center gap-1.5"
                              title="Copier la réponse"
                            >
                              {copiedMsgId === msg.id ? (
                                <>
                                  <Check className="w-4 h-4 text-emerald-400" />
                                  <span className="text-[11px] font-bold text-emerald-400">Copié</span>
                                </>
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>

                            {/* Bouton Crédits de même taille avec texte 'credits' en bas (Tracé bleu Image 1) */}
                            <div className="flex flex-col items-center">
                              <button
                                type="button"
                                onClick={() => toggleCreditsVisibility(msg.id)}
                                className={`p-1.5 sm:p-2 rounded-full transition-all cursor-pointer flex items-center justify-center ${openCreditsMsgIds.has(msg.id)
                                    ? 'text-amber-400 bg-amber-500/20 hover:bg-amber-500/30 ring-1 ring-amber-500/40'
                                    : 'text-zinc-400 hover:text-amber-300 hover:bg-zinc-800'
                                  }`}
                                title="Afficher la consommation en crédits de cette réponse"
                              >
                                <Coins className="w-4 h-4 text-amber-400" />
                              </button>
                              <span className="text-[8.5px] font-semibold text-zinc-400 -mt-0.5 select-none leading-none">credits</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
        )}

        {isWaitingServer && (
          <div className="flex flex-col w-full text-zinc-100 mb-4 animate-fadeIn">
            <div className="flex items-center gap-2.5 bg-[#26282d] px-3.5 py-2.5 rounded-2xl w-fit max-w-[90%] shadow-md">
              <DnaLogo className="w-5 h-5 animate-dna-spin-float shrink-0 text-orange-500" glow={true} />
              <span className="text-xs sm:text-[13px] font-medium text-zinc-200 animate-pulse tracking-wide select-none">
                {aiActivityText || 'Je réfléchis...'}
              </span>
            </div>
          </div>
        )}

        {showScrollBottomBtn && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="sticky bottom-2 self-end z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2a2d35]/95 hover:bg-orange-500 border border-zinc-700 hover:border-orange-400 text-zinc-300 hover:text-white text-xs font-bold shadow-xl transition-all cursor-pointer backdrop-blur-sm active:scale-95 animate-fadeIn"
            title="Revenir en bas du fil de discussion"
          >
            <ChevronDown className="w-3.5 h-3.5 text-orange-400 group-hover:text-white" />
            <span>Bas</span>
          </button>
        )}
      </div>

      {/* ZONE BASSE : FORMULAIRE */}
      <div className="px-3 sm:px-5 pt-2 pb-6 sm:pb-8 shrink-0">
        {/* BANDEAU CRÉDIT INSUFFISANT EN HAUT DU CLAVIER DE SAISIE */}
        {isCreditInsufficient && (
          <div className="mx-2 md:mx-4 mb-2.5 px-3.5 py-2.5 rounded-2xl bg-[#1e1315]/95 border-2 border-rose-500/50 shadow-[0_4px_20px_rgba(244,63,94,0.25)] flex items-center justify-between gap-2.5 animate-fadeIn z-20">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                <Coins className="w-4 h-4 animate-pulse" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-rose-300 truncate">
                  Crédit IA insuffisant
                </span>
                <span className="text-[10px] text-zinc-300 truncate">
                  Votre solde de crédits est épuisé. Rechargez pour continuer.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenAiSubscriptions}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-stone-950 font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              title="Accéder au menu Crédits IA"
            >
              <span>Recharger</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        )}

        <div className="relative mx-2 md:mx-4 rounded-3xl p-[1.5px] overflow-hidden bg-zinc-700/60 shadow-lg group">
          {/* Liseré fin arc-en-ciel rotatif à 360° qui fait le tour complet */}
          <div
            className="absolute -inset-[250%] pointer-events-none animate-rainbow-spin"
            style={{
              background: 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 160deg, #ff3b30 200deg, #ff9500 230deg, #ffcc00 260deg, #34c759 290deg, #00c7be 315deg, #007aff 335deg, #af52de 355deg, transparent 360deg)',
              animation: 'rainbowBorderSpin 5s linear infinite',
            }}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="relative flex flex-col gap-2 bg-[#282a2f] rounded-[22.5px] p-3 sm:p-3.5 transition-all w-full h-full"
          >
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question ou collez votre cours..."
              rows={3}
              className="w-full bg-transparent text-white placeholder-zinc-400 text-sm outline-none resize-none overflow-y-auto select-text"
            />

            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-2 overflow-x-auto flex-1 mr-2 custom-scrollbar pb-1">
                {!resolvedActiveName && attachedResources.length === 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/60 border border-zinc-700/60 rounded-lg text-zinc-400 text-[10px] sm:text-[11px] font-medium shrink-0 select-none" title="Aucun fichier d'étude n'est actuellement sélectionné">
                    <FileText className="w-3 h-3 text-zinc-500 shrink-0" />
                    <span>Aucun fichier sélectionné</span>
                  </div>
                )}

                {resolvedActiveName && (
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg max-w-[160px] sm:max-w-[210px] shrink-0 border bg-orange-500/10 border-orange-500/40"
                    title="Document ouvert à l'écran"
                  >
                    <div className="shrink-0 flex items-center justify-center">
                      <FileIconBadge fileName={resolvedActiveName} size={16} />
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-bold text-orange-300 truncate">
                      {resolvedActiveName}
                    </span>
                    <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-orange-500/25 text-orange-400 shrink-0">
                      Actif
                    </span>
                  </div>
                )}

                {attachedResources.map(res => (
                  <div
                    key={res.id || res.name}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg max-w-[160px] sm:max-w-[210px] shrink-0 border bg-blue-500/10 border-blue-500/40"
                    title="Document joint"
                  >
                    <div className="shrink-0 flex items-center justify-center">
                      <FileIconBadge fileName={res.name} size={16} />
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-bold text-blue-300 truncate">
                      {res.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveAttachment(res);
                      }}
                      className="ml-1 text-blue-400 hover:text-white p-0.5 rounded-full hover:bg-blue-700/50 transition-colors cursor-pointer"
                      title="Retirer ce document"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 self-end">
                {isWaitingServer && (
                  <button
                    type="button"
                    onClick={handleCancelTask}
                    className="px-3 py-2 font-bold rounded-full flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs shrink-0"
                    title="Arrêter la réponse en cours"
                  >
                    <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
                    <span>Arrêter</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="p-2.5 font-bold rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer disabled:cursor-not-allowed shrink-0 bg-[#70a5ff] hover:bg-blue-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-slate-950"
                  title="Envoyer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>


    </div>
  );
}
