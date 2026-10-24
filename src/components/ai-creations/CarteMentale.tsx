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
  Loader2
} from 'lucide-react';
import { exportSvgToPdf } from '../../utils/exportStudyPdf';
import { MathText } from '../MathText';
import { safeJsonParse } from '../../services/api';

export interface MindNode {
  id: string;
  parentId: string | null;
  text: string;
  x: number;
  y: number;
  color: string;
  side: 'left' | 'right' | 'center';
  isCentral?: boolean;
  width?: number;
  height?: number;
  level?: number;
  type?: string;
}

// Nodes with layout precisely matching Box / Card containers
const INITIAL_NODES: MindNode[] = [
  // Nœud central dynamique neutre
  {
    id: 'root',
    parentId: null,
    text: 'Sujet Principal',
    x: 1220,
    y: 640,
    color: '#334155',
    side: 'center',
    isCentral: true,
    width: 220,
    height: 68,
    level: 0
  },
  // Branche 1 (Haut gauche)
  {
    id: 'b_l_0',
    parentId: 'root',
    text: 'Axe 1 : Notions Fondamentales',
    x: 900,
    y: 460,
    color: '#0E5EBA',
    side: 'left',
    width: 230,
    height: 50,
    level: 1
  },
  {
    id: 'b_l_0_sub_0',
    parentId: 'b_l_0',
    text: 'Définitions et principes clés',
    x: 580,
    y: 425,
    color: '#0E5EBA',
    side: 'left',
    width: 210,
    height: 46,
    level: 2
  },
  {
    id: 'b_l_0_sub_1',
    parentId: 'b_l_0',
    text: 'Hypothèses d’application',
    x: 580,
    y: 495,
    color: '#0E5EBA',
    side: 'left',
    width: 200,
    height: 46,
    level: 2
  },
  // Branche 2 (Bas gauche)
  {
    id: 'b_l_1',
    parentId: 'root',
    text: 'Axe 2 : Méthodes & Formules',
    x: 900,
    y: 820,
    color: '#D11928',
    side: 'left',
    width: 230,
    height: 50,
    level: 1
  },
  {
    id: 'b_l_1_sub_0',
    parentId: 'b_l_1',
    text: 'Équations directrices',
    x: 580,
    y: 785,
    color: '#D11928',
    side: 'left',
    width: 190,
    height: 46,
    level: 2
  },
  {
    id: 'b_l_1_sub_1',
    parentId: 'b_l_1',
    text: 'Conditions de validité',
    x: 580,
    y: 855,
    color: '#D11928',
    side: 'left',
    width: 190,
    height: 46,
    level: 2
  },
  // Branche 3 (Haut droite)
  {
    id: 'b_r_0',
    parentId: 'root',
    text: 'Axe 3 : Applications Pratiques',
    x: 1540,
    y: 460,
    color: '#1E8238',
    side: 'right',
    width: 230,
    height: 50,
    level: 1
  },
  {
    id: 'b_r_0_sub_0',
    parentId: 'b_r_0',
    text: 'Cas d’étude concret',
    x: 1860,
    y: 425,
    color: '#1E8238',
    side: 'right',
    width: 190,
    height: 46,
    level: 2
  },
  {
    id: 'b_r_0_sub_1',
    parentId: 'b_r_0',
    text: 'Exemple d’application',
    x: 1860,
    y: 495,
    color: '#1E8238',
    side: 'right',
    width: 190,
    height: 46,
    level: 2
  },
  // Branche 4 (Bas droite)
  {
    id: 'b_r_1',
    parentId: 'root',
    text: 'Axe 4 : Limites & Synthèse',
    x: 1540,
    y: 820,
    color: '#7B1FA2',
    side: 'right',
    width: 230,
    height: 50,
    level: 1
  },
  {
    id: 'b_r_1_sub_0',
    parentId: 'b_r_1',
    text: 'Pièges fréquents à éviter',
    x: 1860,
    y: 785,
    color: '#7B1FA2',
    side: 'right',
    width: 210,
    height: 46,
    level: 2
  },
  {
    id: 'b_r_1_sub_1',
    parentId: 'b_r_1',
    text: 'Points à retenir pour examen',
    x: 1860,
    y: 855,
    color: '#7B1FA2',
    side: 'right',
    width: 220,
    height: 46,
    level: 2
  }
];

const PRESET_COLORS = [
  '#008EB0',
  '#0070DF',
  '#00AEC7',
  '#1E8238',
  '#1B6327',
  '#7B1FA2',
  '#F57C00',
  '#D11928',
  '#0E5EBA',
  '#334155'
];

