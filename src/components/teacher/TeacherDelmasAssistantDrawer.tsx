import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Clock,
  Plus,
  ChevronDown,
  Globe,
  Check,
  X,
  Search,
  FileText,
  Send,
  FolderOpen,
  Trash2,
  Pin,
  Menu,
  MessageSquare,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Square,
  CheckCircle2,
  MapPin,
  Image as ImageIcon,
  Volume2,
  ExternalLink,
} from 'lucide-react';
import { DelmasRobot } from '../DelmasRobot';
import { DnaLogo } from '../DnaLogo';
import { MathText } from '../MathText';
import {
  StudyCloudAPI,
  getGeminiApiKey,
  sendChatMessageToAi,
} from '../../services/api';
import {
  extractDocumentDetails,
  resolveImageBase64,
  blobToBase64,
} from '../../services/documentTextExtractor';
import {
  TeacherGradebookAPI,
  compressImageToUpload,
  generateTeacherEntityId,
  getTeacherAuthToken,
  type TeacherDelmasConversationSummary,
  type TeacherDelmasFileRecord,
  type TeacherDelmasMessageRecord,
  type TeacherDelmasWorkspaceSnapshot,
} from '../../services/teacherGradebookApi';
import {
  DEFAULT_TEACHER_DELMAS_KIMI_MODEL,
  SUPPORTED_DELMAS_LANGUAGES,
  buildTeacherDelmasSystemPrompt,
  classifyTeacherDelmasIntent,
  filterSafeTeacherDelmasActions,
  parseTeacherDelmasAiResponse,
  pickPreferredKimiModel,
  type ResolvedBackgroundModel,
  type TeacherDelmasSheetBridge,
} from '../../utils/teacherDelmasActionEngine';

export interface TeacherDelmasAssistantRibbonButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * Bouton du ruban d'outils (placé tout à droite sous les boutons d'agrandissement)
 * Affiche le robot bleu animé qui regarde autour de lui + "Assistant Delmas" écrit en bas.
 */
export const TeacherDelmasAssistantRibbonButton: React.FC<TeacherDelmasAssistantRibbonButtonProps> = ({
  isOpen,
  onToggle,
  className = '',
}) => {
  return (
    <div
      className={`ml-auto pl-2.5 pr-1 border-l border-slate-300/80 dark:border-slate-700 flex flex-col items-center justify-between shrink-0 select-none ${className}`}
    >
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="delmas-ribbon-trigger flex flex-col items-center justify-center cursor-pointer group active:scale-95 transition-all select-none shrink-0 outline-none focus:outline-none bg-transparent border-0 p-0"
        title={isOpen ? 'Fermer Assistant Delmas' : 'Ouvrir Assistant Delmas'}
      >
        <div
          className={`relative p-0.5 rounded-full transition-all duration-200 ${
            isOpen
              ? 'ring-2 ring-blue-500 shadow-[0_0_12px_rgba(37,99,235,0.75)] scale-105'
              : 'group-hover:scale-105 shadow-[0_2px_8px_rgba(37,99,235,0.3)]'
          }`}
        >
          <DelmasRobot size={32} variant="blue" />
        </div>
        <span
          className={`text-[9.5px] sm:text-[10px] font-extrabold tracking-tight mt-1 leading-none whitespace-nowrap text-center transition-colors ${
            isOpen
              ? 'text-blue-600 dark:text-blue-300'
              : 'text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300'
          }`}
        >
          Assistant Delmas
        </span>
      </button>
    </div>
  );
};

export interface TeacherDelmasAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sheetBridge?: TeacherDelmasSheetBridge;
}

interface UiChatMessage {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  appliedSummaries?: string[];
  actions?: any[];
  attachments?: Array<{
    id: string;
    fileName: string;
    fileType: string;
    mimeType: string;
    sizeBytes?: number;
    url?: string;
    previewDataUrl?: string;
  }>;
  reaction?: 'like' | 'dislike' | null;
  isStreaming?: boolean;
  isError?: boolean;
  createdAt: number;
}

