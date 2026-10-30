import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Download,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Edit2,
  Check,
  X,
  Palette,
  Crosshair,
  Layers,
  Sparkles,
  ChevronDown,
  LayoutGrid,
  FileImage,
  HelpCircle,
  Loader2
} from 'lucide-react';
import { exportSvgToPdf } from '../../utils/exportStudyPdf';
import { MathText } from '../MathText';
import { safeJsonParse } from '../../services/api';

export interface ConceptCard {
  id: string;
  parentId: string | null;
  level: 0 | 1 | 2;
  pillTitle: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pillWidth: number;
  color: string;
  shadowColor?: string;
  collapsed?: boolean;
}

export interface ConceptMapDataset {
  id: string;
  name: string;
  badge: string;
  rootTitle: string;
  rootColor: string;
  cards: ConceptCard[];
}

// 1. DATASET UNIVERSEL PAR DÉFAUT (Structure 3 Piliers Neutre et Adaptative)
const DATASET_DEFAULT_3COL: ConceptMapDataset = {
  id: 'modele-3col',
  name: 'Modèle 3 Piliers (Conceptuel)',
  badge: 'Universel',
  rootTitle: 'CARTE CONCEPTUELLE',
  rootColor: '#F59E0B',
  cards: [
    // --- COLONNE 1 : NOTIONS & FONDEMENTS (Cyan) ---
    {
      id: 'col-notions',
      parentId: 'root',
      level: 1,
      pillTitle: 'NOTIONS & PRINCIPES',
      description:
        'Définitions indispensables, principes fondamentaux et postulats de base nécessaires à la compréhension.',
      x: 320,
      y: 225,
      width: 270,
      height: 155,
      pillWidth: 195,
      color: '#06B6D4',
      shadowColor: '#22D3EE'
    },
    {
      id: 'sub-definitions',
      parentId: 'col-notions',
      level: 2,
      pillTitle: 'DÉFINITIONS CLÉS',
      description:
        'Terminologie précise, concepts majeurs et théorèmes directeurs du chapitre.',
      x: 180,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 160,
      color: '#06B6D4',
      shadowColor: '#22D3EE'
    },
    {
      id: 'sub-formules',
      parentId: 'col-notions',
      level: 2,
      pillTitle: 'FORMULES & LOIS',
      description:
        'Relations mathématiques, lois physiques ou règles directrices à retenir.',
      x: 460,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 180,
      color: '#06B6D4',
      shadowColor: '#22D3EE'
    },

    // --- COLONNE 2 : MÉTHODOLOGIE & APPLICATION (Vert Émeraude) ---
    {
      id: 'col-methodes',
      parentId: 'root',
      level: 1,
      pillTitle: 'MÉTHODES & PROTOCOLES',
      description:
        'Démarche méthodique de résolution, étapes de calcul et modélisation des problèmes.',
      x: 760,
      y: 225,
      width: 270,
      height: 155,
      pillWidth: 205,
      color: '#10B981',
      shadowColor: '#34D399'
    },
    {
      id: 'sub-demarche',
      parentId: 'col-methodes',
      level: 2,
      pillTitle: 'ÉTAPES DE RÉSOLUTION',
      description:
        'Procédure systématique pas à pas pour identifier les variables et appliquer la bonne démarche.',
      x: 620,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 175,
      color: '#10B981',
      shadowColor: '#34D399'
    },
    {
      id: 'sub-exemples',
      parentId: 'col-methodes',
      level: 2,
      pillTitle: 'CAS PRATIQUES & TYPES',
      description:
        'Exercices représentatifs, illustrations concrètes et applications sur le terrain.',
      x: 900,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 180,
      color: '#10B981',
      shadowColor: '#34D399'
    },

    // --- COLONNE 3 : SYNTHÈSE & VIGILANCE (Rose / Magenta) ---
    {
      id: 'col-synthese',
      parentId: 'root',
      level: 1,
      pillTitle: 'SYNTHÈSE & VIGILANCE',
      description:
        'Bilan des acquis, conditions de validité des hypothèses et pièges fréquents à contourner.',
      x: 1200,
      y: 225,
      width: 270,
      height: 155,
      pillWidth: 200,
      color: '#EC4899',
      shadowColor: '#F472B6'
    },
    {
      id: 'sub-pieges',
      parentId: 'col-synthese',
      level: 2,
      pillTitle: 'PIÈGES À ÉVITER',
      description:
        'Confusions courantes, approximations erronées et erreurs types d’examen.',
      x: 1060,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 160,
      color: '#EC4899',
      shadowColor: '#F472B6'
    },
    {
      id: 'sub-bilan',
      parentId: 'col-synthese',
      level: 2,
      pillTitle: 'RÉSUMÉ RETENU',
      description:
        'Synthèse rapide des points clés à maîtriser le jour de l’évaluation.',
      x: 1340,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 160,
      color: '#EC4899',
      shadowColor: '#F472B6'
    }
  ]
};

const ALL_DATASETS: ConceptMapDataset[] = [
  DATASET_DEFAULT_3COL
];

const PRESET_PALETTES = [
  { name: 'Pop Pastel (Image)', col1: '#06B6D4', col2: '#10B981', col3: '#EC4899' },
  { name: 'Médical Pro', col1: '#0284C7', col2: '#0D9488', col3: '#7C3AED' },
  { name: 'Sunset Vif', col1: '#3B82F6', col2: '#F59E0B', col3: '#EF4444' }
];