function calculateMindMapBounds(nodeList: MindNode[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodeList.forEach((n) => {
    const halfW = (n.width || 160) / 2 + 35;
    const halfH = (n.height || 50) / 2 + 35;
    minX = Math.min(minX, n.x - halfW);
    maxX = Math.max(maxX, n.x + halfW);
    minY = Math.min(minY, n.y - halfH);
    maxY = Math.max(maxY, n.y + halfH);
  });

  return {
    minX: Number.isFinite(minX) ? minX : 300,
    maxX: Number.isFinite(maxX) ? maxX : 2140,
    minY: Number.isFinite(minY) ? minY : 150,
    maxY: Number.isFinite(maxY) ? maxY : 1130,
    width: Number.isFinite(maxX - minX) ? Math.max(maxX - minX, 800) : 1840,
    height: Number.isFinite(maxY - minY) ? Math.max(maxY - minY, 500) : 980
  };
}

function getInitialView() {
  const winW = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1000;
  const winH = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight - 64 : 700;

  const bounds = calculateMindMapBounds(INITIAL_NODES);
  const padX = winW < 640 ? 16 : 48;
  const padY = winW < 640 ? 24 : 48;

  const scaleX = (winW - padX * 2) / bounds.width;
  const scaleY = (winH - padY * 2) / bounds.height;
  const initialZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.12), 1.2);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    zoom: initialZoom,
    pan: {
      x: winW / 2 - centerX * initialZoom,
      y: winH / 2 - centerY * initialZoom
    }
  };
}

export function parseMermaidMindmap(code: string): any {
  if (!code || typeof code !== 'string') return null;
  const lines = code.split('\n');
  let rootTitle = 'Carte Mentale';
  const branches: Array<{ title: string; children: any[] }> = [];
  let currentBranch: { title: string; children: any[] } | null = null;
  let inMindmap = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;
    if (trimmed.startsWith('mindmap')) {
      inMindmap = true;
      continue;
    }
    if (!inMindmap) continue;

    const indentMatch = rawLine.match(/^(\s+)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    let text = trimmed
      .replace(/^root\s*/i, '')
      .replace(/^[\(\[\{]{1,2}/, '')
      .replace(/[\)\]\}]{1,2}$/, '')
      .replace(/^[-*]\s*/, '')
      .trim();

    if (!text) continue;

    if (indent <= 2 && branches.length === 0 && (!currentBranch || currentBranch.title !== text)) {
      rootTitle = text;
      continue;
    }

    if (indent <= 6) {
      currentBranch = { title: text, children: [] };
      branches.push(currentBranch);
    } else if (currentBranch) {
      currentBranch.children.push({ title: text });
    }
  }

  if (branches.length > 0) {
    return {
      root_title: rootTitle,
      branches
    };
  }
  return null;
}

export function extractSubNodeText(sub: any, sIdx: number): string {
  if (typeof sub === 'string') return sub.trim();
  if (typeof sub === 'number') return String(sub);
  if (!sub || typeof sub !== 'object') return `Sous-notion ${sIdx + 1}`;

  // 1. Libellé / Notion / Concept principal
  const main = (
    sub.title ||
    sub.label ||
    sub.text ||
    sub.concept ||
    sub.notion ||
    sub.name ||
    sub.keyword ||
    sub.content ||
    sub.description ||
    sub.value ||
    sub.definition ||
    ''
  ).trim();

  // 2. Formule mathématique ou scientifique
  const rawFormula = (
    sub.formula ||
    sub.formule ||
    sub.math ||
    sub.equation ||
    ''
  ).trim();

  let formattedFormula = '';
  if (rawFormula) {
    formattedFormula = rawFormula.startsWith('$') ? rawFormula : `$${rawFormula}$`;
  }

  // 3. Fusion notion + formule
  if (main && formattedFormula) {
    if (main.includes('$') || main.includes(rawFormula)) {
      return main;
    }
    return `${main} : ${formattedFormula}`;
  }

  if (formattedFormula) {
    return formattedFormula;
  }

  if (main) {
    return main;
  }

  // 4. Recherche de toute propriété textuelle signifiante (anti-placeholder "Sous-notion X")
  const anyStr = Object.entries(sub).find(
    ([k, v]) => typeof v === 'string' && (v as string).trim() && !k.toLowerCase().includes('id') && !k.toLowerCase().includes('color')
  )?.[1] as string;

  return anyStr ? anyStr.trim() : `Sous-notion ${sIdx + 1}`;
}

export function extractSubList(item: any): any[] {
  if (!item || typeof item !== 'object') return [];
  if (Array.isArray(item.nodes) && item.nodes.length > 0) return item.nodes;
  if (Array.isArray(item.children) && item.children.length > 0) return item.children;
  if (Array.isArray(item.subBranches) && item.subBranches.length > 0) return item.subBranches;
  if (Array.isArray(item.sub_branches) && item.sub_branches.length > 0) return item.sub_branches;
  if (Array.isArray(item.subbranches) && item.subbranches.length > 0) return item.subbranches;
  if (Array.isArray(item.subConcepts) && item.subConcepts.length > 0) return item.subConcepts;
  if (Array.isArray(item.sub_concepts) && item.sub_concepts.length > 0) return item.sub_concepts;
  if (Array.isArray(item.subconcepts) && item.subconcepts.length > 0) return item.subconcepts;
  if (Array.isArray(item.items) && item.items.length > 0) return item.items;
  if (Array.isArray(item.notions) && item.notions.length > 0) return item.notions;
  if (Array.isArray(item.points) && item.points.length > 0) return item.points;
  if (Array.isArray(item.elements) && item.elements.length > 0) return item.elements;
  if (Array.isArray(item.formulas) && item.formulas.length > 0) return item.formulas;
  if (Array.isArray(item.details) && item.details.length > 0) return item.details;
  return [];
}