function formatFileSizeShort(bytes?: number): string {
  const b = Number(bytes) || 0;
  if (b <= 0) return '';
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`;
  return `${(b / (1024 * 1024)).toFixed(2)} Mo`;
}

function createSmallImagePreviewDataUrl(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        resolve(undefined);
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 220;
          const ratio = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          const w = Math.max(1, Math.round(img.width * ratio));
          const h = Math.max(1, Math.round(img.height * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(undefined);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/webp', 0.72));
        } catch {
          resolve(undefined);
        }
      };
      img.onerror = () => resolve(undefined);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

function createVisionReadyImageDataUrl(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        resolve(undefined);
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1600;
          const ratio = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          const w = Math.max(1, Math.round(img.width * ratio));
          const h = Math.max(1, Math.round(img.height * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(undefined);
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        } catch {
          resolve(undefined);
        }
      };
      img.onerror = () => resolve(undefined);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

function isPlaceholderMediaText(text?: string): boolean {
  if (!text) return true;
  const t = text.trim();
  return !t || /^\[(?:Image jointe|Enregistrement audio joint)\s*:/i.test(t);
}

function getCachedKimiBackgroundModel(): ResolvedBackgroundModel {
  try {
    const raw = localStorage.getItem('studycloud_active_ai_models_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return pickPreferredKimiModel(parsed, DEFAULT_TEACHER_DELMAS_KIMI_MODEL);
      }
    }
  } catch {}
  return { modelId: DEFAULT_TEACHER_DELMAS_KIMI_MODEL };
}

function getWelcomeCopyForLanguage(langCode: string): {
  title: string;
  subtitle: string;
  placeholder: string;
} {
  const hour = new Date().getHours();
  const isEvening = hour >= 18 || hour < 5;
  switch (langCode) {
    case 'en':
      return {
        title: `${isEvening ? 'Good evening' : 'Hello'}! How can I help you?`,
        subtitle: 'Chat freely, ask a question, or tell me what you need on your sheet.',
        placeholder: 'Write a message or ask for a task...',
      };
    case 'es':
      return {
        title: `${isEvening ? 'Buenas noches' : 'Hola'}! ¿En qué puedo ayudarte?`,
        subtitle: 'Conversa libremente, haz una pregunta o dime qué necesitas en tu tabla.',
        placeholder: 'Escribe un mensaje o pide una tarea...',
      };
    case 'ar':
      return {
        title: 'مرحباً! كيف يمكنني مساعدتك؟',
        subtitle: 'تحدث بحرية، اطرح سؤالك أو أخبرني بما تريد تنفيذه في جدولك.',
        placeholder: 'اكتب رسالتك أو اطلب مهمة...',
      };
    case 'de':
      return {
        title: `${isEvening ? 'Guten Abend' : 'Hallo'}! Wie kann ich Ihnen helfen?`,
        subtitle: 'Sprechen Sie frei, stellen Sie eine Frage oder sagen Sie mir, was in Ihrer Tabelle zu tun ist.',
        placeholder: 'Nachricht schreiben oder eine Aufgabe anfragen...',
      };
    case 'pt':
      return {
        title: `${isEvening ? 'Boa noite' : 'Olá'}! Como posso ajudar?`,
        subtitle: 'Converse livremente, faça uma pergunta ou diga o que precisa na sua tabela.',
        placeholder: 'Escreva uma mensagem ou peça uma tarefa...',
      };
    case 'it':
      return {
        title: `${isEvening ? 'Buonasera' : 'Ciao'}! Come posso aiutarti?`,
        subtitle: 'Parla liberamente, fai una domanda o dimmi cosa fare nella tua tabella.',
        placeholder: 'Scrivi un messaggio o chiedi un’azione...',
      };
    default:
      return {
        title: `${isEvening ? 'Bonsoir' : 'Bonjour'} ! Comment puis-je vous aider ?`,
        subtitle: 'Discutez librement, posez vos questions ou demandez-moi une action sur votre tableau.',
        placeholder: 'Écrivez un message ou demandez une action...',
      };
  }
}

/**
 * Menu latéral droit coulissant de manière fluide pour l'espace de discussion Assistant Delmas :
 * - Modèle Kimi imposé automatiquement en arrière-plan (aucun sélecteur de modèle affiché)
 * - Sélecteur de langue qui force l'IA à travailler à 100 % dans la langue choisie
 * - Détection fine de l'intention (discussion libre vs analyse vs action sur le tableau)
 * - Réponse écrite en direct caractère par caractère (streaming fluide)
 * - Connaissance en temps réel de la classe, du trimestre et de la matière ouverte (ciblage strict)
 * - Bouton + d'importation de fichiers & images de tout type (photos de notes, Excel, PDF, Word, Audio)
 * - Sauvegarde D1 des conversations + dossier R2 de fichiers liés à chaque conversation
 */
export const TeacherDelmasAssistantDrawer: React.FC<TeacherDelmasAssistantDrawerProps> = ({
  isOpen,
  onClose,
  sheetBridge,
}) => {
  const [chatLanguage, setChatLanguage] = useState<string>(() => {
    try {
      return localStorage.getItem('studycloud_teacher_delmas_lang') || 'fr';
    } catch {
      return 'fr';
    }
  });
  const [isMainLangMenuOpen, setIsMainLangMenuOpen] = useState(false);
  const [isDrawerLangMenuOpen, setIsDrawerLangMenuOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [openConvMenuId, setOpenConvMenuId] = useState<string | null>(null);

  // Conversations & dossier de fichiers liés à la conversation active
  const [conversations, setConversations] = useState<TeacherDelmasConversationSummary[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>(() =>
    generateTeacherEntityId('tdconv')
  );
  const [currentConversationTitle, setCurrentConversationTitle] =
    useState<string>('Nouvelle discussion');
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [conversationFiles, setConversationFiles] = useState<TeacherDelmasFileRecord[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<TeacherDelmasFileRecord[]>([]);
  const [isFilesFolderOpen, setIsFilesFolderOpen] = useState(false);
  const [isImportingFiles, setIsImportingFiles] = useState(false);

  // État d'envoi IA & écriture en direct
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isStreamingReply, setIsStreamingReply] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState<string>('Assistant Delmas réfléchit...');
  const isGenerating = isThinking || isStreamingReply;
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [workspaceSnapshot, setWorkspaceSnapshot] =
    useState<TeacherDelmasWorkspaceSnapshot | null>(null);

  // Message d'accueil écrit en direct à l'ouverture (discret et sans pression)
  const welcomeCopy = getWelcomeCopyForLanguage(chatLanguage);
  const [displayedWelcomeTitle, setDisplayedWelcomeTitle] = useState<string>('');
  const [isTypingWelcome, setIsTypingWelcome] = useState<boolean>(false);

  // Redimensionnement horizontal du panneau latéral
  const [drawerWidth, setDrawerWidth] = useState<number>(470);
  const [isResizing, setIsResizing] = useState(false);

  const mainLangMenuRef = useRef<HTMLDivElement>(null);
  const drawerLangMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const welcomeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const currentConversationIdRef = useRef<string>(currentConversationId);
  const resolvedKimiModelRef = useRef<ResolvedBackgroundModel>(getCachedKimiBackgroundModel());
  const activeStreamSaveRef = useRef<{
    conversationId: string;
    autoTitle: string;
    language: string;
    userMsgId: string;
    aiMsgId: string;
    promptText: string;
    attachmentMetaList: any[];
    userCreatedAt: number;
    appliedSummaries: string[];
    tokens: number;
    credits: number;
    liveContext: any;
    currentText: string;
    saved: boolean;
  } | null>(null);

  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  const currentChatLangObj =
    SUPPORTED_DELMAS_LANGUAGES.find((l) => l.code === chatLanguage) ||
    SUPPORTED_DELMAS_LANGUAGES[0];

  const activeContext = sheetBridge ? sheetBridge.getContext() : null;

  const activeLocationBadge = activeContext
    ? activeContext.sheetKind === 'subject'
      ? `${activeContext.subjectName || 'Matière'} • ${activeContext.className}${
          activeContext.termName ? ` • ${activeContext.termName}` : ''
        }`
      : `${activeContext.averageCardTitle || 'Moyenne générale'} • ${activeContext.className}`
    : '';

  // Écriture fluide du titre d'accueil lors de l'ouverture sur une discussion vide
  useEffect(() => {
    if (welcomeTimerRef.current) {
      clearInterval(welcomeTimerRef.current);
      welcomeTimerRef.current = null;
    }
    if (!isOpen || messages.length > 0) {
      setDisplayedWelcomeTitle(welcomeCopy.title);
      setIsTypingWelcome(false);
      return;
    }
    const target = welcomeCopy.title;
    let idx = 0;
    setDisplayedWelcomeTitle('');
    setIsTypingWelcome(true);
    welcomeTimerRef.current = setInterval(() => {
      idx += 2;
      if (idx >= target.length) {
        setDisplayedWelcomeTitle(target);
        setIsTypingWelcome(false);
        if (welcomeTimerRef.current) {
          clearInterval(welcomeTimerRef.current);
          welcomeTimerRef.current = null;
        }
      } else {
        setDisplayedWelcomeTitle(target.slice(0, idx));
      }
    }, 18);

    return () => {
      if (welcomeTimerRef.current) {
        clearInterval(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
    };
  }, [isOpen, chatLanguage, messages.length === 0]);

  // Nettoyage complet des timers au démontage
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (welcomeTimerRef.current) {
        clearInterval(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Auto-scroll fluide vers le bas (respecte si l'utilisateur a défilé vers le haut)
  useEffect(() => {
    if (messagesScrollRef.current && !isUserScrolledUpRef.current) {
      messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
    }
  }, [messages, isThinking, isStreamingReply]);

  const handleMessagesScroll = () => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolledUpRef.current = distanceFromBottom > 90;
  };

  // Fermeture des menus déroulants de langue au clic extérieur
  useEffect(() => {
    if (!isMainLangMenuOpen && !isDrawerLangMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (mainLangMenuRef.current && !mainLangMenuRef.current.contains(target)) {
        setIsMainLangMenuOpen(false);
      }
      if (drawerLangMenuRef.current && !drawerLangMenuRef.current.contains(target)) {
        setIsDrawerLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMainLangMenuOpen, isDrawerLangMenuOpen]);

  // Chargement silencieux du modèle Kimi actif + conversations + contexte D1 à l'ouverture
  const refreshConversationsAndWorkspace = useCallback(async () => {
    const token = getTeacherAuthToken();
    try {
      const [convRes, wsRes, modelCfg] = await Promise.all([
        token ? TeacherGradebookAPI.listDelmasConversations().catch(() => null) : Promise.resolve(null),
        token ? TeacherGradebookAPI.getDelmasWorkspaceContext().catch(() => null) : Promise.resolve(null),
        StudyCloudAPI.getRobotRougeConfig().catch(() => null),
      ]);
      if (convRes?.conversations) {
        setConversations(convRes.conversations);
      }
      if (wsRes?.workspace) {
        setWorkspaceSnapshot(wsRes.workspace);
      }
      if (modelCfg?.success && Array.isArray(modelCfg.models)) {
        resolvedKimiModelRef.current = pickPreferredKimiModel(
          modelCfg.models,
          modelCfg.config?.default_model
        );
      }
    } catch {
      // Silencieux hors ligne
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshConversationsAndWorkspace();
    }
  }, [isOpen, refreshConversationsAndWorkspace]);

  const handleSelectLanguage = (code: string) => {
    setChatLanguage(code);
    try {
      localStorage.setItem('studycloud_teacher_delmas_lang', code);
    } catch {}
    if (
      getTeacherAuthToken() &&
      conversations.some((c) => c.id === currentConversationId)
    ) {
      TeacherGradebookAPI.updateDelmasConversation(currentConversationId, {
        language: code,
      }).catch(() => {});
    }
  };

  const stopActiveTypingTimer = () => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  };

  // Créer une nouvelle discussion (+)
  const handleStartNewConversation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopActiveTypingTimer();
    activeStreamSaveRef.current = null;
    const newId = generateTeacherEntityId('tdconv');
    currentConversationIdRef.current = newId;
    setCurrentConversationId(newId);
    setCurrentConversationTitle('Nouvelle discussion');
    setMessages([]);
    setConversationFiles([]);
    setPendingAttachments([]);
    setIsFilesFolderOpen(false);
    setIsHistoryDrawerOpen(false);
    setOpenConvMenuId(null);
    setIsThinking(false);
    setIsStreamingReply(false);
    setInputValue('');
    isUserScrolledUpRef.current = false;
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Ouvrir une conversation existante depuis l'historique (charge ses messages + son dossier de fichiers liés)
  const handleLoadConversation = async (conv: TeacherDelmasConversationSummary) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopActiveTypingTimer();
    activeStreamSaveRef.current = null;
    setIsThinking(false);
    setIsStreamingReply(false);
    setOpenConvMenuId(null);
    setIsHistoryDrawerOpen(false);
    currentConversationIdRef.current = conv.id;
    setCurrentConversationId(conv.id);
    setCurrentConversationTitle(conv.title);
    if (conv.language) {
      setChatLanguage(conv.language);
    }
    setPendingAttachments([]);
    isUserScrolledUpRef.current = false;

    if (!getTeacherAuthToken()) return;
    try {
      const res = await TeacherGradebookAPI.getDelmasConversation(conv.id);
      if (res?.success && currentConversationIdRef.current === conv.id) {
        setMessages(
          (res.messages || []).map((m: TeacherDelmasMessageRecord) => ({
            id: m.id,
            sender: m.sender,
            content: m.content,
            actions: m.actions || [],
            appliedSummaries: Array.isArray(m.actions)
              ? m.actions
                  .map((a: any) => (typeof a?.summary === 'string' ? a.summary : null))
                  .filter(Boolean)
              : [],
            attachments: m.attachments || [],
            reaction: m.reaction || null,
            isStreaming: false,
            createdAt: m.createdAt,
          }))
        );
        setConversationFiles(res.files || []);
      }
    } catch {
      // Silencieux en cas d'erreur réseau
    }
  };

  // Épingler / Désépingler une discussion
  const handleTogglePinConversation = async (conv: TeacherDelmasConversationSummary) => {
    const nextPinned = !conv.isPinned;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conv.id
          ? { ...c, isPinned: nextPinned, pinnedAt: nextPinned ? Date.now() : null }
          : c
      )
    );
    if (getTeacherAuthToken()) {
      await TeacherGradebookAPI.updateDelmasConversation(conv.id, {
        isPinned: nextPinned,
      }).catch(() => {});
      refreshConversationsAndWorkspace();
    }
  };

  // Supprimer une discussion et son dossier de fichiers R2
  const handleDeleteConversation = async (convId: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (convId === currentConversationId) {
      handleStartNewConversation();
    }
    if (getTeacherAuthToken()) {
      await TeacherGradebookAPI.deleteDelmasConversation(convId).catch(() => {});
    }
  };

  // Importation de fichiers & images de tout type (réutilise documentTextExtractor du Menu Création)
  const processImportedFiles = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;
    setIsImportingFiles(true);

    try {
      for (const file of fileList) {
        const origSize = Math.max(0, Number(file.size) || 0);
        const mime = file.type || 'application/octet-stream';
        const isImg =
          mime.startsWith('image/') ||
          /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);
        const isAud =
          mime.startsWith('audio/') ||
          /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(file.name);

        let extractedText = '';
        let imageBase64: string | undefined = undefined;
        let audioBase64: string | undefined = undefined;
        let documentBase64: string | undefined = undefined;
        let documentImages: Array<{ base64: string; mimeType: string; name?: string }> | undefined =
          undefined;
        let fileType = 'document';
        let r2DataUrlToUpload: string | undefined = undefined;
        let previewDataUrl: string | undefined = undefined;

        if (isImg) {
          fileType = 'image';
          // 1. Image nette redimensionnée (<= 1600px JPEG 88%) pour une lecture OCR / Vision ultra-rapide et précise
          imageBase64 =
            (await createVisionReadyImageDataUrl(file)) ||
            (await resolveImageBase64(file, `${file.name}_${file.size}`));
          // 2. Miniature légère pour l'aperçu rapide
          previewDataUrl = await createSmallImagePreviewDataUrl(file);
          // 3. Image compressée WebP pour l'enregistrement dans le dossier R2 de la conversation (tout en facturant origSize en Mo !)
          try {
            const compressedBlob = await compressImageToUpload(file, 960, 0.82);
            r2DataUrlToUpload = await blobToBase64(compressedBlob);
          } catch {
            r2DataUrlToUpload = imageBase64;
          }
          // Ne pas injecter de texte factice : le contenu réel sera lu par la Vision IA
          extractedText = '';
        } else if (isAud) {
          fileType = 'audio';
          audioBase64 = await blobToBase64(file);
          if (origSize <= 5 * 1024 * 1024) {
            r2DataUrlToUpload = audioBase64;
          }
          extractedText = '';
        } else {
          // Extraction complète via documentTextExtractor (PDF, Word, Excel, CSV, PowerPoint, Texte...)
          const details = await extractDocumentDetails({
            id: `local-${Date.now()}-${file.name}`,
            name: file.name,
            type: mime,
            file,
            blob: file,
          });
          fileType = details.fileType || 'document';
          extractedText = details.textContent || '';
          documentBase64 = details.documentBase64;
          documentImages = details.documentImages;
          if (origSize <= 5 * 1024 * 1024) {
            try {
              r2DataUrlToUpload = await blobToBase64(file);
            } catch {}
          }
        }

        const tempFileId = generateTeacherEntityId('tdfile');
        let savedRecord: TeacherDelmasFileRecord = {
          id: tempFileId,
          conversationId: currentConversationId,
          fileName: file.name,
          mimeType: mime,
          fileType,
          url: previewDataUrl || imageBase64,
          previewDataUrl: previewDataUrl || imageBase64,
          sizeBytes: origSize,
          compressedSizeBytes: origSize,
          extractedText,
          createdAt: Date.now(),
          imageBase64,
          audioBase64,
          documentBase64,
          documentImages,
        };

        // Enregistrement dans le dossier R2 + table D1 teacher_delmas_files de cette conversation
        if (getTeacherAuthToken()) {
          try {
            const uploaded = await TeacherGradebookAPI.uploadDelmasConversationFile(
              currentConversationId,
              {
                id: tempFileId,
                fileName: file.name,
                mimeType: mime,
                fileType,
                dataUrl: r2DataUrlToUpload,
                previewDataUrl,
                extractedText,
                originalSizeBytes: origSize,
                sizeBytes: origSize,
                conversationTitle:
                  currentConversationTitle !== 'Nouvelle discussion'
                    ? currentConversationTitle
                    : `Fichier : ${file.name}`,
                language: chatLanguage,
              }
            );
            if (uploaded?.file) {
              savedRecord = {
                ...uploaded.file,
                imageBase64,
                audioBase64,
                documentBase64,
                documentImages,
              };
            }
          } catch (uploadErr: any) {
            // Si le stockage de l'utilisateur est saturé (HTTP 413), le modal d'alerte s'ouvre automatiquement
            if (uploadErr?.isStorageLimitExceeded || uploadErr?.status === 413) {
              throw uploadErr;
            }
          }
        }

        setConversationFiles((prev) => [...prev, savedRecord]);
        setPendingAttachments((prev) => [...prev, savedRecord]);
      }

      refreshConversationsAndWorkspace();
    } catch (err: any) {
      if (err?.isStorageLimitExceeded || err?.status === 413) {
        const quotaMsg: UiChatMessage = {
          id: generateTeacherEntityId('tdmsg'),
          sender: 'ai',
          content:
            err?.message ||
            "Votre espace de stockage est plein. Veuillez libérer de l'espace ou augmenter votre stockage pour importer de nouveaux fichiers.",
          isError: true,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, quotaMsg]);
      }
    } finally {
      setIsImportingFiles(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length > 0) {
      processImportedFiles(files);
    }
  };

  // Support du Collage direct d'image (Ctrl+V) dans la zone de texte
  const handlePasteInTextarea = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) imageFiles.push(f);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      processImportedFiles(imageFiles);
    }
  };

  // Supprimer un fichier du dossier de la conversation
  const handleDeleteConversationFile = async (fileId: string) => {
    setConversationFiles((prev) => prev.filter((f) => f.id !== fileId));
    setPendingAttachments((prev) => prev.filter((f) => f.id !== fileId));
    if (getTeacherAuthToken()) {
      await TeacherGradebookAPI.deleteDelmasConversationFile(fileId).catch(() => {});
      refreshConversationsAndWorkspace();
    }
  };

  const persistStreamedExchangeToD1 = useCallback(
    async (finalTextOverride?: string) => {
      const meta = activeStreamSaveRef.current;
      if (!meta || meta.saved) return;
      meta.saved = true;

      const textToSave = (finalTextOverride ?? meta.currentText ?? '').trim();
      if (!getTeacherAuthToken() || !textToSave) return;

      if (currentConversationIdRef.current === meta.conversationId) {
        setCurrentConversationTitle(meta.autoTitle);
      }

      await TeacherGradebookAPI.saveDelmasMessages(meta.conversationId, {
        title: meta.autoTitle,
        language: meta.language,
        contextYearId: meta.liveContext?.yearId,
        contextSchoolId: meta.liveContext?.schoolId,
        contextClassId: meta.liveContext?.classId,
        contextTermId: meta.liveContext?.termId,
        contextSubjectId: meta.liveContext?.subjectId,
        contextSheetKind: meta.liveContext?.sheetKind || 'subject',
        messages: [
          {
            id: meta.userMsgId,
            sender: 'user',
            content: meta.promptText,
            attachments: meta.attachmentMetaList,
            createdAt: meta.userCreatedAt,
          },
          {
            id: meta.aiMsgId,
            sender: 'ai',
            content: textToSave,
            actions: meta.appliedSummaries.map((s) => ({ summary: s })),
            tokens: meta.tokens,
            credits: meta.credits,
            createdAt: Date.now(),
          },
        ],
      }).catch(() => {});

      refreshConversationsAndWorkspace();
    },
    [refreshConversationsAndWorkspace]
  );

  // Arrêter la génération ou l'écriture en direct (conserve proprement le texte déjà écrit)
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopActiveTypingTimer();
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
    setIsThinking(false);
    setIsStreamingReply(false);
    if (activeStreamSaveRef.current && !activeStreamSaveRef.current.saved) {
      persistStreamedExchangeToD1(activeStreamSaveRef.current.currentText);
    }
  };

  // Envoi d'un message à l'Assistant Delmas (Kimi en arrière-plan + détection d'intention + écriture en direct)
  const handleSendMessage = async () => {
    const rawText = inputValue.trim();
    if ((!rawText && pendingAttachments.length === 0) || isGenerating || isImportingFiles) {
      return;
    }

    stopActiveTypingTimer();
    activeStreamSaveRef.current = null;
    isUserScrolledUpRef.current = false;

    const currentAttachments = [...pendingAttachments];
    const hasNewAttachments = currentAttachments.length > 0;
    const promptText =
      rawText ||
      (currentAttachments.length === 1
        ? `Peux-tu lire ce fichier « ${currentAttachments[0].fileName} » ?`
        : `Peux-tu lire ces ${currentAttachments.length} fichiers joints ?`);

    const targetConversationId = currentConversationId;
    const userMsgId = generateTeacherEntityId('tdmsg');
    const aiMsgId = generateTeacherEntityId('tdmsg');
    const now = Date.now();

    const attachmentMetaList = currentAttachments.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      fileType: f.fileType,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      url: f.url || f.previewDataUrl,
      previewDataUrl: f.previewDataUrl,
    }));

    const userMessage: UiChatMessage = {
      id: userMsgId,
      sender: 'user',
      content: promptText,
      attachments: attachmentMetaList,
      createdAt: now,
    };

    const previousMessages = messages.filter((m) => !m.isError && m.content.trim().length > 0);
    setMessages([...messages, userMessage]);
    setInputValue('');
    setPendingAttachments([]);

    const liveContext = sheetBridge ? sheetBridge.getContext() : null;
    const allConvFiles = [
      ...conversationFiles,
      ...currentAttachments.filter(
        (att) => !conversationFiles.some((cf) => cf.id === att.id)
      ),
    ];

    // 1. Détection fine de l'intention réelle (discussion libre vs analyse lecture seule vs action sur le tableau)
    const intentResult = classifyTeacherDelmasIntent({
      message: rawText,
      hasNewAttachments,
      hasConversationFiles: allConvFiles.length > 0,
      activeContext: liveContext,
      workspaceSnapshot,
      recentMessages: previousMessages.slice(-6).map((m) => ({
        sender: m.sender,
        content: m.content,
      })),
    });

    setThinkingLabel(
      hasNewAttachments
        ? 'Lecture du fichier en cours...'
        : intentResult.intent === 'action'
        ? 'Préparation de votre demande...'
        : intentResult.intent === 'inspect'
        ? 'Analyse en cours...'
        : 'Assistant Delmas réfléchit...'
    );
    setIsThinking(true);
    setIsStreamingReply(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const systemPrompt = liveContext
        ? buildTeacherDelmasSystemPrompt({
            languageCode: chatLanguage,
            activeContext: liveContext,
            workspaceSnapshot,
            conversationFiles: allConvFiles,
            intent: intentResult.intent,
            needsWorkspaceDb: intentResult.needsWorkspaceDb,
            referencesActiveFiles: intentResult.referencesActiveFiles,
          })
        : `Tu es Assistant Delmas. ${currentChatLangObj.promptInstruction}`;

      // Historique propre avec alternance stricte user / assistant
      const sanitizedTurns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      for (const m of previousMessages.slice(-12)) {
        const role: 'user' | 'assistant' = m.sender === 'user' ? 'user' : 'assistant';
        const last = sanitizedTurns[sanitizedTurns.length - 1];
        if (last && last.role === role) {
          last.content = `${last.content}\n\n${m.content}`;
        } else {
          sanitizedTurns.push({ role, content: m.content });
        }
      }
      const lastTurn = sanitizedTurns[sanitizedTurns.length - 1];
      if (lastTurn && lastTurn.role === 'user') {
        lastTurn.content = `${lastTurn.content}\n\n${promptText}`;
      } else {
        sanitizedTurns.push({ role: 'user', content: promptText });
      }

      const historyPayload = [
        { role: 'system', content: systemPrompt },
        ...sanitizedTurns,
      ];

      // =========================================================================
      // MÉMOIRE PERMANENTE DES FICHIERS DU DOSSIER DE CETTE CONVERSATION
      // (Comme dans le Menu Création, tous les fichiers non supprimés restent connectés !)
      // =========================================================================
      const hasAnyConvFiles = allConvFiles.length > 0;
      const isExplicitReanalysisRequested =
        /(?:r[ée]-?analyse|r[ée]examine|re-?regarde|regarde\s+[àa]\s*nouveau|revois|refais\s+(?:l'|une\s+)?analyse|nouvelle\s+analyse|relis|zoom\s+sur|v[ée]rifie\s+[àa]\s*nouveau|tu\s+(?:ne\s+)?(?:la|le|les)?\s*vois|tu\s+vois\s+pas|vois[- ]tu|as[- ]tu\s+vu|tu\s+as\s+vu|l['’]?image|limage)/i.test(
          rawText
        );

      const imageFilesInConv = [
        ...currentAttachments.filter((f) => f.fileType === 'image' || Boolean(f.imageBase64)),
        ...[...allConvFiles]
          .reverse()
          .filter(
            (f) =>
              (f.fileType === 'image' || Boolean(f.imageBase64)) &&
              !currentAttachments.some((c) => c.id === f.id)
          ),
      ];

      const unanalyzedImageRecord = imageFilesInConv.find((f) =>
        isPlaceholderMediaText(f.extractedText)
      );
      const targetImageRecord =
        unanalyzedImageRecord ||
        (hasNewAttachments || isExplicitReanalysisRequested ? imageFilesInConv[0] : undefined);

      const shouldRunVisionPass = Boolean(
        targetImageRecord &&
          (hasNewAttachments ||
            isExplicitReanalysisRequested ||
            (intentResult.intent !== 'chat' && isPlaceholderMediaText(targetImageRecord.extractedText)))
      );

      // Si une image d'une discussion rechargée n'a plus son base64 en RAM, on la recharge depuis son URL R2 signée
      let resolvedImageBase64 = shouldRunVisionPass ? targetImageRecord?.imageBase64 : undefined;
      if (
        shouldRunVisionPass &&
        targetImageRecord &&
        !resolvedImageBase64 &&
        targetImageRecord.url
      ) {
        try {
          const imgRes = await fetch(targetImageRecord.url);
          if (imgRes.ok) {
            const imgBlob = await imgRes.blob();
            resolvedImageBase64 = await blobToBase64(imgBlob);
          }
        } catch {}
      }

      // Support multi-images dans le même envoi (ex: page 1 + page 2 d'un relevé)
      const extraPendingImages = shouldRunVisionPass
        ? currentAttachments
            .filter(
              (f) =>
                f.id !== targetImageRecord?.id &&
                (f.fileType === 'image' || Boolean(f.imageBase64)) &&
                Boolean(f.imageBase64)
            )
            .slice(0, 3)
            .map((f) => ({
              base64: f.imageBase64 as string,
              mimeType: f.mimeType || 'image/jpeg',
              name: f.fileName,
            }))
        : [];

      const audioFilesInConv = [
        ...currentAttachments.filter((f) => f.fileType === 'audio' || Boolean(f.audioBase64)),
        ...[...allConvFiles]
          .reverse()
          .filter(
            (f) =>
              (f.fileType === 'audio' || Boolean(f.audioBase64)) &&
              !currentAttachments.some((c) => c.id === f.id)
          ),
      ];
      const targetAudioRecord = audioFilesInConv.find(
        (f) => hasNewAttachments || isPlaceholderMediaText(f.extractedText)
      );
      const shouldRunAudioPass = Boolean(
        targetAudioRecord &&
          targetAudioRecord.audioBase64 &&
          (hasNewAttachments ||
            (intentResult.intent !== 'chat' && isPlaceholderMediaText(targetAudioRecord.extractedText)))
      );

      const firstDoc =
        currentAttachments.find(
          (f) => f.documentBase64 || (f.documentImages && f.documentImages.length > 0)
        ) ||
        [...allConvFiles]
          .reverse()
          .find(
            (f) =>
              (f.documentBase64 || (f.documentImages && f.documentImages.length > 0)) &&
              isPlaceholderMediaText(f.extractedText)
          );

      const mergedDocumentImages = [
        ...extraPendingImages,
        ...(firstDoc?.documentImages || []),
      ].slice(0, 3);

      // Tous les fichiers non supprimés du dossier restent connectés en mémoire texte permanente !
      const combinedDocText =
        hasAnyConvFiles && intentResult.intent !== 'chat'
          ? allConvFiles
              .filter((f) => !isPlaceholderMediaText(f.extractedText))
              .map((f) => `[Fichier: ${f.fileName}]\n${f.extractedText}`)
              .join('\n\n')
          : '';

      const activeAttachedFileName =
        hasAnyConvFiles && (intentResult.intent !== 'chat' || shouldRunVisionPass || shouldRunAudioPass)
          ? currentAttachments.length > 0
            ? currentAttachments.map((f) => f.fileName).join(', ')
            : allConvFiles.map((f) => f.fileName).join(', ')
          : undefined;

      // Modèle Kimi résolu silencieusement en arrière-plan (ex: @cf/moonshotai/kimi-k2.7-code)
      const kimiModel = resolvedKimiModelRef.current || {
        modelId: DEFAULT_TEACHER_DELMAS_KIMI_MODEL,
      };
      const configuredToken = kimiModel.apiToken || undefined;
      const activeUserId = (() => {
        try {
          return localStorage.getItem('unifolder_user_id') || undefined;
        } catch {
          return undefined;
        }
      })();

      const aiRes = await sendChatMessageToAi({
        messages: historyPayload,
        history: historyPayload,
        prompt: promptText,
        message: promptText,
        userId: activeUserId,
        conversationId: targetConversationId,
        model: kimiModel.modelId,
        selectedModel: kimiModel.modelId,
        apiKey: configuredToken || getGeminiApiKey() || undefined,
        apiToken: configuredToken,
        isOrchestratorChat: false,
        requested_type: undefined,
        skipChatHistory: true,
        assistantContext: 'teacher_gradebook',
        attachedFileName: activeAttachedFileName,
        attachedFileContent: combinedDocText || undefined,
        imageBase64: resolvedImageBase64,
        mimeType: resolvedImageBase64
          ? (resolvedImageBase64.startsWith('data:image/jpeg') ? 'image/jpeg' : targetImageRecord?.mimeType || 'image/jpeg')
          : firstDoc?.mimeType,
        audioBase64: shouldRunAudioPass ? targetAudioRecord?.audioBase64 : undefined,
        audioMimeType: shouldRunAudioPass ? targetAudioRecord?.mimeType : undefined,
        documentBase64: firstDoc?.documentBase64,
        documentMimeType: firstDoc?.mimeType,
        documentImages: mergedDocumentImages.length > 0 ? mergedDocumentImages : undefined,
        signal: controller.signal,
        abortSignal: controller.signal,
      });

      // Persister définitivement en D1 (teacher_delmas_files.extracted_text) + en mémoire locale
      // le rapport réel Vision / Whisper pour qu'Assistant Delmas n'oublie JAMAIS ce fichier !
      if (aiRes.perceptionReport && (targetImageRecord || targetAudioRecord || firstDoc)) {
        const targetId = targetImageRecord?.id || targetAudioRecord?.id || firstDoc?.id;
        const cleanReport = String(aiRes.perceptionReport).trim();
        if (targetId && cleanReport) {
          setConversationFiles((prev) =>
            prev.map((cf) =>
              cf.id === targetId ? { ...cf, extractedText: cleanReport } : cf
            )
          );
          if (getTeacherAuthToken()) {
            TeacherGradebookAPI.updateDelmasConversationFile(targetId, {
              extractedText: cleanReport,
            }).catch(() => {});
          }
        }
      }

      // Si l'utilisateur a annulé ou changé de conversation pendant la requête
      if (
        controller.signal.aborted ||
        currentConversationIdRef.current !== targetConversationId
      ) {
        setIsThinking(false);
        setIsStreamingReply(false);
        return;
      }

      const rawAiOutput =
        aiRes.raw_response || aiRes.rawResponse || aiRes.response || aiRes.chat_response || '';

      // Extraction propre + pare-feu de sécurité (zéro action en mode chat/inspect + anti-injection + zéro faux matricules 1..10 + zéro faux save_gradebook vide)
      const parsed = parseTeacherDelmasAiResponse(rawAiOutput, {
        allowActions: intentResult.intent === 'action',
      });
      const sourceFileTexts = [
        ...(aiRes.perceptionReport ? [String(aiRes.perceptionReport)] : []),
        ...allConvFiles
          .filter((f) => !isPlaceholderMediaText(f.extractedText))
          .map((f) => String(f.extractedText || '')),
      ];
      const safeActions = filterSafeTeacherDelmasActions(parsed.actions, rawText, {
        hasAttachedFiles: hasAnyConvFiles && (intentResult.referencesActiveFiles || shouldRunVisionPass),
        sourceFileTexts,
      });

      // Exécution immédiate des actions demandées sur le tableau ouvert
      let appliedSummaries: string[] = [];
      if (safeActions.length > 0 && sheetBridge) {
        const resSummaries = await sheetBridge.executeActions(
          safeActions,
          workspaceSnapshot
        );
        if (Array.isArray(resSummaries)) {
          appliedSummaries = resSummaries.filter(Boolean);
        }
      }

      if (
        controller.signal.aborted ||
        currentConversationIdRef.current !== targetConversationId
      ) {
        setIsThinking(false);
        setIsStreamingReply(false);
        return;
      }

      const fullResponseText = parsed.chatResponse || 'Je suis à votre écoute.';
      const autoTitle =
        currentConversationTitle === 'Nouvelle discussion'
          ? promptText.replace(/\s+/g, ' ').slice(0, 70)
          : currentConversationTitle;

      const actionsPayload = safeActions.map((a, idx) => ({
        ...a,
        summary: appliedSummaries[idx] || undefined,
      }));

      activeStreamSaveRef.current = {
        conversationId: targetConversationId,
        autoTitle,
        language: chatLanguage,
        userMsgId,
        aiMsgId,
        promptText,
        attachmentMetaList,
        userCreatedAt: now,
        appliedSummaries,
        tokens: aiRes.tokens || 0,
        credits: aiRes.credits_deducted || aiRes.credits || 0,
        liveContext,
        currentText: '',
        saved: false,
      };

      setIsThinking(false);
      abortControllerRef.current = null;

      const finalizeLiveMessage = (finalText: string) => {
        stopActiveTypingTimer();
        setIsStreamingReply(false);
        if (currentConversationIdRef.current === targetConversationId) {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === aiMsgId);
            if (!exists) {
              return [
                ...prev,
                {
                  id: aiMsgId,
                  sender: 'ai',
                  content: finalText,
                  actions: actionsPayload,
                  appliedSummaries,
                  isStreaming: false,
                  createdAt: Date.now(),
                },
              ];
            }
            return prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    content: finalText,
                    actions: actionsPayload,
                    appliedSummaries,
                    isStreaming: false,
                  }
                : m
            );
          });
        }
        persistStreamedExchangeToD1(finalText);
      };

      // Si l'onglet est en arrière-plan, on finalise directement ; sinon écriture EN DIRECT !
      if (typeof document !== 'undefined' && document.hidden) {
        finalizeLiveMessage(fullResponseText);
        return;
      }

      // Insertion immédiate de la bulle vide en mode écriture en direct
      setIsStreamingReply(true);
      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          sender: 'ai',
          content: '',
          actions: actionsPayload,
          appliedSummaries,
          isStreaming: true,
          createdAt: Date.now(),
        },
      ]);

      // Découpage en graphèmes/points de code Unicode pour ne jamais couper un emoji en deux
      const chars = Array.from(fullResponseText);
      const totalChars = chars.length;
      const tickMs = 16;
      const charsPerTick =
        totalChars <= 220
          ? 2
          : Math.max(
              3,
              Math.ceil(
                totalChars /
                  Math.max(1, Math.floor(Math.min(4000, Math.max(1500, totalChars * 4.5)) / tickMs))
              )
            );
      let cursor = 0;

      typingTimerRef.current = setInterval(() => {
        if (currentConversationIdRef.current !== targetConversationId) {
          stopActiveTypingTimer();
          setIsStreamingReply(false);
          return;
        }
        cursor += charsPerTick;
        if (cursor >= totalChars) {
          if (activeStreamSaveRef.current) {
            activeStreamSaveRef.current.currentText = fullResponseText;
          }
          finalizeLiveMessage(fullResponseText);
        } else {
          const partial = chars.slice(0, cursor).join('');
          if (activeStreamSaveRef.current) {
            activeStreamSaveRef.current.currentText = partial;
          }
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, content: partial } : m))
          );
        }
      }, tickMs);
    } catch (err: any) {
      setIsThinking(false);
      setIsStreamingReply(false);
      abortControllerRef.current = null;
      if (err?.name === 'AbortError') return;
      const errMessage: UiChatMessage = {
        id: aiMsgId,
        sender: 'ai',
        content:
          err?.message ||
          "Une erreur est survenue lors de la communication avec l'Assistant Delmas. Veuillez vérifier votre connexion et réessayer.",
        isError: true,
        isStreaming: false,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errMessage]);
    }
  };

  // Redimensionnement horizontal fluide du panneau latéral droit sur ordinateur
  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = drawerWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const nextWidth = Math.min(740, Math.max(360, startWidth + deltaX));
      setDrawerWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const filteredConversations = conversations.filter(
    (c) =>
      !historySearch.trim() ||
      c.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <>
      <style>{`
        @keyframes rainbowBorderSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Input fichier caché pour le bouton + d'importation (Images, PDF, Excel, Word, Audio, Texte...) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.ppt,.pptx,audio/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Fond discret sur mobile uniquement pour fermer au toucher extérieur */}
      <div
        onClick={onClose}
        className={`sm:hidden fixed inset-0 z-[80] bg-black/45 backdrop-blur-[1px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* MENU LATÉRAL DROIT COULISSANT FLUIDE */}
      <aside
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const droppedFiles = e.dataTransfer?.files
            ? Array.from(e.dataTransfer.files)
            : [];
          if (droppedFiles.length > 0) {
            processImportedFiles(droppedFiles);
          }
        }}
        style={{
          width:
            typeof window !== 'undefined' && window.innerWidth >= 640
              ? `${drawerWidth}px`
              : undefined,
        }}
        className={`absolute top-0 right-0 bottom-0 z-[85] w-full sm:max-w-[92vw] h-full flex flex-col bg-[#1e2024] text-white font-nunito overflow-hidden border-l border-zinc-700/80 shadow-[-14px_0_38px_rgba(0,0,0,0.55)] select-none transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      >
        {/* Poignée latérale gauche sur ordinateur pour élargir/réduire le menu latéral droit */}
        <div
          onMouseDown={handleStartResize}
          className={`hidden sm:block absolute left-0 top-0 bottom-0 w-1.5 z-50 cursor-col-resize transition-colors ${
            isResizing ? 'bg-orange-500/60' : 'hover:bg-orange-500/40'
          }`}
          title="Glisser pour ajuster la largeur du panneau Assistant Delmas"
        />

        {/* =================================================================== */}
        {/* 1. EN-TÊTE SUPÉRIEUR (Historique | + | FR FR | Fermer — SANS MODÈLE) */}
        {/* =================================================================== */}
        <div className="flex items-center justify-between px-2.5 sm:px-3.5 py-2 bg-[#23252a] border-b border-zinc-700/60 shrink-0 relative z-30 shadow-sm w-full max-w-full flex-nowrap gap-1.5">
          {/* Groupe Gauche : Historique, + Nouvelle discussion, Dossier fichiers */}
          <div className="flex items-center gap-1.5 min-w-0 flex-nowrap shrink">
            {/* Bouton Historique */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsHistoryDrawerOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-[11px] sm:text-xs font-bold transition-all cursor-pointer border border-zinc-700 active:scale-95 shrink-0 touch-manipulation"
              title="Historique des discussions"
            >
              <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>Historique</span>
            </button>

            {/* Bouton + (Nouvelle discussion) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleStartNewConversation();
              }}
              className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-all cursor-pointer border border-zinc-700 active:scale-95 shrink-0 flex items-center justify-center touch-manipulation"
              title="Nouvelle discussion"
            >
              <Plus className="w-4 h-4 text-orange-400" />
            </button>

            {/* Bouton Dossier des fichiers liés à cette conversation */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFilesFolderOpen((prev) => !prev);
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer border active:scale-95 shrink-0 touch-manipulation ${
                isFilesFolderOpen || conversationFiles.length > 0
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-300 hover:bg-orange-500/25'
                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-white'
              }`}
              title="Dossier des fichiers et images liés à cette conversation"
            >
              <FolderOpen className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="hidden xs:inline">Dossier</span>
              <span className="px-1.5 py-0.2 rounded-full bg-zinc-900/80 text-[10px] font-extrabold text-orange-400">
                {conversationFiles.length}
              </span>
            </button>
          </div>

          {/* Groupe Droite : Sélecteur Langue (🌐 FR FR ⌄) + Bouton [🤖 Fermer] */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
            {/* Sélecteur de langue qui force l'IA à travailler dans la langue choisie */}
            <div className="relative" ref={mainLangMenuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMainLangMenuOpen((prev) => !prev);
                }}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-[#282a2f] hover:bg-[#32353b] border border-zinc-700/80 text-zinc-200 text-[11px] sm:text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 touch-manipulation"
                title={`Langue imposée à l'IA : ${currentChatLangObj.name}`}
              >
                <Globe className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="text-xs">{currentChatLangObj.flag}</span>
                <span className="text-[11px] font-semibold">
                  {currentChatLangObj.code.toUpperCase()}
                </span>
                <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
              </button>

              {isMainLangMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 max-w-[calc(100vw-32px)] bg-[#181a20] border border-zinc-700 rounded-xl shadow-2xl py-1.5 z-50 animate-fadeIn backdrop-blur-md">
                  <div className="px-3 py-1.5 border-b border-zinc-800/80 text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Langue de l&apos;IA</span>
                    <span className="text-[9px] text-orange-400 font-semibold">
                      {currentChatLangObj.name}
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                    {SUPPORTED_DELMAS_LANGUAGES.map((lang) => {
                      const isSelected = chatLanguage === lang.code;
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            handleSelectLanguage(lang.code);
                            setIsMainLangMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-orange-500/15 text-orange-400 font-bold'
                              : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{lang.flag}</span>
                            <span>{lang.name}</span>
                            <span className="text-[10px] text-zinc-500">
                              ({lang.nativeName})
                            </span>
                          </div>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bouton Fermer avec mini robot bleu + texte "Fermer" */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/50 text-orange-400 text-[11px] font-extrabold cursor-pointer hover:bg-orange-500/30 transition-colors shrink-0 touch-manipulation active:scale-95"
              title="Fermer Assistant Delmas"
            >
              <DelmasRobot size={15} variant="blue" />
              <span className="inline text-[11px] font-extrabold text-orange-400 leading-none">
                Fermer
              </span>
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 1B. BANDEAU D'EMPLACEMENT ACTIF (CLASSE & MATIÈRE ACTUELLEMENT OUVERTES) */}
        {/* =================================================================== */}
        {activeLocationBadge && (
          <div className="px-3 py-1.5 bg-[#191b20] border-b border-zinc-800/80 flex items-center justify-between gap-2 text-[11px] text-zinc-300 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-zinc-400 font-medium shrink-0">Tableau actif :</span>
              <span className="font-bold text-sky-300 truncate" title={activeLocationBadge}>
                {activeLocationBadge}
              </span>
            </div>
            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold shrink-0">
              Connecté
            </span>
          </div>
        )}

        {/* =================================================================== */}
        {/* 1C. DOSSIER DES FICHIERS LIÉS À CETTE CONVERSATION                  */}
        {/* =================================================================== */}
        {isFilesFolderOpen && (
          <div className="bg-[#181a20] border-b border-zinc-700/70 px-3.5 py-2.5 shrink-0 max-h-52 overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-300">
                <FolderOpen className="w-3.5 h-3.5 text-orange-400" />
                <span>Dossier de la conversation ({conversationFiles.length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-0.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Ajouter</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilesFolderOpen(false)}
                  className="p-0.5 rounded text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {conversationFiles.length === 0 ? (
              <div className="text-[11px] text-zinc-500 py-2 text-center">
                Aucun fichier lié à cette discussion. Appuyez sur le bouton <strong>+</strong> en bas pour importer une image, un fichier Excel, PDF, Word ou Audio.
              </div>
            ) : (
              <div className="space-y-1.5">
                {conversationFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#23252b] border border-zinc-700/70 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {f.previewDataUrl || (f.fileType === 'image' && f.url) ? (
                        <img
                          src={f.previewDataUrl || f.url}
                          alt={f.fileName}
                          className="w-7 h-7 rounded-md object-cover border border-zinc-600 shrink-0"
                        />
                      ) : f.fileType === 'audio' ? (
                        <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-orange-400 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-zinc-200 truncate text-[11.5px]">
                          {f.fileName}
                        </div>
                        <div className="text-[9.5px] text-zinc-400">
                          {f.fileType.toUpperCase()}{' '}
                          {f.sizeBytes ? `• ${formatFileSizeShort(f.sizeBytes)}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {f.url &&
                        (/^https?:\/\//i.test(f.url) ||
                          /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(f.url)) && (
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition"
                          title="Ouvrir le fichier"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteConversationFile(f.id)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/15 transition cursor-pointer"
                        title="Supprimer ce fichier du dossier de la conversation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* 2. TIROIR HISTORIQUE COULISSANT INTERNE                             */}
        {/* =================================================================== */}
        {isHistoryDrawerOpen && (
          <div
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex animate-fadeIn touch-manipulation"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsHistoryDrawerOpen(false);
                setOpenConvMenuId(null);
              }
            }}
          >
            <div
              className="w-full max-w-[315px] sm:max-w-[345px] h-full bg-[#1e2024] border-r border-zinc-800 flex flex-col p-4 shadow-2xl"
              onClick={(e) => {
                e.stopPropagation();
                setOpenConvMenuId(null);
              }}
            >
              <div className="flex flex-col gap-1.5 pb-3 border-b border-zinc-700/60 mb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <h3 className="text-xs sm:text-[13px] font-bold text-white whitespace-nowrap truncate">
                      Discussions récentes
                    </h3>
                  </div>
                  <div
                    className="flex items-center gap-1.5 shrink-0 relative"
                    ref={drawerLangMenuRef}
                  >
                    <button
                      type="button"
                      onClick={() => setIsDrawerLangMenuOpen(!isDrawerLangMenuOpen)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap shrink-0 select-none"
                      title={`Langue de l'IA : ${currentChatLangObj.name}`}
                    >
                      <Globe className="w-3 h-3 text-orange-400 shrink-0" />
                      <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap leading-none shrink-0">
                        <span>{currentChatLangObj.flag}</span>
                        <span className="font-bold tracking-tight">
                          {currentChatLangObj.code.toUpperCase()}
                        </span>
                      </span>
                      <ChevronDown className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
                    </button>

                    {isDrawerLangMenuOpen && (
                      <div className="absolute right-6 top-full mt-1.5 w-52 bg-[#181a20] border border-zinc-700 rounded-xl shadow-2xl py-1.5 z-50 animate-fadeIn backdrop-blur-md">
                        <div className="px-3 py-1.5 border-b border-zinc-800/80 text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                          <span>Langue de l&apos;IA</span>
                          <span className="text-[9px] text-orange-400 font-semibold">
                            {currentChatLangObj.name}
                          </span>
                        </div>
                        <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                          {SUPPORTED_DELMAS_LANGUAGES.map((lang) => {
                            const isSelected = chatLanguage === lang.code;
                            return (
                              <button
                                key={lang.code}
                                type="button"
                                onClick={() => {
                                  handleSelectLanguage(lang.code);
                                  setIsDrawerLangMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-orange-500/15 text-orange-400 font-bold'
                                    : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{lang.flag}</span>
                                  <span>{lang.name}</span>
                                  <span className="text-[10px] text-zinc-500">
                                    ({lang.nativeName})
                                  </span>
                                </div>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsHistoryDrawerOpen(false);
                        setOpenConvMenuId(null);
                      }}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {conversations.length > 0 && (
                  <div className="flex items-center gap-1.5 pl-5">
                    <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-black border border-orange-500/30">
                      {conversations.length}
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-400">
                      {conversations.length > 1
                        ? 'discussions enregistrées'
                        : 'discussion enregistrée'}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleStartNewConversation}
                className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nouvelle discussion</span>
              </button>

              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Rechercher une discussion..."
                  className="w-full bg-[#282a2f] border border-zinc-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-400 outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                {filteredConversations.length === 0 ? (
                  <div className="text-center text-zinc-500 text-xs py-8">
                    Aucune discussion trouvée
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const isActive = conv.id === currentConversationId;
                    const isPinned = Boolean(conv.isPinned);
                    const isMenuOpen = openConvMenuId === conv.id;

                    return (
                      <div
                        key={conv.id}
                        onClick={() => handleLoadConversation(conv)}
                        className={`relative p-2.5 rounded-xl border transition-all cursor-pointer group flex items-center justify-between gap-2 ${
                          isMenuOpen ? 'z-30' : 'z-10'
                        } ${
                          isActive
                            ? 'bg-orange-500/15 border-orange-500/50 text-white shadow-sm'
                            : isPinned
                            ? 'bg-amber-500/10 border-amber-500/35 text-zinc-100 hover:bg-amber-500/15'
                            : 'bg-[#26282d] border-zinc-800 text-zinc-300 hover:bg-[#2c2f35] hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {isPinned ? (
                            <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0 -rotate-45" />
                          ) : (
                            <MessageSquare
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isActive ? 'text-orange-400' : 'text-zinc-400'
                              }`}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate">{conv.title}</div>
                            {conv.filesCount > 0 && (
                              <div className="text-[10px] text-orange-400/90 flex items-center gap-1 mt-0.5">
                                <FolderOpen className="w-2.5 h-2.5" />
                                <span>
                                  {conv.filesCount} fichier{conv.filesCount > 1 ? 's' : ''} lié
                                  {conv.filesCount > 1 ? 's' : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div
                          className="relative shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenConvMenuId(isMenuOpen ? null : conv.id);
                            }}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                              isMenuOpen
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-700/70'
                            }`}
                            title="Options de la discussion"
                          >
                            <Menu className="w-3.5 h-3.5" />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-[#181a20] border border-zinc-700 rounded-xl shadow-2xl py-1.5 z-50 animate-fadeIn">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenConvMenuId(null);
                                  handleTogglePinConversation(conv);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-amber-500/15 hover:text-amber-300 transition-colors cursor-pointer text-left"
                              >
                                <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>{isPinned ? 'Désépingler' : 'Épingler en haut'}</span>
                              </button>
                              <div className="my-1 border-t border-zinc-800/80" />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenConvMenuId(null);
                                  handleDeleteConversation(conv.id);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 transition-colors cursor-pointer text-left"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Supprimer</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* 3. ZONE CENTRALE : ACCUEIL OU FIL DE DISCUSSION                     */}
        {/* =================================================================== */}
        <div
          ref={messagesScrollRef}
          onScroll={handleMessagesScroll}
          className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-5 flex flex-col select-text"
        >
          {messages.length === 0 && !isGenerating ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center max-h-full my-auto pb-8 px-3">
              {/* Logo ADN officiel lumineux */}
              <div className="mb-3.5 relative group">
                <DnaLogo
                  className="w-12 h-12 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.35)] transition-transform duration-300 group-hover:scale-105"
                  glow={false}
                />
              </div>

              {/* Badge Assistant Delmas (sans aucun nom de modèle visible) */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-3 rounded-full bg-zinc-800/85 border border-zinc-700/60 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-semibold text-zinc-300 tracking-wide">
                  Assistant Delmas
                </span>
              </div>

              {/* Titre principal écrit en direct (calme et sans pression) */}
              <h2 className="text-lg sm:text-2xl font-extrabold text-white mb-2.5 tracking-tight leading-snug max-w-md px-2 min-h-[2rem]">
                {displayedWelcomeTitle || welcomeCopy.title}
                {isTypingWelcome && (
                  <span className="inline-block w-[2px] h-[1.05em] bg-orange-400 animate-pulse ml-0.5 align-middle" />
                )}
              </h2>

              {/* Sous-titre discret */}
              <p className="text-xs sm:text-sm font-medium text-white/80 max-w-xs sm:max-w-sm leading-relaxed px-2 text-center">
                {welcomeCopy.subtitle}
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="w-full shrink-0">
                {msg.sender === 'user' ? (
                  <div className="flex flex-col items-end w-full gap-1.5">
                    {/* Fichiers / Images joints au message utilisateur */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-1.5 max-w-[88%]">
                        {msg.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-800/90 border border-zinc-700 text-xs text-zinc-200"
                          >
                            {att.previewDataUrl ||
                            (att.fileType === 'image' && att.url) ? (
                              <img
                                src={att.previewDataUrl || att.url}
                                alt={att.fileName}
                                className="w-6 h-6 rounded object-cover border border-zinc-600"
                              />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            )}
                            <span className="truncate max-w-[160px] font-semibold text-[11px]">
                              {att.fileName}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 max-w-[86%] group">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          setCopiedMsgId(msg.id);
                          setTimeout(() => setCopiedMsgId(null), 2000);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 cursor-pointer shrink-0"
                        title="Copier mon message"
                      >
                        {copiedMsgId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <div className="bg-[#2a2b2f] text-zinc-100 px-4 py-2.5 rounded-[22px] rounded-tr-[4px] text-sm break-words shadow-sm">
                        <MathText text={msg.content} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col w-full text-zinc-100">
                    <div className="mb-1.5 flex items-center gap-2">
                      <DnaLogo
                        className={`w-5 h-5 drop-shadow-[0_0_2px_rgba(0,0,0,1)] text-orange-500 ${
                          msg.isStreaming ? 'animate-spin' : ''
                        }`}
                        glow={true}
                      />
                      <span className="text-xs font-bold text-orange-400 tracking-wide uppercase">
                        Assistant Delmas
                      </span>
                    </div>

                    {/* Badges de confirmation des actions appliquées en direct sur le tableau */}
                    {msg.appliedSummaries && msg.appliedSummaries.length > 0 && (
                      <div className="mb-2.5 flex flex-col gap-1">
                        {msg.appliedSummaries.map((sum, idx) => (
                          <div
                            key={`${msg.id}-act-${idx}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-bold w-fit"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{sum}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div
                      className={`text-sm sm:text-[15px] leading-relaxed font-normal pl-1 break-words ${
                        msg.isError ? 'text-amber-300' : 'text-zinc-100'
                      }`}
                    >
                      <MathText text={msg.content} />
                      {msg.isStreaming && (
                        <span
                          className="inline-block w-[2px] h-[1.05em] bg-orange-400 animate-pulse ml-0.5 align-middle rounded-full"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    {!msg.isStreaming && (
                      <div className="flex items-center gap-1.5 mt-2 pl-1 text-zinc-400">
                        <button
                          type="button"
                          onClick={() =>
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === msg.id
                                  ? { ...m, reaction: m.reaction === 'like' ? null : 'like' }
                                  : m
                              )
                            )
                          }
                          className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                            msg.reaction === 'like'
                              ? 'text-emerald-400 bg-emerald-500/20'
                              : 'hover:text-white hover:bg-zinc-800'
                          }`}
                          title="Utile"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === msg.id
                                  ? {
                                      ...m,
                                      reaction: m.reaction === 'dislike' ? null : 'dislike',
                                    }
                                  : m
                              )
                            )
                          }
                          className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                            msg.reaction === 'dislike'
                              ? 'text-rose-400 bg-rose-500/20'
                              : 'hover:text-white hover:bg-zinc-800'
                          }`}
                          title="À améliorer"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                            setCopiedMsgId(msg.id);
                            setTimeout(() => setCopiedMsgId(null), 2000);
                          }}
                          className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer hover:text-white flex items-center gap-1"
                          title="Copier la réponse"
                        >
                          {copiedMsgId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-[10px] font-bold text-emerald-400">
                                Copié
                              </span>
                            </>
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {isThinking && (
            <div className="flex items-center gap-2.5 bg-[#26282d] px-3.5 py-2.5 rounded-2xl w-fit max-w-[90%] shadow-md animate-fadeIn">
              <DnaLogo
                className="w-5 h-5 animate-spin shrink-0 text-orange-500"
                glow={true}
              />
              <span className="text-xs sm:text-[13px] font-medium text-zinc-200 animate-pulse">
                {thinkingLabel}
              </span>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* 4. ZONE BASSE : CHAMP DE SAISIE + BOUTON + D'IMPORTATION FICHIERS   */}
        {/* =================================================================== */}
        <div className="px-2.5 sm:px-5 pt-1.5 pb-4 sm:pb-6 shrink-0 relative z-30">
          <div className="relative mx-1 sm:mx-2 rounded-2xl sm:rounded-3xl p-[1.5px] overflow-hidden bg-zinc-700/60 shadow-lg group max-w-full">
            {/* Liseré fin arc-en-ciel rotatif à 360° */}
            <div
              className="absolute -inset-[250%] pointer-events-none"
              style={{
                background:
                  'conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 160deg, #ff3b30 200deg, #ff9500 230deg, #ffcc00 260deg, #34c759 290deg, #00c7be 315deg, #007aff 335deg, #af52de 355deg, transparent 360deg)',
                animation: 'rainbowBorderSpin 5s linear infinite',
              }}
            />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex flex-col gap-2 bg-[#282a2f] rounded-[20px] sm:rounded-[22.5px] p-2.5 sm:p-3.5 transition-all w-full h-full max-w-full box-border"
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onPaste={handlePasteInTextarea}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={welcomeCopy.placeholder}
                rows={2}
                className="w-full bg-transparent text-white placeholder-zinc-400 text-xs sm:text-sm outline-none resize-none overflow-y-auto select-text"
              />

              <div className="flex items-center justify-between pt-0.5 gap-2">
                {/* Gauche : Bouton + d'importation de fichiers/images + Pastilles des fichiers sélectionnés */}
                <div className="flex items-center gap-1.5 overflow-x-auto flex-1 custom-scrollbar pb-0.5">
                  {/* Bouton + pour importer images, photos de notes, Excel, PDF, Word, Audio */}
                  <button
                    type="button"
                    disabled={isImportingFiles}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600/80 text-orange-400 hover:text-orange-300 transition-all cursor-pointer active:scale-95 shrink-0"
                    title="Importer une image ou un fichier (Photo de liste/notes, Excel, PDF, Word, Audio...)"
                  >
                    {isImportingFiles ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                    ) : (
                      <Plus className="w-4 h-4 stroke-[2.6]" />
                    )}
                  </button>

                  {pendingAttachments.length === 0 ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 rounded-lg text-zinc-400 hover:text-zinc-200 text-[10px] sm:text-[11px] font-medium shrink-0 select-none cursor-pointer transition"
                      title="Cliquer pour importer un fichier ou une image"
                    >
                      <FileText className="w-3 h-3 text-zinc-500 shrink-0" />
                      <span>
                        {isImportingFiles
                          ? 'Lecture du fichier...'
                          : 'Aucun fichier sélectionné'}
                      </span>
                    </div>
                  ) : (
                    pendingAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/15 border border-blue-500/40 text-blue-200 text-[10.5px] font-bold shrink-0 max-w-[180px]"
                      >
                        {att.previewDataUrl ? (
                          <img
                            src={att.previewDataUrl}
                            alt={att.fileName}
                            className="w-4 h-4 rounded object-cover shrink-0"
                          />
                        ) : att.fileType === 'image' ? (
                          <ImageIcon className="w-3 h-3 text-blue-400 shrink-0" />
                        ) : (
                          <FileText className="w-3 h-3 text-blue-400 shrink-0" />
                        )}
                        <span className="truncate">{att.fileName}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingAttachments((prev) =>
                              prev.filter((p) => p.id !== att.id)
                            )
                          }
                          className="p-0.5 rounded-full hover:bg-blue-500/30 text-blue-300 hover:text-white cursor-pointer shrink-0"
                          title="Retirer de l'envoi"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Droite : Bouton Envoyer ou Arrêter */}
                <div className="flex items-center gap-1.5 shrink-0 self-end">
                  {isGenerating ? (
                    <button
                      type="button"
                      onClick={handleStopGeneration}
                      className="px-3 py-1.5 font-bold rounded-full flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs shrink-0"
                      title="Arrêter la réponse en cours"
                    >
                      <Square className="w-3 h-3 fill-current text-rose-400" />
                      <span>Arrêter</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={
                        (!inputValue.trim() && pendingAttachments.length === 0) ||
                        isImportingFiles
                      }
                      className="p-2.5 font-bold rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer disabled:cursor-not-allowed shrink-0 bg-[#70a5ff] hover:bg-blue-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-slate-950"
                      title="Envoyer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
};