function cleanConceptText(text: any): string {
  if (!text) return '';
  if (typeof text !== 'string') return String(text);
  let cleaned = text.trim();
  // Si le texte ressemble à un bloc JSON brut ou du code technique
  if (cleaned.startsWith('{') || cleaned.startsWith('[') || cleaned.includes('"noeud_central"') || cleaned.includes('"connecteurs"') || cleaned.includes('":')) {
    return '';
  }
  // Si le texte est un préambule de chat conversationnel
  if (/^voici\s+(?:votre\s+)?(?:carte|synthèse|schéma)/i.test(cleaned)) {
    return '';
  }
  return cleaned.replace(/^[\s*#\-–—]+/, '').replace(/[*_#`]/g, '').trim();
}

/**
 * Calcule dynamiquement la hauteur nécessaire pour une carte conceptuelle
 * en tenant compte fidèlement des textes explicatifs, puces et formules KaTeX
 * (fractions superposées, symboles mathématiques volumineux, etc.) sans coupure.
 */
export function computeConceptCardHeight(
  desc: string,
  colWidth: number,
  isHeader: boolean = false
): number {
  const text = (desc || '').trim();
  if (!text) return isHeader ? 90 : 130;

  const totalFracMatches = text.match(/\\+(?:d?frac)/g) || [];
  const totalFracCount = totalFracMatches.length;
  const nestedFracMatches = text.match(/\\+(?:d?frac)\s*\{[^{}]*\\+(?:d?frac)/g) || [];
  const nestedFracCount = nestedFracMatches.length;
  const sqrtMatches = text.match(/\\+sqrt/g) || [];
  const sqrtCount = sqrtMatches.length;
  const bigMathMatches = text.match(/\\+(?:sum|int|prod|oint|bigcap|bigcup|matrix|pmatrix|bmatrix|cases)/g) || [];
  const bigMathCount = bigMathMatches.length;
  const bulletCount = (text.match(/•/g) || []).length;

  const cleanChars = text
    .replace(/\\+[a-zA-Z]+/g, ' ')
    .replace(/[\{\}\$\_^]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const explicitLines = text.split(/\r?\n|\\{2,}(?![a-zA-Z])|\n/).length;
  const innerWidth = colWidth - 32;
  const charsPerLine = Math.max(20, Math.floor(innerWidth / 7.2));
  const estimatedWrappedLines = Math.ceil(cleanChars.length / charsPerLine);
  const lineCount = Math.max(explicitLines, estimatedWrappedLines);

  const baseTextH = lineCount * 22;
  const extraNestedH = nestedFracCount * 48;
  const simpleFracCount = Math.max(0, totalFracCount - nestedFracCount * 2);
  const extraSimpleFracH = simpleFracCount * 22;
  const extraSqrtH = sqrtCount * 28;
  const extraBigMathH = bigMathCount * 32;
  const extraBulletsH = bulletCount * 8;

  // Dégagement du badge supérieur (pill) et des marges intérieures
  const clearance = isHeader ? 46 : 68;
  const minH = isHeader ? 90 : 130;

  let calculatedH = baseTextH + extraNestedH + extraSimpleFracH + extraSqrtH + extraBigMathH + extraBulletsH + clearance;

  if (!isHeader) {
    if (nestedFracCount >= 2) {
      calculatedH = Math.max(calculatedH, 230);
    } else if (nestedFracCount >= 1) {
      calculatedH = Math.max(calculatedH, 165);
    } else if (totalFracCount >= 1 || sqrtCount >= 1) {
      calculatedH = Math.max(calculatedH, 145);
    }
  }

  return Math.max(minH, Math.round(calculatedH));
}

function buildConceptMapDataset(data: any, fallbackTitle?: string): ConceptMapDataset | null {
  if (!data) return null;
  let raw = data;
  if (typeof raw === 'string') {
    const parsed = safeJsonParse(raw);
    if (parsed) raw = parsed;
  }
  let actualData = (raw && typeof raw === 'object') ? (raw.creation_data || raw.content || raw.mind_map || raw.mindmap || raw.mindMap || raw) : raw;
  if (typeof actualData === 'string') {
    const parsed = safeJsonParse(actualData);
    if (parsed) actualData = parsed.creation_data || parsed.content || parsed;
  }
  if (!actualData || typeof actualData !== 'object') return null;

  // Si on a déjà un dataset direct avec des cartes toutes prêtes
  if (actualData.cards && Array.isArray(actualData.cards) && actualData.cards.length > 0) {
    const validCards = actualData.cards.filter((c: any) => c && c.pillTitle && !c.pillTitle.startsWith('{'));
    if (validCards.length > 0) {
      return {
        id: 'ai-dataset',
        name: actualData.name || actualData.title || fallbackTitle || 'Carte Conceptuelle',
        badge: 'Généré par IA',
        rootTitle: (actualData.root_title || actualData.rootTitle || actualData.title || fallbackTitle || 'CARTE CONCEPTUELLE').toUpperCase(),
        rootColor: actualData.rootColor || '#F59E0B',
        cards: validCards.map((c: any) => {
          const autoH = computeConceptCardHeight(c.description, c.width || 240, c.level === 1);
          return {
            ...c,
            height: Math.max(c.height || 0, autoH)
          };
        })
      };
    }
  }

  // Support direct du schéma avec noeud_central + noeuds / connecteurs
  if (actualData.noeud_central || Array.isArray(actualData.noeuds)) {
    const ncTitle = cleanConceptText(actualData.noeud_central?.nom || actualData.noeud_central?.label || actualData.noeud_central?.title || actualData.titre || fallbackTitle || 'CARTE CONCEPTUELLE');
    const nodes = Array.isArray(actualData.noeuds) ? actualData.noeuds : [];
    const topLevelNodes = nodes.filter((n: any) => {
      const p = n.parent || n.parentId;
      return !p || p === 'NC' || p === 'root' || p === 'noeud_central' || n.type === 'catégorie' || n.type === 'pilier' || n.type === 'branche';
    });
    const subNodes = nodes.filter((n: any) => !topLevelNodes.includes(n));

    if (topLevelNodes.length > 0) {
      actualData = {
        root_title: ncTitle || 'CARTE CONCEPTUELLE',
        columns: topLevelNodes.map((tl: any) => {
          const childrenOfTl = subNodes.filter((sn: any) => (sn.parent || sn.parentId) === tl.id);
          return {
            title: cleanConceptText(tl.nom || tl.label || tl.title || tl.id),
            description: cleanConceptText(tl.description || tl.role || tl.desc || 'Pilier conceptuel'),
            children: childrenOfTl.map((c: any) => ({
              title: cleanConceptText(c.nom || c.label || c.title || c.id),
              description: cleanConceptText(c.description || c.desc || c.formule || c.details || ''),
              formula: c.formula || c.formule || ''
            }))
          };
        })
      };
    }
  }

  let cols: any[] = Array.isArray(actualData.columns)
    ? actualData.columns
    : Array.isArray(actualData.piliers)
    ? actualData.piliers
    : Array.isArray(actualData.branches)
    ? actualData.branches
    : Array.isArray(actualData.root?.children)
    ? actualData.root.children
    : Array.isArray(actualData.children)
    ? actualData.children
    : Array.isArray(actualData.categories)
    ? actualData.categories
    : [];

  // Filtrer les colonnes qui contiendraient du texte JSON ou des intros parasites
  cols = cols.filter((col: any) => {
    if (!col) return false;
    if (typeof col === 'string') {
      return !col.startsWith('{') && !col.includes('":') && !/^voici\s+(?:votre\s+)?carte/i.test(col);
    }
    const t = col.branch_title || col.title || col.name || col.label || '';
    if (typeof t === 'string' && (t.startsWith('{') || t.includes('":') || /^voici\s+(?:votre\s+)?carte/i.test(t))) {
      return false;
    }
    return true;
  });

  if (cols.length === 0) return null;

  let rawRoot = actualData.root_title || actualData.rootTitle || actualData.title || actualData.root?.label || actualData.root?.title || actualData.label || actualData.name || fallbackTitle || 'CARTE CONCEPTUELLE';
  if (typeof rawRoot === 'string' && (rawRoot.startsWith('{') || rawRoot.includes('":') || /^voici/i.test(rawRoot))) {
    rawRoot = fallbackTitle || 'CARTE CONCEPTUELLE';
  }
  const rootTitle = String(rawRoot).toUpperCase();
  const palette = ['#06B6D4', '#10B981', '#EC4899', '#3B82F6', '#F59E0B', '#8B5CF6'];
  const generatedCards: ConceptCard[] = [];

  // 1. Pré-calcul de chaque colonne pour que la largeur et la hauteur s'adaptent TOUJOURS au contenu
  interface PreparedCol {
    colId: string;
    colColor: string;
    colTitle: string;
    colDesc: string;
    colWidth: number;
    colHeight: number;
    colPillW: number;
    childCards: Array<{
      id: string;
      title: string;
      desc: string;
      cardH: number;
      pillW: number;
    }>;
  }

  const preparedCols: PreparedCol[] = cols.slice(0, 6).map((col: any, cIdx: number) => {
    const colId = `col_${cIdx + 1}`;
    const colColor = palette[cIdx % palette.length];
    const rawTitle = col.branch_title || col.title || col.name || col.label || `Pilier ${cIdx + 1}`;
    const colTitle = (cleanConceptText(rawTitle) || `PILIER ${cIdx + 1}`).toUpperCase();

    const items = Array.isArray(col.nodes)
      ? col.nodes
      : Array.isArray(col.cards)
      ? col.cards
      : Array.isArray(col.items)
      ? col.items
      : Array.isArray(col.children)
      ? col.children
      : Array.isArray(col.subBranches)
      ? col.subBranches
      : Array.isArray(col.sub_branches)
      ? col.sub_branches
      : Array.isArray(col.subConcepts)
      ? col.subConcepts
      : [];

    // Description du pilier : si l'IA ne fournit pas de description, synthèse intelligente des notions abordées
    let colDesc = cleanConceptText(col.description || col.subtitle || col.summary || '');
    if (!colDesc && items.length > 0) {
      const subLabels = items
        .map((it: any) => cleanConceptText(typeof it === 'string' ? it : (it.label || it.title || it.name || '')))
        .filter(Boolean);
      if (subLabels.length > 0) {
        colDesc = subLabels.slice(0, 3).join(' • ');
      }
    }
    if (!colDesc) {
      colDesc = 'Axe thématique fondamental';
    }

    // Calcul de la largeur nécessaire pour le titre du pilier
    const neededColPillW = Math.max(160, Math.ceil(colTitle.length * 9.8 + 44));
    let maxW = Math.max(280, neededColPillW + 28);

    // Préparation des cartes enfants (Niveau 2 et Niveau 3)
    const childCards = items.map((item: any, iIdx: number) => {
      const rawItemTitle = typeof item === 'string' ? `Point ${iIdx + 1}` : (item.title || item.pillTitle || item.pillText || item.label || item.concept || item.name || `Point ${iIdx + 1}`);
      const cardTitle = (cleanConceptText(rawItemTitle) || `Point ${iIdx + 1}`).toUpperCase();
      let rawItemDesc = typeof item === 'string' ? item : (item.description || item.desc || item.body || item.details || item.content || item.title || item.label || '');
      let cardDesc = cleanConceptText(rawItemDesc);
      const itemFormula = typeof item === 'object' ? (item.formula || item.formule || item.math || item.equation || '') : '';
      if (itemFormula) {
        const cleanFormula = itemFormula.startsWith('$') ? itemFormula : `$${itemFormula}$`;
        cardDesc = cardDesc ? `${cardDesc} : ${cleanFormula}` : cleanFormula;
      }

      // Extraction des sous-détails (Niveau 3 de l'arborescence : formules, définitions, propriétés)
      if (typeof item === 'object' && Array.isArray(item.children) && item.children.length > 0) {
        const subDetails = item.children.map((c: any) => {
          if (typeof c === 'string') return cleanConceptText(c);
          const cLabel = cleanConceptText(c.label || c.title || c.name || c.description || '');
          const cFormula = c.formula || c.formule || '';
          if (cFormula) {
            const f = cFormula.startsWith('$') ? cFormula : `$${cFormula}$`;
            return cLabel ? `${cLabel} (${f})` : f;
          }
          return cLabel;
        }).filter(Boolean);

        if (subDetails.length > 0) {
          const formattedSub = subDetails.map((s: string) => `• ${s}`).join('\n');
          cardDesc = cardDesc ? `${cardDesc}\n\n${formattedSub}` : formattedSub;
        }
      }

      const neededCardPillW = Math.max(140, Math.ceil(cardTitle.length * 9.6 + 40));
      maxW = Math.max(maxW, neededCardPillW + 26);
      if (cardDesc.includes('\\frac') || cardDesc.includes('\\sqrt') || cardDesc.length > 120) {
        maxW = Math.max(maxW, Math.min(460, Math.max(340, Math.round(cardDesc.length * 1.4 + 180))));
      } else if (cardDesc.length > 70 || cardDesc.includes('$')) {
        maxW = Math.max(maxW, 310);
      }
      if (cardTitle.length > 22) {
        maxW = Math.max(maxW, Math.min(420, cardTitle.length * 9.8 + 48));
      }

      const cardH = computeConceptCardHeight(cardDesc, maxW, false);

      return {
        id: `${colId}_c_${iIdx + 1}`,
        title: cardTitle,
        desc: cardDesc,
        cardH,
        pillW: neededCardPillW
      };
    });

    const colWidth = maxW;
    const colPillW = Math.max(150, Math.min(colWidth - 20, neededColPillW));
    const colHeight = computeConceptCardHeight(colDesc, colWidth, true);

    return {
      colId,
      colColor,
      colTitle,
      colDesc,
      colWidth,
      colHeight,
      colPillW,
      childCards
    };
  });

  // Centrage dynamique : calculer la largeur totale réelle de toutes les colonnes
  const colCount = preparedCols.length;
  const colGap = 55;
  const totalGridWidth = preparedCols.reduce((sum, col) => sum + col.colWidth, 0) + (colCount - 1) * colGap;
  let currentX = Math.max(80, (1500 - totalGridWidth) / 2);

  preparedCols.forEach((col) => {
    // Positionnement aéré du Pilier Niveau 1 (espace généreux sous la boîte racine et la ligne bus)
    const lvl1Y = 250;

    generatedCards.push({
      id: col.colId,
      parentId: 'root',
      level: 1,
      pillTitle: col.colTitle,
      description: col.colDesc,
      x: currentX + col.colWidth / 2,
      y: lvl1Y,
      width: col.colWidth,
      height: col.colHeight,
      pillWidth: col.colPillW,
      color: col.colColor,
      shadowColor: col.colColor
    });

    let curY = lvl1Y + col.colHeight / 2 + 55;
    col.childCards.forEach((child) => {
      const cardPillW = Math.max(130, Math.min(col.colWidth - 18, child.pillW));

      generatedCards.push({
        id: child.id,
        parentId: col.colId,
        level: 2,
        pillTitle: child.title,
        description: child.desc,
        x: currentX + col.colWidth / 2,
        y: curY + child.cardH / 2,
        width: col.colWidth,
        height: child.cardH,
        pillWidth: cardPillW,
        color: col.colColor,
        shadowColor: col.colColor
      });
      curY += child.cardH + 35;
    });

    currentX += col.colWidth + colGap;
  });

  return {
    id: 'ai-dataset',
    name: rootTitle,
    badge: 'Généré par IA',
    rootTitle,
    rootColor: '#F59E0B',
    cards: generatedCards
  };
}

export default function CarteMentaleConceptuelle({ data, title }: { data?: any; title?: string }) {
  const dynamicDataset = useMemo(() => buildConceptMapDataset(data, title), [data, title]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(dynamicDataset ? 'ai-dataset' : 'modele-3col');
  const [datasetsState, setDatasetsState] = useState<Record<string, ConceptMapDataset>>(() => {
    const base: Record<string, ConceptMapDataset> = {
      'modele-3col': JSON.parse(JSON.stringify(DATASET_DEFAULT_3COL))
    };
    if (dynamicDataset) {
      base['ai-dataset'] = dynamicDataset;
    }
    return base;
  });

  useEffect(() => {
    if (dynamicDataset) {
      setDatasetsState((prev) => ({
        ...prev,
        'ai-dataset': dynamicDataset
      }));
      setSelectedDatasetId('ai-dataset');
    }
  }, [dynamicDataset]);

  const activeDataset = datasetsState[selectedDatasetId] || (dynamicDataset || DATASET_DEFAULT_3COL);
  const cards = activeDataset.cards;

  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 40, y: 30 });
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editPill, setEditPill] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDatasetMenu, setShowDatasetMenu] = useState(false);
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const hasUserInteractedRef = useRef(false);
  const isDraggingCanvasRef = useRef(false);
  const isDraggingCardRef = useRef(false);
  const draggedCardIdRef = useRef<string | null>(null);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const initialPanRef = useRef({ x: 0, y: 0 });
  const initialCardsStateRef = useRef<ConceptCard[]>([]);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1);

  // Group cards by parent
  const childrenMap = useMemo(() => {
    const map = new Map<string, ConceptCard[]>();
    cards.forEach((c) => {
      const arr = map.get(c.parentId || 'root') || [];
      arr.push(c);
      map.set(c.parentId || 'root', arr);
    });
    return map;
  }, [cards]);

  const cardMap = useMemo(() => {
    const map = new Map<string, ConceptCard>();
    cards.forEach((c) => map.set(c.id, c));
    return map;
  }, [cards]);

  // Root box definition - S'adapte TOUJOURS dynamiquement au thème et au titre
  const rootBox = useMemo(() => {
    const level1Cards = childrenMap.get('root') || [];
    const minX = level1Cards.length > 0 ? Math.min(...level1Cards.map((c) => c.x)) : 400;
    const maxX = level1Cards.length > 0 ? Math.max(...level1Cards.map((c) => c.x)) : 1000;
    const centerX = (minX + maxX) / 2;

    const titleText = (activeDataset.rootTitle || '').trim();
    const titleLen = titleText.length;

    let rootW: number;
    let rootH: number;

    if (titleLen <= 22) {
      rootW = Math.max(320, Math.round(titleLen * 14 + 64));
      rootH = 68;
    } else if (titleLen <= 42) {
      rootW = Math.max(400, Math.min(700, Math.round(titleLen * 13.5 + 76)));
      rootH = 74;
    } else {
      // Pour les très longs titres : adaptation multi-lignes spacieuse
      rootW = Math.max(480, Math.min(780, Math.round(Math.ceil(titleLen / 2) * 14.5 + 84)));
      rootH = 92;
    }

    return {
      x: centerX,
      y: 65,
      width: rootW,
      height: rootH
    };
  }, [childrenMap, activeDataset.rootTitle]);

  // Check if card is visible
  const isCardVisible = useCallback(
    (card: ConceptCard): boolean => {
      if (card.level === 1) return true;
      if (card.parentId && collapsedParents[card.parentId]) {
        return false;
      }
      return true;
    },
    [collapsedParents]
  );

  // Calculate bounding box for auto-fit
  const calculateBounds = useCallback(() => {
    const visibleCards = cards.filter(isCardVisible);
    if (visibleCards.length === 0) {
      return { minX: 0, maxX: 1200, minY: 0, maxY: 700, width: 1200, height: 700 };
    }
    let minX = rootBox.x - rootBox.width / 2;
    let maxX = rootBox.x + rootBox.width / 2;
    let minY = rootBox.y - rootBox.height / 2;
    let maxY = rootBox.y + rootBox.height / 2;

    visibleCards.forEach((c) => {
      minX = Math.min(minX, c.x - c.width / 2 - 20);
      maxX = Math.max(maxX, c.x + c.width / 2 + 25);
      minY = Math.min(minY, c.y - c.height / 2 - 30);
      maxY = Math.max(maxY, c.y + c.height / 2 + 30);
    });

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(maxX - minX, 600),
      height: Math.max(maxY - minY, 500)
    };
  }, [cards, rootBox, isCardVisible]);

  // Fit to screen - only fits when forced or before user interaction
  const fitToScreen = useCallback((force = false) => {
    if (!containerRef.current) return;
    if (!force && hasUserInteractedRef.current) return;
    if (force) {
      hasUserInteractedRef.current = false;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const containerW = rect.width || window.innerWidth;
    const containerH = rect.height || (window.innerHeight - 64);
    if (containerW <= 10 || containerH <= 10) return;

    const bounds = calculateBounds();
    const padX = containerW < 640 ? 20 : 50;
    const padY = containerW < 640 ? 30 : 60;

    const scaleX = (containerW - padX * 2) / bounds.width;
    const scaleY = (containerH - padY * 2) / bounds.height;
    const idealZoom = Math.min(scaleX, scaleY);
    const newZoom = Math.min(Math.max(idealZoom, 0.2), 1.25);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const newPanX = containerW / 2 - centerX * newZoom;
    const newPanY = containerH / 2 - centerY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [calculateBounds]);

  // Initial fit without resetting zoom on selection
  useEffect(() => {
    fitToScreen(true);
    const t = setTimeout(() => fitToScreen(true), 120);
    return () => clearTimeout(t);
  }, [dynamicDataset]);

  // Zoom handlers with expanded max zoom to 3.5 (350%)
  const handleZoom = (delta: number) => {
    hasUserInteractedRef.current = true;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const nextZoom = Math.min(Math.max(zoom + delta, 0.10), 3.5);
    const newPanX = centerX - (centerX - pan.x) * (nextZoom / zoom);
    const newPanY = centerY - (centerY - pan.y) * (nextZoom / zoom);

    setZoom(nextZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleReset = () => {
    hasUserInteractedRef.current = false;
    const original = DATASET_DEFAULT_3COL;

    setDatasetsState((prev) => ({
      ...prev,
      [selectedDatasetId]: JSON.parse(JSON.stringify(original))
    }));
    setCollapsedParents({});
    setTimeout(() => fitToScreen(true), 40);
  };

  // Mouse wheel zoom with preservation
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    hasUserInteractedRef.current = true;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
    const nextZoom = Math.min(Math.max(zoom * zoomFactor, 0.10), 3.5);

    const newPanX = mouseX - (mouseX - pan.x) * (nextZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (nextZoom / zoom);

    setZoom(nextZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Dragging Canvas
  const handlePointerDown = (e: React.PointerEvent) => {
    if (editingCardId) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Multi-touch pinch zoom
    if (activePointersRef.current.size === 2) {
      isDraggingCanvasRef.current = false;
      isDraggingCardRef.current = false;
      const pts = Array.from(activePointersRef.current.values()) as { x: number; y: number }[];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialPinchDistRef.current = dist;
      initialPinchZoomRef.current = zoom;
      return;
    }

    if (!isDraggingCardRef.current) {
      isDraggingCanvasRef.current = true;
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      initialPanRef.current = { ...pan };
    }
  };

  const handleCardPointerDown = (cardId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 1) {
      isDraggingCardRef.current = true;
      isDraggingCanvasRef.current = false;
      draggedCardIdRef.current = cardId;
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      initialCardsStateRef.current = [...cards];
      setSelectedCardId(cardId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Pinch-to-zoom
    if (activePointersRef.current.size === 2 && initialPinchDistRef.current) {
      const pts = Array.from(activePointersRef.current.values()) as { x: number; y: number }[];
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = currentDist / initialPinchDistRef.current;
      const nextZoom = Math.min(Math.max(initialPinchZoomRef.current * ratio, 0.18), 2.2);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
        const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
        const newPanX = midX - (midX - pan.x) * (nextZoom / zoom);
        const newPanY = midY - (midY - pan.y) * (nextZoom / zoom);
        setZoom(nextZoom);
        setPan({ x: newPanX, y: newPanY });
      }
      return;
    }

    // Panning canvas
    if (isDraggingCanvasRef.current) {
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      setPan({
        x: initialPanRef.current.x + dx,
        y: initialPanRef.current.y + dy
      });
      return;
    }

    // Dragging single card
    if (isDraggingCardRef.current && draggedCardIdRef.current) {
      const dx = (e.clientX - dragStartPosRef.current.x) / zoom;
      const dy = (e.clientY - dragStartPosRef.current.y) / zoom;

      const targetId = draggedCardIdRef.current;
      const initialMap = new Map<string, ConceptCard>();
      initialCardsStateRef.current.forEach((c) => initialMap.set(c.id, c));
      const initial = initialMap.get(targetId);
      if (!initial) return;

      setDatasetsState((prev) => {
        const currDataset = prev[selectedDatasetId];
        return {
          ...prev,
          [selectedDatasetId]: {
            ...currDataset,
            cards: currDataset.cards.map((c) => {
              if (c.id === targetId) {
                return {
                  ...c,
                  x: Math.round(initial.x + dx),
                  y: Math.round(initial.y + dy)
                };
              }
              return c;
            })
          }
        };
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      initialPinchDistRef.current = null;
    }
    if (activePointersRef.current.size === 0) {
      isDraggingCanvasRef.current = false;
      isDraggingCardRef.current = false;
      draggedCardIdRef.current = null;
    }
  };

  // Editing card
  const startEditingCard = (card: ConceptCard) => {
    setEditingCardId(card.id);
    setEditPill(card.pillTitle);
    setEditDesc(card.description);
  };

  const saveEditingCard = () => {
    if (editingCardId && editPill.trim()) {
      setDatasetsState((prev) => {
        const curr = prev[selectedDatasetId];
        return {
          ...prev,
          [selectedDatasetId]: {
            ...curr,
            cards: curr.cards.map((c) => {
              if (c.id === editingCardId) {
                const newDesc = editDesc.trim();
                const newHeight = computeConceptCardHeight(newDesc, c.width, c.level === 1);
                return {
                  ...c,
                  pillTitle: editPill.trim().toUpperCase(),
                  description: newDesc,
                  height: Math.max(c.height, newHeight),
                  pillWidth: Math.max(editPill.trim().length * 10 + 40, 140)
                };
              }
              return c;
            })
          }
        };
      });
    }
    setEditingCardId(null);
  };

  const handleAddCard = (parentCard: ConceptCard) => {
    const newId = `card-custom-${Date.now()}`;
    const siblings = cards.filter((c) => c.parentId === parentCard.id);
    const offsetX = (siblings.length + 1) * 30 - 30;

    const newCard: ConceptCard = {
      id: newId,
      parentId: parentCard.id,
      level: 2,
      pillTitle: 'NOUVEAU BLOC',
      description: 'Cliquez sur Modifier pour personnaliser le texte de ce bloc.',
      x: parentCard.x + offsetX,
      y: parentCard.y + 240,
      width: 240,
      height: 150,
      pillWidth: 150,
      color: parentCard.color,
      shadowColor: parentCard.shadowColor || parentCard.color
    };

    setDatasetsState((prev) => {
      const curr = prev[selectedDatasetId];
      return {
        ...prev,
        [selectedDatasetId]: {
          ...curr,
          cards: [...curr.cards, newCard]
        }
      };
    });

    setCollapsedParents((prev) => ({ ...prev, [parentCard.id]: false }));
    setSelectedCardId(newId);
    startEditingCard(newCard);
  };

  const handleDeleteCard = (cardId: string) => {
    setDatasetsState((prev) => {
      const curr = prev[selectedDatasetId];
      const toDelete = new Set<string>([cardId]);
      curr.cards.forEach((c) => {
        if (c.parentId === cardId) toDelete.add(c.id);
      });
      return {
        ...prev,
        [selectedDatasetId]: {
          ...curr,
          cards: curr.cards.filter((c) => !toDelete.has(c.id))
        }
      };
    });
    setSelectedCardId(null);
  };

  // Toggle card children collapse
  const toggleCollapse = (cardId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedParents((prev) => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  // Download PDF
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportPDF = async () => {
    if (isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      const rootText = activeDataset.rootTitle || title || 'Carte_Conceptuelle';
      await exportSvgToPdf('concept-map-svg-stage', rootText);
    } catch (err) {
      console.error('Erreur export PDF carte conceptuelle:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Apply a palette to the 3 main columns
  const applyPalette = (palette: { col1: string; col2: string; col3: string }) => {
    setDatasetsState((prev) => {
      const curr = prev[selectedDatasetId];
      const level1Cards = curr.cards.filter((c) => c.level === 1);
      const colorMapping: Record<string, string> = {};

      if (level1Cards[0]) colorMapping[level1Cards[0].id] = palette.col1;
      if (level1Cards[1]) colorMapping[level1Cards[1].id] = palette.col2;
      if (level1Cards[2]) colorMapping[level1Cards[2].id] = palette.col3;

      return {
        ...prev,
        [selectedDatasetId]: {
          ...curr,
          cards: curr.cards.map((c) => {
            if (c.level === 1 && colorMapping[c.id]) {
              return { ...c, color: colorMapping[c.id], shadowColor: colorMapping[c.id] };
            }
            if (c.level === 2 && c.parentId && colorMapping[c.parentId]) {
              return { ...c, color: colorMapping[c.parentId], shadowColor: colorMapping[c.parentId] };
            }
            return c;
          })
        }
      };
    });
  };

  const selectedCard = selectedCardId ? cardMap.get(selectedCardId) : null;

  return (
    <div
      id="module-carte-mentale-conceptuelle"
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none bg-[#F4F6F8] font-sans ${
        isFullscreen ? 'h-screen' : 'h-[calc(100vh-64px)] min-h-[560px]'
      }`}
      style={{ touchAction: 'none' }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 
        FIXED TOP CONTROLS: Elevated, stationary, never moves during panning/zooming.
        Row 1: Main toolbar (zoom, fit, reset, export, fullscreen).
        Row 2: Selected card action bar directly below it, on the same line, disappearing when nothing is selected.
      */}
      <div
        id="concept-map-top-controls-wrapper"
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 pointer-events-auto"
      >
        {/* Row 1: Main Toolbar */}
        <div
          id="concept-map-toolbar-actions"
          className="flex items-center gap-1 bg-white/95 backdrop-blur-md px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl border-2 border-slate-800 shadow-md"
        >
          {/* Zoom Out */}
          <button
            id="btn-cm-zoom-out"
            onClick={() => handleZoom(-0.2)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors active:scale-95"
            title="Zoom arrière"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Zoom Percentage */}
          <span className="text-xs font-mono font-bold px-1 text-slate-800 min-w-[42px] text-center">
            {Math.round(zoom * 100)}%
          </span>

          {/* Zoom In */}
          <button
            id="btn-cm-zoom-in"
            onClick={() => handleZoom(0.2)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors active:scale-95"
            title="Zoom avant"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-300 mx-0.5" />

          {/* Fit Screen ("Ajuster") */}
          <button
            id="btn-cm-fit"
            onClick={() => fitToScreen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold transition-colors active:scale-95"
            title="Recentrer et adapter la carte"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ajuster</span>
          </button>

          {/* Reset Position */}
          <button
            id="btn-cm-reset"
            onClick={handleReset}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors active:scale-95"
            title="Disposition d'origine"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-300 mx-0.5" />

          {/* Export PDF */}
          <button
            id="btn-cm-export"
            onClick={handleExportPDF}
            disabled={isExportingPdf}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-800 disabled:opacity-50 transition-colors active:scale-95 cursor-pointer"
            title="Télécharger la carte conceptuelle en PDF"
          >
            {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <Download className="w-4 h-4" />}
          </button>

          {/* Fullscreen */}
          <button
            id="btn-cm-fullscreen"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors active:scale-95"
            title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Delete selected card - positioned at the end of top bar as requested */}
          {selectedCard && (
            <>
              <div className="h-4 w-px bg-slate-300 mx-0.5" />
              <button
                id="btn-card-delete"
                onClick={() => handleDeleteCard(selectedCard.id)}
                className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors active:scale-95 animate-in fade-in zoom-in-95 duration-150"
                title="Supprimer ce bloc"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Row 2: Selected Card Action Bar - Appears on the same line just under the toolbar block, disappears when nothing is selected */}
        {selectedCard && (
          <div
            id="concept-map-selected-card-bar"
            className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border-2 border-slate-800 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150 max-w-[95vw] overflow-x-auto"
          >
            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200 shrink-0">
              <span
                className="w-3.5 h-3.5 rounded-full border border-slate-900 shrink-0"
                style={{ backgroundColor: selectedCard.color }}
              />
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 max-w-[130px] sm:max-w-[200px] truncate">
                {selectedCard.pillTitle}
              </span>
            </div>

            <button
              id="btn-card-edit"
              onClick={() => startEditingCard(selectedCard)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 transition-colors shrink-0 active:scale-95"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Modifier</span>
            </button>

            <button
              id="btn-card-add"
              onClick={() => handleAddCard(selectedCard)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shrink-0 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>

            <button
              id="btn-card-close"
              onClick={() => setSelectedCardId(null)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Inline Modal Editor */}
      {editingCardId && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-2 border-slate-900 p-5 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                Modifier la carte conceptuelle
              </h4>
              <button
                onClick={() => setEditingCardId(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Titre du badge (Pilule)
              </label>
              <input
                type="text"
                value={editPill}
                onChange={(e) => setEditPill(e.target.value)}
                className="w-full p-2.5 rounded-xl border-2 border-slate-300 text-slate-900 text-sm font-bold uppercase tracking-wider focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Description / Texte de la carte
              </label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={4}
                className="w-full p-2.5 rounded-xl border-2 border-slate-300 text-slate-900 text-sm font-medium focus:outline-none focus:border-slate-900 resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingCardId(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={saveEditingCard}
                className="inline-flex items-center gap-1 px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Enregistrer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 
        ═══════════════════════════════════════════════════════════════
        MAIN SVG STAGE RENDERING:
        Matching the uploaded image "concept-map-free-google-docs-template-t.webp"
        ═══════════════════════════════════════════════════════════════
      */}
      <svg
        id="concept-map-svg-stage"
        className="w-full h-full block cursor-grab active:cursor-grabbing select-none"
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* 
            1. ORTHOGONAL CONNECTING LINES (Branching Tree)
            Matching the crisp right-angle geometric lines of the reference image
          */}
          <g id="concept-map-connector-lines" stroke="#334155" strokeWidth={2} fill="none">
            {/* 1.1 Branch from Root down to Level 1 Cards */}
            {(() => {
              const level1 = cards.filter((c) => c.level === 1);
              if (level1.length === 0) return null;

              const rootBottomY = rootBox.y + rootBox.height / 2;
              const minPillTopY = Math.min(...level1.map((c) => c.y - c.height / 2 - 16));
              const busY = Math.round((rootBottomY + minPillTopY) / 2);
              const minX = Math.min(...level1.map((c) => c.x));
              const maxX = Math.max(...level1.map((c) => c.x));

              return (
                <g key="root-to-level1">
                  {/* Vertical drop from Root center */}
                  <line x1={rootBox.x} y1={rootBottomY} x2={rootBox.x} y2={busY} />
                  {/* Horizontal distribution bar */}
                  <line x1={minX} y1={busY} x2={maxX} y2={busY} />
                  {/* Vertical drops into each Level 1 card */}
                  {level1.map((card) => {
                    const pillTopY = card.y - card.height / 2 - 16;
                    return (
                      <line
                        key={`drop-lvl1-${card.id}`}
                        x1={card.x}
                        y1={busY}
                        x2={card.x}
                        y2={pillTopY}
                      />
                    );
                  })}
                </g>
              );
            })()}

            {/* 1.2 Branches from Level 1 Cards down to Level 2 Child Cards */}
            {cards
              .filter((c) => c.level === 1 && !collapsedParents[c.id])
              .map((parent) => {
                const children = (childrenMap.get(parent.id) || []).filter(isCardVisible);
                if (children.length === 0) return null;

                const parentBottomY = parent.y + parent.height / 2;
                const minChildPillTopY = Math.min(...children.map((c) => c.y - c.height / 2 - 16));
                const busY = Math.round((parentBottomY + minChildPillTopY) / 2);
                const minChildX = Math.min(...children.map((c) => c.x));
                const maxChildX = Math.max(...children.map((c) => c.x));

                return (
                  <g key={`branch-parent-${parent.id}`}>
                    {/* Vertical drop from parent card bottom */}
                    <line x1={parent.x} y1={parentBottomY} x2={parent.x} y2={busY} />
                    {/* Horizontal distribution line across children */}
                    <line x1={minChildX} y1={busY} x2={maxChildX} y2={busY} />
                    {/* Vertical drops to each child card top pill */}
                    {children.map((child) => {
                      const childPillTopY = child.y - child.height / 2 - 16;
                      return (
                        <line
                          key={`drop-lvl2-${child.id}`}
                          x1={child.x}
                          y1={busY}
                          x2={child.x}
                          y2={childPillTopY}
                        />
                      );
                    })}
                  </g>
                );
              })}
          </g>

          {/* 
            2. ROOT NODE (CARTE CONCEPTUELLE)
            - Rounded pill/box with dark 2px outline
            - Offset golden/amber solid 3D shadow (shifted +6, +6)
          */}
          <g
            id="concept-map-root-box"
            transform={`translate(${rootBox.x}, ${rootBox.y})`}
            className="cursor-pointer"
          >
            {/* Bottom-right offset solid shadow */}
            <rect
              x={-rootBox.width / 2 + 6}
              y={-rootBox.height / 2 + 6}
              width={rootBox.width}
              height={rootBox.height}
              rx={Math.min(24, Math.round(rootBox.height / 2))}
              fill={activeDataset.rootColor}
              stroke="#1E293B"
              strokeWidth={2}
            />
            {/* Main white body */}
            <rect
              x={-rootBox.width / 2}
              y={-rootBox.height / 2}
              width={rootBox.width}
              height={rootBox.height}
              rx={Math.min(24, Math.round(rootBox.height / 2))}
              fill="#FFFFFF"
              stroke="#1E293B"
              strokeWidth={2}
            />
            {/* Title Text via foreignObject for 100% responsive, auto-wrapping, zero-overflow design */}
            <foreignObject
              x={-rootBox.width / 2 + 16}
              y={-rootBox.height / 2}
              width={rootBox.width - 32}
              height={rootBox.height}
              className="pointer-events-none select-none"
            >
              <div className="w-full h-full flex items-center justify-center text-center px-2">
                <span className="font-extrabold text-[16px] sm:text-[18px] md:text-[20px] tracking-wide text-slate-800 leading-snug select-none">
                  {activeDataset.rootTitle}
                </span>
              </div>
            </foreignObject>
          </g>

          {/* 
            3. CONCEPT CARDS (Level 1 and Level 2)
            - Offset colored solid 3D shadow (+6px, +6px) with 2px dark border
            - White body with 2px dark border & rounded corners (rx=18)
            - Pill header sitting across top edge with 2px dark border
            - Bold uppercase text inside pill
            - Clean centered description text
          */}
          <g id="concept-map-cards-group">
            {cards.map((card) => {
              if (!isCardVisible(card)) return null;

              const isSelected = selectedCardId === card.id;
              const hasChildren = (childrenMap.get(card.id) || []).length > 0;
              const isCollapsed = collapsedParents[card.id];
              const halfW = card.width / 2;
              const halfH = card.height / 2;
              const pillHalfW = card.pillWidth / 2;

              return (
                <g
                  key={card.id}
                  id={`card-node-${card.id}`}
                  transform={`translate(${card.x}, ${card.y})`}
                  onPointerDown={(e) => handleCardPointerDown(card.id, e)}
                  onDoubleClick={() => startEditingCard(card)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCardId(card.id);
                  }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  {/* Selection Glow Indicator */}
                  {isSelected && (
                    <rect
                      x={-halfW - 6}
                      y={-halfH - 22}
                      width={card.width + 12}
                      height={card.height + 36}
                      rx={24}
                      fill="none"
                      stroke="#0F172A"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                    />
                  )}

                  {/* 3D Offset Colored Shadow (Shifted +6px, +6px) */}
                  <rect
                    x={-halfW + 6}
                    y={-halfH + 6}
                    width={card.width}
                    height={card.height}
                    rx={18}
                    fill={card.color}
                    stroke="#1E293B"
                    strokeWidth={2}
                  />

                  {/* Main White Card Body */}
                  <rect
                    x={-halfW}
                    y={-halfH}
                    width={card.width}
                    height={card.height}
                    rx={18}
                    fill="#FFFFFF"
                    stroke="#1E293B"
                    strokeWidth={2}
                  />

                  {/* Top Pill Header (Overlapping top edge) */}
                  <rect
                    x={-pillHalfW}
                    y={-halfH - 16}
                    width={card.pillWidth}
                    height={34}
                    rx={17}
                    fill={card.color}
                    stroke="#1E293B"
                    strokeWidth={2}
                  />

                  {/* Pill Title Text via foreignObject */}
                  <foreignObject
                    x={-pillHalfW + 6}
                    y={-halfH - 16}
                    width={card.pillWidth - 12}
                    height={34}
                    className="pointer-events-none select-none"
                  >
                    <div className="w-full h-full flex items-center justify-center text-center px-1">
                      <span className="font-extrabold text-[11px] sm:text-[11.5px] uppercase tracking-wider text-slate-900 truncate leading-tight select-none">
                        {card.pillTitle}
                      </span>
                    </div>
                  </foreignObject>

                  {/* Body Text via foreignObject */}
                  <foreignObject
                    x={-halfW + 12}
                    y={-halfH + 26}
                    width={card.width - 24}
                    height={card.height - 32}
                    className="pointer-events-none select-none"
                    style={{ overflow: 'visible' }}
                  >
                    <div className={`w-full h-full flex ${card.height > 140 || card.description?.includes('•') || card.description?.includes('\n') ? 'items-start pt-2 justify-start text-left' : 'items-center justify-center text-center'} px-1`}>
                      <div className={`w-full text-[12px] leading-relaxed text-slate-700 font-normal select-none whitespace-pre-line ${card.height > 140 || card.description?.includes('•') || card.description?.includes('\n') ? 'text-left' : 'text-center'}`}>
                        <MathText text={card.description} />
                      </div>
                    </div>
                  </foreignObject>

                  {/* Collapse/Expand indicator for Level 1 cards with children */}
                  {hasChildren && card.level === 1 && (
                    <g
                      transform={`translate(0, ${halfH + 2})`}
                      onClick={(e) => toggleCollapse(card.id, e)}
                      className="cursor-pointer hover:scale-125 transition-transform"
                    >
                      <circle
                        r={8.5}
                        fill="#FFFFFF"
                        stroke="#1E293B"
                        strokeWidth={1.5}
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        y={-0.5}
                        className="text-[11px] font-extrabold fill-slate-800 select-none pointer-events-none"
                      >
                        {isCollapsed ? '+' : '−'}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}