export interface TreeItem {
  id: string;
  text: string;
  children: TreeItem[];
}

export function extractTreeItem(raw: any, defaultId: string): TreeItem {
  const text = extractSubNodeText(raw, 0);
  const subRaw = extractSubList(raw);
  const children = subRaw.map((s, idx) => extractTreeItem(s, `${defaultId}_${idx}`));
  return {
    id: raw?.id ? String(raw.id) : defaultId,
    text,
    children
  };
}

function measureSubtree(item: TreeItem): number {
  if (!item.children || item.children.length === 0) {
    return 64; // Hauteur minimale d'une boîte feuille avec marge verticale
  }
  let sumH = 0;
  for (const child of item.children) {
    sumH += measureSubtree(child);
  }
  return Math.max(sumH, 64);
}

function layoutChildren(
  parentX: number,
  parentY: number,
  parentW: number,
  parentH: number,
  parentId: string,
  children: TreeItem[],
  side: 'left' | 'right',
  level: number,
  branchColor: string,
  resultNodes: MindNode[]
) {
  if (!children || children.length === 0) return;

  const totalChildrenH = children.reduce((acc, c) => acc + measureSubtree(c), 0);
  let childCurrentY = parentY - totalChildrenH / 2;

  children.forEach((child, cIdx) => {
    const childH_span = measureSubtree(child);
    const childY = Math.round(childCurrentY + childH_span / 2);
    childCurrentY += childH_span;

    const cleanT = child.text.replace(/\\[a-zA-Z]+/g, 'X').replace(/[\{\}\$\_\^]/g, '');
    const childW = Math.min(340, Math.max(130, Math.round(cleanT.length * 7.5 + 32)));
    const childBoxH = (child.text.includes('\n') || child.text.includes('\\dfrac') || child.text.includes('\\frac')) ? 54 : 46;

    const gapX = 75;
    const childX = Math.round(side === 'right'
      ? parentX + parentW / 2 + gapX + childW / 2
      : parentX - parentW / 2 - gapX - childW / 2);

    const childId = child.id || `${parentId}_sub_${cIdx}`;
    resultNodes.push({
      id: childId,
      parentId,
      text: child.text,
      x: childX,
      y: childY,
      color: branchColor,
      side,
      width: childW,
      height: childBoxH,
      level
    });

    if (child.children && child.children.length > 0) {
      layoutChildren(
        childX,
        childY,
        childW,
        childBoxH,
        childId,
        child.children,
        side,
        level + 1,
        branchColor,
        resultNodes
      );
    }
  });
}

