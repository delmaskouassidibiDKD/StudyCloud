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
  HelpCircle
} from 'lucide-react';
import { MathText } from '../MathText';

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

function buildConceptMapDataset(data: any, fallbackTitle?: string): ConceptMapDataset | null {
  if (!data) return null;
  const actualData = data.mind_map || data.mindmap || data.mindMap || data;

  if (actualData.cards && Array.isArray(actualData.cards) && actualData.cards.length > 0) {
    return {
      id: 'ai-dataset',
      name: actualData.name || actualData.title || fallbackTitle || 'Carte Conceptuelle',
      badge: 'Généré par IA',
      rootTitle: (actualData.root_title || actualData.rootTitle || actualData.title || fallbackTitle || 'CARTE CONCEPTUELLE').toUpperCase(),
      rootColor: actualData.rootColor || '#F59E0B',
      cards: actualData.cards
    };
  }

  const cols = Array.isArray(actualData.branches)
    ? actualData.branches
    : Array.isArray(actualData.root?.children)
    ? actualData.root.children
    : Array.isArray(actualData.columns)
    ? actualData.columns
    : Array.isArray(actualData.categories)
    ? actualData.categories
    : [];
  if (cols.length === 0) return null;

  const rootTitle = (actualData.root_title || actualData.rootTitle || actualData.title || fallbackTitle || 'CARTE CONCEPTUELLE').toUpperCase();
  const palette = ['#06B6D4', '#10B981', '#EC4899', '#3B82F6', '#F59E0B', '#8B5CF6'];
  const generatedCards: ConceptCard[] = [];

  let currentX = 220;

  cols.slice(0, 6).forEach((col: any, cIdx: number) => {
    const colId = `col_${cIdx + 1}`;
    const colColor = palette[cIdx % palette.length];
    const colTitle = (col.branch_title || col.title || col.name || col.label || `Axe ${cIdx + 1}`).toUpperCase();
    const colDesc = col.description || col.subtitle || col.summary || 'Axe fondamental';

    const items = Array.isArray(col.nodes)
      ? col.nodes
      : Array.isArray(col.cards)
      ? col.cards
      : Array.isArray(col.items)
      ? col.items
      : Array.isArray(col.children)
      ? col.children
      : [];

    let maxW = Math.max(260, Math.min(380, colTitle.length * 9 + 40));
    items.forEach((item: any) => {
      const itTitle = typeof item === 'string' ? '' : (item.title || item.pillTitle || item.name || '');
      const itDesc = typeof item === 'string' ? item : (item.description || item.desc || item.body || item.title || '');
      if (itDesc.length > 90 || itDesc.includes('$')) {
        maxW = Math.max(maxW, 300);
      }
      if (itTitle.length > 20) {
        maxW = Math.max(maxW, Math.min(360, itTitle.length * 8.5 + 40));
      }
    });

    const colWidth = maxW;
    const colHeight = Math.max(120, Math.min(220, 70 + Math.ceil(colDesc.length / 28) * 20));
    const colPillW = Math.max(140, Math.min(colWidth - 20, colTitle.length * 8.5 + 30));

    generatedCards.push({
      id: colId,
      parentId: 'root',
      level: 1,
      pillTitle: colTitle,
      description: colDesc,
      x: currentX + colWidth / 2,
      y: 225,
      width: colWidth,
      height: colHeight,
      pillWidth: colPillW,
      color: colColor,
      shadowColor: colColor
    });

    let curY = 225 + colHeight / 2 + 55;
    items.forEach((item: any, iIdx: number) => {
      const cardTitle = (typeof item === 'string' ? `Point ${iIdx + 1}` : (item.title || item.pillTitle || item.pillText || item.name || `Point ${iIdx + 1}`)).toUpperCase();
      const cardDesc = typeof item === 'string' ? item : (item.description || item.desc || item.body || item.title || '');
      
      const cardH = Math.max(120, Math.min(320, 75 + Math.ceil(cardDesc.length / 26) * 22));
      const cardPillW = Math.max(120, Math.min(colWidth - 20, cardTitle.length * 8.5 + 26));

      generatedCards.push({
        id: `${colId}_c_${iIdx + 1}`,
        parentId: colId,
        level: 2,
        pillTitle: cardTitle,
        description: cardDesc,
        x: currentX + colWidth / 2,
        y: curY + cardH / 2,
        width: colWidth,
        height: cardH,
        pillWidth: cardPillW,
        color: colColor,
        shadowColor: colColor
      });
      curY += cardH + 35;
    });

    currentX += colWidth + 50;
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

  // Root box definition
  const rootBox = useMemo(() => {
    const level1Cards = childrenMap.get('root') || [];
    if (level1Cards.length === 0) {
      return { x: 760, y: 65, width: 340, height: 70 };
    }
    const minX = Math.min(...level1Cards.map((c) => c.x));
    const maxX = Math.max(...level1Cards.map((c) => c.x));
    const centerX = (minX + maxX) / 2;
    return {
      x: centerX,
      y: 65,
      width: activeDataset.rootTitle.length > 20 ? 380 : 310,
      height: 72
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
                return {
                  ...c,
                  pillTitle: editPill.trim().toUpperCase(),
                  description: editDesc.trim(),
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

  // Download SVG
  const handleExportSVG = () => {
    const svgEl = document.getElementById('concept-map-svg-stage');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'carte-conceptuelle.svg';
    a.click();
    URL.revokeObjectURL(url);
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

          {/* Export SVG */}
          <button
            id="btn-cm-export"
            onClick={handleExportSVG}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors active:scale-95"
            title="Télécharger en format vectoriel SVG"
          >
            <Download className="w-4 h-4" />
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
              const busY = rootBottomY + 46;
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
                const busY = parentBottomY + 42;
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
              rx={22}
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
              rx={22}
              fill="#FFFFFF"
              stroke="#1E293B"
              strokeWidth={2}
            />
            {/* Title Text */}
            <text
              textAnchor="middle"
              y={7}
              className="font-extrabold text-[21px] sm:text-[22px] tracking-wide fill-slate-800 select-none pointer-events-none"
            >
              {activeDataset.rootTitle}
            </text>
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

                  {/* Pill Title Text */}
                  <text
                    x={0}
                    y={-halfH + 5}
                    textAnchor="middle"
                    className="font-extrabold text-[11.5px] uppercase tracking-wider fill-slate-900 select-none pointer-events-none"
                  >
                    {card.pillTitle}
                  </text>

                  {/* Body Text via foreignObject */}
                  <foreignObject
                    x={-halfW + 14}
                    y={-halfH + 26}
                    width={card.width - 28}
                    height={card.height - 34}
                    className="pointer-events-none select-none"
                  >
                    <div className="w-full h-full flex items-center justify-center text-center px-1">
                      <div className="text-[12px] leading-relaxed text-slate-700 font-normal select-none">
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