export function buildMindNodes(data: any, fallbackTitle?: string): MindNode[] {
  if (!data) return INITIAL_NODES;
  if (Array.isArray(data.nodes) && data.nodes.length > 0) return data.nodes;

  let actualData = data;
  if (typeof actualData === 'string') {
    const trimmed = actualData.trim();
    if (trimmed.startsWith('{') || trimmed.includes('```json') || (trimmed.includes('{') && trimmed.includes('}'))) {
      const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i) || trimmed.match(/(\{[\s\S]*\})/);
      const parsed = safeJsonParse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : trimmed);
      if (parsed) actualData = parsed;
    }
    if (typeof actualData === 'string' && trimmed.includes('mindmap')) {
      const parsedMermaid = parseMermaidMindmap(trimmed);
      if (parsedMermaid) actualData = parsedMermaid;
    }
  }

  if (actualData && typeof actualData === 'object') {
    const possibleMermaid = actualData.mermaid || actualData.mermaidCode || actualData.code;
    if (typeof possibleMermaid === 'string' && possibleMermaid.includes('mindmap')) {
      const parsed = parseMermaidMindmap(possibleMermaid);
      if (parsed) actualData = parsed;
    }
  }

  const unnested = actualData?.mind_map || actualData?.mindmap || actualData?.mindMap || actualData?.creation_data || actualData;
  if (!unnested) return INITIAL_NODES;

  let rootText = unnested.label || unnested.root_title || unnested.rootTitle || unnested.title || unnested.root?.text || unnested.root?.label || unnested.root?.title || fallbackTitle || 'Carte Mentale';
  let rawChildren: any[] = [];

  if (Array.isArray(unnested.children) && unnested.children.length > 0) {
    rawChildren = unnested.children;
  } else if (Array.isArray(unnested.branches) && unnested.branches.length > 0) {
    rawChildren = unnested.branches;
  } else if (Array.isArray(unnested.root?.children) && unnested.root.children.length > 0) {
    rawChildren = unnested.root.children;
  } else if (Array.isArray(unnested.concepts) && unnested.concepts.length > 0) {
    rawChildren = unnested.concepts;
  } else if (Array.isArray(unnested.themes) && unnested.themes.length > 0) {
    rawChildren = unnested.themes;
  } else if (Array.isArray(unnested.cards) && unnested.cards.length > 0) {
    rawChildren = unnested.cards;
  } else if (Array.isArray(unnested)) {
    rawChildren = unnested;
  }

  if (rawChildren.length === 0) {
    return INITIAL_NODES;
  }

  const treeBranches: TreeItem[] = rawChildren.map((item, idx) => extractTreeItem(item, `b_${idx}`));

  const result: MindNode[] = [];
  const rootId = unnested.id || 'root';
  const cleanRoot = rootText.replace(/\\[a-zA-Z]+/g, 'X').replace(/[\{\}\$\_\^]/g, '');
  const rootWidth = Math.min(380, Math.max(190, Math.round(cleanRoot.length * 9.5 + 36)));
  const rootHeight = 68;

  result.push({
    id: rootId,
    parentId: null,
    text: rootText,
    x: 1220,
    y: 640,
    color: '#334155',
    side: 'center',
    isCentral: true,
    width: rootWidth,
    height: rootHeight,
    level: 0
  });

  const branchColors = [
    '#0E5EBA', // Cobalt Blue
    '#D11928', // Crimson Red
    '#F57C00', // Amber
    '#1E8238', // Forest Green
    '#00AEC7', // Cyan
    '#7B1FA2', // Purple
    '#008EB0', // Teal
    '#C2185B'  // Magenta
  ];

  const leftBranches: { item: TreeItem; origIdx: number }[] = [];
  const rightBranches: { item: TreeItem; origIdx: number }[] = [];

  treeBranches.forEach((item, idx) => {
    if (treeBranches.length === 1) {
      rightBranches.push({ item, origIdx: idx });
    } else if (idx % 2 === 0) {
      leftBranches.push({ item, origIdx: idx });
    } else {
      rightBranches.push({ item, origIdx: idx });
    }
  });

  // Layout left branches & subtrees
  if (leftBranches.length > 0) {
    const totalLeftH = leftBranches.reduce((acc, b) => acc + measureSubtree(b.item), 0) + (leftBranches.length - 1) * 28;
    let currentLeftY = 640 - totalLeftH / 2;

    leftBranches.forEach(({ item, origIdx }) => {
      const bH_span = measureSubtree(item);
      const branchY = Math.round(currentLeftY + bH_span / 2);
      currentLeftY += bH_span + 28;

      const branchColor = branchColors[origIdx % branchColors.length];
      const cleanText = item.text.replace(/\\[a-zA-Z]+/g, 'X').replace(/[\{\}\$\_\^]/g, '');
      const branchWidth = Math.min(350, Math.max(140, Math.round(cleanText.length * 8 + 36)));
      const branchHeight = (item.text.includes('\n') || item.text.includes('\\dfrac') || item.text.includes('\\frac')) ? 56 : 48;
      const branchX = Math.round(1220 - rootWidth / 2 - 90 - branchWidth / 2);
      const branchId = item.id || `b_l_${origIdx}`;

      result.push({
        id: branchId,
        parentId: rootId,
        text: item.text,
        x: branchX,
        y: branchY,
        color: branchColor,
        side: 'left',
        width: branchWidth,
        height: branchHeight,
        level: 1
      });

      if (item.children && item.children.length > 0) {
        layoutChildren(
          branchX,
          branchY,
          branchWidth,
          branchHeight,
          branchId,
          item.children,
          'left',
          2,
          branchColor,
          result
        );
      }
    });
  }

  // Layout right branches & subtrees
  if (rightBranches.length > 0) {
    const totalRightH = rightBranches.reduce((acc, b) => acc + measureSubtree(b.item), 0) + (rightBranches.length - 1) * 28;
    let currentRightY = 640 - totalRightH / 2;

    rightBranches.forEach(({ item, origIdx }) => {
      const bH_span = measureSubtree(item);
      const branchY = Math.round(currentRightY + bH_span / 2);
      currentRightY += bH_span + 28;

      const branchColor = branchColors[origIdx % branchColors.length];
      const cleanText = item.text.replace(/\\[a-zA-Z]+/g, 'X').replace(/[\{\}\$\_\^]/g, '');
      const branchWidth = Math.min(350, Math.max(140, Math.round(cleanText.length * 8 + 36)));
      const branchHeight = (item.text.includes('\n') || item.text.includes('\\dfrac') || item.text.includes('\\frac')) ? 56 : 48;
      const branchX = Math.round(1220 + rootWidth / 2 + 90 + branchWidth / 2);
      const branchId = item.id || `b_r_${origIdx}`;

      result.push({
        id: branchId,
        parentId: rootId,
        text: item.text,
        x: branchX,
        y: branchY,
        color: branchColor,
        side: 'right',
        width: branchWidth,
        height: branchHeight,
        level: 1
      });

      if (item.children && item.children.length > 0) {
        layoutChildren(
          branchX,
          branchY,
          branchWidth,
          branchHeight,
          branchId,
          item.children,
          'right',
          2,
          branchColor,
          result
        );
      }
    });
  }

  return result;
}

export default function CarteMentale({ data, title }: { data?: any; title?: string }) {
  const dynamicNodes = useMemo(() => buildMindNodes(data, title), [data, title]);
  const initialView = useMemo(() => getInitialView(), []);
  const [nodes, setNodes] = useState<MindNode[]>(dynamicNodes);
  const [zoom, setZoom] = useState(initialView.zoom);
  const [pan, setPan] = useState(initialView.pan);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setNodes(dynamicNodes);
  }, [dynamicNodes]);

  const containerRef = useRef<HTMLDivElement>(null);
  const hasUserInteractedRef = useRef(false);
  const isDraggingCanvasRef = useRef(false);
  const isDraggingNodeRef = useRef(false);
  const draggedNodeIdRef = useRef<string | null>(null);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const initialPanRef = useRef({ x: 0, y: 0 });
  const initialNodesStateRef = useRef<MindNode[]>([]);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1);

  // Map of nodes
  const nodeMap = useMemo(() => {
    const map = new Map<string, MindNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Children mapping
  const childrenMap = useMemo(() => {
    const map = new Map<string, MindNode[]>();
    nodes.forEach((n) => {
      if (n.parentId) {
        const arr = map.get(n.parentId) || [];
        arr.push(n);
        map.set(n.parentId, arr);
      }
    });
    return map;
  }, [nodes]);

  // Visibility check
  const isNodeVisible = useCallback(
    (node: MindNode): boolean => {
      if (node.isCentral) return true;
      let curr = node;
      while (curr.parentId) {
        if (collapsedNodes[curr.parentId]) {
          return false;
        }
        const parent = nodeMap.get(curr.parentId);
        if (!parent) break;
        curr = parent;
      }
      return true;
    },
    [collapsedNodes, nodeMap]
  );

  // Descendants
  const getDescendantIds = useCallback(
    (nodeId: string): string[] => {
      const result: string[] = [];
      const queue = [nodeId];
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const children = childrenMap.get(currentId) || [];
        for (const child of children) {
          result.push(child.id);
          queue.push(child.id);
        }
      }
      return result;
    },
    [childrenMap]
  );

  // Fit to screen calculation - Only fits when forced or before user interaction
  const fitToScreen = useCallback((force = false, targetNodes: MindNode[] = nodes) => {
    if (!containerRef.current) return;
    if (!force && hasUserInteractedRef.current) return;
    if (force) {
      hasUserInteractedRef.current = false;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const containerW = rect.width || window.innerWidth;
    const containerH = rect.height || (window.innerHeight - 64);
    if (containerW <= 10 || containerH <= 10) return;

    const bounds = calculateMindMapBounds(targetNodes);
    const padX = containerW < 640 ? 16 : 48;
    const padY = containerW < 640 ? 24 : 48;

    const availableW = Math.max(containerW - padX * 2, 200);
    const availableH = Math.max(containerH - padY * 2, 200);

    const scaleX = availableW / bounds.width;
    const scaleY = availableH / bounds.height;
    const idealZoom = Math.min(scaleX, scaleY);
    const newZoom = Math.min(Math.max(idealZoom, 0.12), 1.3);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const newPanX = containerW / 2 - centerX * newZoom;
    const newPanY = containerH / 2 - centerY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [nodes]);

  // Initial fit without intrusive ResizeObserver that resets zoom on selection
  useEffect(() => {
    fitToScreen(true);

    const t1 = setTimeout(() => fitToScreen(true), 80);
    const t2 = setTimeout(() => fitToScreen(true), 280);

    const handleWindowResize = () => {
      if (!hasUserInteractedRef.current) {
        fitToScreen(true);
      }
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [dynamicNodes]);

  // Zoom buttons with expanded max zoom to 3.5 (350%)
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

  const handleResetPositions = () => {
    hasUserInteractedRef.current = false;
    setNodes(INITIAL_NODES);
    setCollapsedNodes({});
    setTimeout(() => fitToScreen(true, INITIAL_NODES), 20);
  };

  // Toggle collapse
  const handleToggleCollapse = (nodeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const handleCollapseAll = () => {
    const next: Record<string, boolean> = {};
    nodes.forEach((n) => {
      const hasChildren = (childrenMap.get(n.id) || []).length > 0;
      if (hasChildren && !n.isCentral) {
        next[n.id] = true;
      }
    });
    setCollapsedNodes(next);
  };

  const handleExpandAll = () => {
    setCollapsedNodes({});
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

  // Pointer dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    if (editingNodeId) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Multi-touch pinch-to-zoom init
    if (activePointersRef.current.size === 2) {
      hasUserInteractedRef.current = true;
      isDraggingCanvasRef.current = false;
      isDraggingNodeRef.current = false;
      const pts = Array.from(activePointersRef.current.values()) as { x: number; y: number }[];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialPinchDistRef.current = dist;
      initialPinchZoomRef.current = zoom;
      return;
    }

    if (!isDraggingNodeRef.current) {
      hasUserInteractedRef.current = true;
      isDraggingCanvasRef.current = true;
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      initialPanRef.current = { ...pan };
    }
  };

  const handleNodePointerDown = (nodeId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    isDraggingCanvasRef.current = false;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 1) {
      isDraggingNodeRef.current = true;
      isDraggingCanvasRef.current = false;
      draggedNodeIdRef.current = nodeId;
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      initialNodesStateRef.current = [...nodes];
      setSelectedNodeId(nodeId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Multi-touch pinch gesture
    if (activePointersRef.current.size === 2 && initialPinchDistRef.current) {
      const pts = Array.from(activePointersRef.current.values()) as { x: number; y: number }[];
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = currentDist / initialPinchDistRef.current;
      const nextZoom = Math.min(Math.max(initialPinchZoomRef.current * ratio, 0.12), 2.5);

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

    // Canvas panning
    if (isDraggingCanvasRef.current) {
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      setPan({
        x: initialPanRef.current.x + dx,
        y: initialPanRef.current.y + dy
      });
      return;
    }

    // Node dragging
    if (isDraggingNodeRef.current && draggedNodeIdRef.current) {
      const dx = (e.clientX - dragStartPosRef.current.x) / zoom;
      const dy = (e.clientY - dragStartPosRef.current.y) / zoom;

      const targetId = draggedNodeIdRef.current;
      const targetNode = nodeMap.get(targetId);
      if (!targetNode) return;

      const descendantIds = new Set(getDescendantIds(targetId));
      descendantIds.add(targetId);

      const initialMap = new Map<string, MindNode>();
      initialNodesStateRef.current.forEach((n) => initialMap.set(n.id, n));

      setNodes((prevNodes) =>
        prevNodes.map((n) => {
          if (descendantIds.has(n.id)) {
            const initial = initialMap.get(n.id);
            if (!initial) return n;
            return {
              ...n,
              x: Math.round(initial.x + dx),
              y: Math.round(initial.y + dy)
            };
          }
          return n;
        })
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      initialPinchDistRef.current = null;
    }
    if (activePointersRef.current.size === 0) {
      isDraggingCanvasRef.current = false;
      isDraggingNodeRef.current = false;
      draggedNodeIdRef.current = null;
    }
  };

  // Node editing
  const startEditing = (node: MindNode) => {
    setEditingNodeId(node.id);
    setEditText(node.text);
  };

  const saveEditing = () => {
    if (editingNodeId && editText.trim()) {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === editingNodeId) {
            const trimmed = editText.trim();
            const cleanText = trimmed.replace(/\\[a-zA-Z]+/g, 'X').replace(/[\{\}\$\_\^]/g, '');
            const width = Math.min(360, Math.max(130, Math.round(cleanText.length * 8 + 32)));
            const height = (trimmed.includes('\n') || trimmed.includes('\\dfrac') || trimmed.includes('\\frac')) ? 56 : 46;
            return {
              ...n,
              text: trimmed,
              width: n.isCentral ? Math.max(width, 190) : width,
              height: n.isCentral ? 68 : height
            };
          }
          return n;
        })
      );
    }
    setEditingNodeId(null);
  };

  const handleColorChange = (color: string) => {
    if (!selectedNodeId) return;
    const descendantIds = new Set(getDescendantIds(selectedNodeId));
    descendantIds.add(selectedNodeId);

    setNodes((prev) =>
      prev.map((n) => {
        if (descendantIds.has(n.id)) {
          return { ...n, color };
        }
        return n;
      })
    );
  };

  const handleAddChild = () => {
    if (!selectedNodeId) return;
    const parent = nodeMap.get(selectedNodeId);
    if (!parent) return;

    const newId = `custom-${Date.now()}`;
    const side = parent.side === 'center' ? 'right' : parent.side;
    const parentW = parent.width || 180;
    const newW = 140;
    const offsetX = side === 'left' ? -(parentW / 2 + 75 + newW / 2) : (parentW / 2 + 75 + newW / 2);
    const newChild: MindNode = {
      id: newId,
      parentId: parent.id,
      text: 'Nouvelle idée',
      x: parent.x + offsetX,
      y: parent.y + 40,
      color: parent.color,
      side,
      width: newW,
      height: 46,
      level: (parent.level || 0) + 1
    };

    setNodes((prev) => [...prev, newChild]);
    setCollapsedNodes((prev) => ({ ...prev, [parent.id]: false }));
    setSelectedNodeId(newId);
    startEditing(newChild);
  };

  const handleDeleteNode = () => {
    if (!selectedNodeId) return;
    if (selectedNodeId === 'root') return;

    const toDelete = new Set(getDescendantIds(selectedNodeId));
    toDelete.add(selectedNodeId);

    setNodes((prev) => prev.filter((n) => !toDelete.has(n.id)));
    setSelectedNodeId(null);
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportPDF = async () => {
    if (isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      const rootTitle = centralNode?.text || title || 'Carte_Mentale';
      await exportSvgToPdf('mindmap-svg-canvas', rootTitle);
    } catch (err) {
      console.error('Erreur export PDF carte mentale:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : null;

  return (
    <div
      id="module-carte-mentale-view"
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none bg-[#DFE7ED] ${
        isFullscreen ? 'h-screen' : 'h-[calc(100vh-64px)] min-h-[520px]'
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
        Row 1: Main toolbar.
        Row 2: Selected node action bar directly below it, on the same line, disappearing when nothing is selected.
      */}
      <div
        id="mindmap-top-controls-wrapper"
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 pointer-events-auto"
      >
        {/* Row 1: Main Toolbar */}
        <div
          id="mindmap-fixed-toolbar"
          className="flex items-center gap-1 bg-white/95 backdrop-blur-md px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-300/80 shadow-md"
        >
          {/* Zoom Out */}
          <button
            id="btn-mm-zoom-out"
            onClick={() => handleZoom(-0.15)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors active:scale-95"
            title="Zoom arrière"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Zoom Level Indicator */}
          <span className="text-xs font-mono font-semibold px-1 text-slate-700 min-w-[42px] text-center">
            {Math.round(zoom * 100)}%
          </span>

          {/* Zoom In */}
          <button
            id="btn-mm-zoom-in"
            onClick={() => handleZoom(0.15)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors active:scale-95"
            title="Zoom avant"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          {/* Fit to Screen ("Ajuster") */}
          <button
            id="btn-mm-fit"
            onClick={() => fitToScreen(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors active:scale-95"
            title="Recentrer et adapter la carte à l'écran"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ajuster</span>
          </button>

          {/* Reset Positions */}
          <button
            id="btn-mm-reset"
            onClick={handleResetPositions}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors active:scale-95"
            title="Remettre les positions d'origine"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          {/* Expand / Collapse All */}
          <button
            id="btn-mm-expand"
            onClick={handleExpandAll}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors hidden sm:flex active:scale-95"
            title="Tout déplier"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            id="btn-mm-collapse"
            onClick={handleCollapseAll}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors hidden sm:flex active:scale-95"
            title="Tout replier"
          >
            <EyeOff className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block" />

          {/* Download PDF */}
          <button
            id="btn-mm-export"
            onClick={handleExportPDF}
            disabled={isExportingPdf}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 disabled:opacity-50 transition-colors active:scale-95 cursor-pointer"
            title="Télécharger la carte mentale en PDF"
          >
            {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <Download className="w-4 h-4" />}
          </button>

          {/* Fullscreen */}
          <button
            id="btn-mm-fullscreen"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors active:scale-95"
            title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Delete selected branch - positioned at the end of top bar as requested */}
          {selectedNode && !selectedNode.isCentral && (
            <>
              <div className="h-4 w-px bg-slate-200 mx-0.5" />
              <button
                id="btn-node-delete"
                onClick={handleDeleteNode}
                className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors active:scale-95 animate-in fade-in zoom-in-95 duration-150"
                title="Supprimer cette branche"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Row 2: Selected Node Bar - Appears on the same line just under the toolbar block, disappears when nothing is selected */}
        {selectedNode && (
          <div
            id="mindmap-selected-node-bar"
            className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-300/90 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150 max-w-[95vw] overflow-x-auto"
          >
            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200 shrink-0">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: selectedNode.color }}
              />
              <span className="text-xs sm:text-sm font-bold text-slate-900 max-w-[130px] sm:max-w-[200px] truncate">
                {selectedNode.text.replace('\n', ' ')}
              </span>
            </div>

            <button
              id="btn-node-edit"
              onClick={() => startEditing(selectedNode)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors shrink-0 active:scale-95"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Modifier</span>
            </button>

            <button
              id="btn-node-add-child"
              onClick={handleAddChild}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shrink-0 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>

            <div className="hidden sm:flex items-center gap-1 pl-1 border-r border-slate-200 shrink-0 pr-1.5">
              <Palette className="w-3 h-3 text-slate-400 mr-0.5" />
              {PRESET_COLORS.slice(0, 4).map((c) => (
                <button
                  key={c}
                  onClick={() => handleColorChange(c)}
                  className="w-3.5 h-3.5 rounded-full border border-slate-300 hover:scale-125 transition-transform"
                  style={{ backgroundColor: c }}
                  title="Changer couleur"
                />
              ))}
            </div>

            <button
              id="btn-node-close"
              onClick={() => setSelectedNodeId(null)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Inline Text Editor Modal */}
      {editingNodeId && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xl max-w-sm w-full space-y-3">
            <h4 className="text-sm font-bold text-slate-900">Modifier le texte</h4>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none font-medium"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingNodeId(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium"
              >
                Annuler
              </button>
              <button
                onClick={saveEditing}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Enregistrer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 
        Main SVG Interactive Rendering Stage:
        Uses an inner <g transform="..."> for transforms.
        Avoids CSS transform issues on the root <svg> element in mobile browsers.
      */}
      <svg
        id="mindmap-svg-canvas"
        className="w-full h-full block cursor-grab active:cursor-grabbing select-none"
      >
        <defs>
          <filter id="soft-card-shadow" x="-15%" y="-15%" width="130%" height="135%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.07" />
          </filter>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Connecting Curved Bezier Branches */}
          <g id="mindmap-connections-group">
            {nodes.map((node) => {
              if (!node.parentId) return null;
              if (!isNodeVisible(node)) return null;

              const parent = nodeMap.get(node.parentId);
              if (!parent) return null;

              const isRight = node.side === 'right';
              const parentW = parent.width || 180;
              const nodeW = node.width || 150;

              // Connecteurs ancrés directement sur les bords des boîtes
              const startX = isRight ? parent.x + parentW / 2 : parent.x - parentW / 2;
              const startY = parent.y;

              const endX = isRight ? node.x - nodeW / 2 : node.x + nodeW / 2;
              const endY = node.y;

              const dx = endX - startX;
              const ctrl1X = startX + dx * 0.5;
              const ctrl1Y = startY;
              const ctrl2X = endX - dx * 0.5;
              const ctrl2Y = endY;

              const pathData = `M ${startX} ${startY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${endX} ${endY}`;
              const strokeWidth = parent.isCentral ? 3.8 : 2.6;

              return (
                <g key={`branch-${node.id}`}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={18}
                    className="cursor-pointer"
                    onClick={() => setSelectedNodeId(node.id)}
                  />
                  <path
                    d={pathData}
                    fill="none"
                    stroke={node.color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </g>

          {/* Nodes and Container Boxes */}
          <g id="mindmap-nodes-group">
            {nodes.map((node) => {
              if (!isNodeVisible(node)) return null;

              const isSelected = selectedNodeId === node.id;
              const children = childrenMap.get(node.id) || [];
              const hasChildren = children.length > 0;
              const isCollapsed = collapsedNodes[node.id];
              const boxW = node.width || (node.isCentral ? 220 : 160);
              const boxH = node.height || (node.isCentral ? 68 : 48);
              const isRightSide = node.side === 'right';

              return (
                <g
                  key={node.id}
                  id={`node-${node.id}`}
                  transform={`translate(${node.x}, ${node.y})`}
                  onPointerDown={(e) => handleNodePointerDown(node.id, e)}
                  onDoubleClick={() => startEditing(node)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                  className="cursor-pointer select-none group"
                >
                  {/* Selection Outline Glow */}
                  {isSelected && (
                    <rect
                      x={-boxW / 2 - 4}
                      y={-boxH / 2 - 4}
                      width={boxW + 8}
                      height={boxH + 8}
                      rx={node.isCentral ? 20 : (node.level === 1 ? 16 : 13)}
                      fill="none"
                      stroke={node.color || '#0F172A'}
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      opacity={0.85}
                    />
                  )}

                  {/* Card Background Container Box (Rectangle arrondi fermé) */}
                  <rect
                    x={-boxW / 2}
                    y={-boxH / 2}
                    width={boxW}
                    height={boxH}
                    rx={node.isCentral ? 16 : (node.level === 1 ? 12 : 9)}
                    fill="#FFFFFF"
                    stroke={isSelected ? '#0F172A' : (node.isCentral ? '#334155' : node.color)}
                    strokeWidth={isSelected ? 3 : (node.isCentral ? 2.5 : 2)}
                    filter="url(#soft-card-shadow)"
                    className="transition-all duration-150"
                  />

                  {/* Visual Accent Strip for Level 1 branch boxes */}
                  {node.level === 1 && !node.isCentral && (
                    <rect
                      x={isRightSide ? -boxW / 2 : boxW / 2 - 5}
                      y={-boxH / 2 + 3}
                      width={5}
                      height={boxH - 6}
                      rx={2.5}
                      fill={node.color}
                    />
                  )}

                  {/* Text & Math formula inside the Card Box */}
                  <foreignObject
                    x={-boxW / 2 + (node.level === 1 ? 10 : 6)}
                    y={-boxH / 2 + 2}
                    width={boxW - (node.level === 1 ? 18 : 12)}
                    height={boxH - 4}
                    className="pointer-events-none select-none overflow-hidden"
                  >
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        padding: '0 4px',
                        userSelect: 'none',
                        lineHeight: '1.25'
                      }}
                    >
                      <div
                        className={`${
                          node.isCentral
                            ? 'font-bold text-[14.5px] text-slate-800 tracking-tight'
                            : node.level === 1
                            ? 'font-bold text-[13px] text-slate-900 tracking-tight'
                            : 'font-semibold text-[12px] text-slate-800'
                        }`}
                      >
                        <MathText text={node.text} inline />
                      </div>
                    </div>
                  </foreignObject>

                  {/* Fold/unfold pill button directly on the outer anchor handle */}
                  {hasChildren && (
                    <g
                      transform={`translate(${isRightSide ? boxW / 2 + 10 : -boxW / 2 - 10}, 0)`}
                      onClick={(e) => handleToggleCollapse(node.id, e)}
                      className="cursor-pointer hover:scale-125 transition-transform"
                    >
                      <circle
                        r={8}
                        fill="#FFFFFF"
                        stroke={node.color}
                        strokeWidth={1.8}
                        filter="url(#soft-card-shadow)"
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        y={-0.5}
                        className="text-[11px] font-black fill-slate-700 select-none pointer-events-none"
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
