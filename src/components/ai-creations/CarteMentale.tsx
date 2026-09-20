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
  Crosshair
} from 'lucide-react';
import { MathText } from '../MathText';

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
}

// Nodes with layout precisely matching Image 2 (Carte_mentaleimage10.png)
// Nœuds initiaux neutres et adaptatifs prêts pour toute matière
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
    width: 200
  },
  // Branche 1 (Haut gauche)
  {
    id: 'b_l_0',
    parentId: 'root',
    text: 'Axe 1 : Notions Fondamentales',
    x: 940,
    y: 460,
    color: '#0E5EBA',
    side: 'left',
    width: 220
  },
  {
    id: 'b_l_0_sub_0',
    parentId: 'b_l_0',
    text: 'Définitions et principes clés',
    x: 640,
    y: 430,
    color: '#0E5EBA',
    side: 'left',
    width: 200
  },
  {
    id: 'b_l_0_sub_1',
    parentId: 'b_l_0',
    text: 'Hypothèses d’application',
    x: 640,
    y: 490,
    color: '#0E5EBA',
    side: 'left',
    width: 190
  },
  // Branche 2 (Bas gauche)
  {
    id: 'b_l_1',
    parentId: 'root',
    text: 'Axe 2 : Méthodes & Formules',
    x: 940,
    y: 820,
    color: '#D11928',
    side: 'left',
    width: 220
  },
  {
    id: 'b_l_1_sub_0',
    parentId: 'b_l_1',
    text: 'Équations directrices',
    x: 640,
    y: 790,
    color: '#D11928',
    side: 'left',
    width: 180
  },
  {
    id: 'b_l_1_sub_1',
    parentId: 'b_l_1',
    text: 'Conditions de validité',
    x: 640,
    y: 850,
    color: '#D11928',
    side: 'left',
    width: 180
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
    width: 220
  },
  {
    id: 'b_r_0_sub_0',
    parentId: 'b_r_0',
    text: 'Cas d’étude concret',
    x: 1820,
    y: 430,
    color: '#1E8238',
    side: 'right',
    width: 180
  },
  {
    id: 'b_r_0_sub_1',
    parentId: 'b_r_0',
    text: 'Exemple d’application',
    x: 1820,
    y: 490,
    color: '#1E8238',
    side: 'right',
    width: 180
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
    width: 210
  },
  {
    id: 'b_r_1_sub_0',
    parentId: 'b_r_1',
    text: 'Pièges fréquents à éviter',
    x: 1820,
    y: 790,
    color: '#7B1FA2',
    side: 'right',
    width: 200
  },
  {
    id: 'b_r_1_sub_1',
    parentId: 'b_r_1',
    text: 'Points à retenir pour examen',
    x: 1820,
    y: 850,
    color: '#7B1FA2',
    side: 'right',
    width: 220
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
    const w = n.width || 120;
    if (n.side === 'left') {
      minX = Math.min(minX, n.x - w - 25);
      maxX = Math.max(maxX, n.x + 20);
    } else if (n.side === 'right') {
      minX = Math.min(minX, n.x - 20);
      maxX = Math.max(maxX, n.x + w + 25);
    } else {
      minX = Math.min(minX, n.x - 100);
      maxX = Math.max(maxX, n.x + 100);
    }
    minY = Math.min(minY, n.y - 45);
    maxY = Math.max(maxY, n.y + 45);
  });

  return {
    minX: Number.isFinite(minX) ? minX : 260,
    maxX: Number.isFinite(maxX) ? maxX : 2180,
    minY: Number.isFinite(minY) ? minY : 100,
    maxY: Number.isFinite(maxY) ? maxY : 1180,
    width: Number.isFinite(maxX - minX) ? maxX - minX : 1920,
    height: Number.isFinite(maxY - minY) ? maxY - minY : 1080
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

export function buildMindNodes(data: any, fallbackTitle?: string): MindNode[] {
  if (!data) return INITIAL_NODES;
  if (Array.isArray(data.nodes) && data.nodes.length > 0) return data.nodes;

  const actualData = data.mind_map || data.mindmap || data.mindMap || data;

  let rootText = actualData.root_title || actualData.rootTitle || actualData.title || actualData.root?.text || actualData.root?.label || fallbackTitle || 'Carte Mentale';
  let level1List: Array<any> = [];

  if (Array.isArray(actualData.branches)) {
    level1List = actualData.branches;
  } else if (Array.isArray(actualData.root?.children)) {
    level1List = actualData.root.children;
  } else if (Array.isArray(actualData.concepts)) {
    level1List = actualData.concepts;
  } else if (Array.isArray(actualData.themes)) {
    level1List = actualData.themes;
  } else if (Array.isArray(actualData.cards)) {
    level1List = actualData.cards;
  } else if (Array.isArray(actualData)) {
    level1List = actualData;
  }

  if (level1List.length === 0) {
    return INITIAL_NODES;
  }

  const result: MindNode[] = [];
  const rootId = 'root';
  const rootWidth = Math.min(360, Math.max(180, Math.round(rootText.length * 9.5 + 36)));
  result.push({
    id: rootId,
    parentId: null,
    text: rootText,
    x: 1220,
    y: 640,
    color: '#334155',
    side: 'center',
    isCentral: true,
    width: rootWidth
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

  const leftBranches: Array<{ item: any; origIdx: number }> = [];
  const rightBranches: Array<{ item: any; origIdx: number }> = [];

  level1List.forEach((item, idx) => {
    if (idx % 2 === 0) {
      leftBranches.push({ item, origIdx: idx });
    } else {
      rightBranches.push({ item, origIdx: idx });
    }
  });

  // Position left branches
  const leftCount = leftBranches.length;
  const leftSpacing = Math.min(220, Math.max(110, 780 / (leftCount + 1)));
  const leftStartY = 640 - ((leftCount - 1) * leftSpacing) / 2;

  leftBranches.forEach(({ item, origIdx }, i) => {
    const branchId = `b_l_${origIdx}`;
    const branchText = item.branch_title || item.branchTitle || item.text || item.title || item.label || item.name || `Branche ${origIdx + 1}`;
    const branchY = leftStartY + i * leftSpacing;
    const branchColor = branchColors[origIdx % branchColors.length];
    const branchWidth = Math.min(380, Math.max(140, Math.round(branchText.length * 8.5 + 24)));

    result.push({
      id: branchId,
      parentId: rootId,
      text: branchText,
      x: 940,
      y: branchY,
      color: branchColor,
      side: 'left',
      width: branchWidth
    });

    const subList = Array.isArray(item.nodes) ? item.nodes : (Array.isArray(item.children) ? item.children : (Array.isArray(item.items) ? item.items : (Array.isArray(item.subconcepts) ? item.subconcepts : [])));
    if (subList.length > 0) {
      const hasLongSub = subList.some((s: any) => {
        const str = typeof s === 'string' ? s : (s.text || s.title || '');
        return str.length > 30 || str.includes('$') || str.includes('\n');
      });
      const subSpacing = hasLongSub ? 52 : 44;
      const subStartY = branchY - ((subList.length - 1) * subSpacing) / 2;
      subList.forEach((sub: any, sIdx: number) => {
        const subText = typeof sub === 'string' ? sub : (sub.text || sub.title || sub.name || `Sous-notion ${sIdx + 1}`);
        const subWidth = Math.min(420, Math.max(110, Math.round(subText.length * 8 + 22)));
        result.push({
          id: `${branchId}_sub_${sIdx}`,
          parentId: branchId,
          text: subText,
          x: Math.min(680, 940 - branchWidth - 30),
          y: subStartY + sIdx * subSpacing,
          color: branchColor,
          side: 'left',
          width: subWidth
        });
      });
    }
  });

  // Position right branches
  const rightCount = rightBranches.length;
  const rightSpacing = Math.min(220, Math.max(110, 780 / (rightCount + 1)));
  const rightStartY = 640 - ((rightCount - 1) * rightSpacing) / 2;

  rightBranches.forEach(({ item, origIdx }, i) => {
    const branchId = `b_r_${origIdx}`;
    const branchText = item.branch_title || item.branchTitle || item.text || item.title || item.label || item.name || `Branche ${origIdx + 1}`;
    const branchY = rightStartY + i * rightSpacing;
    const branchColor = branchColors[origIdx % branchColors.length];
    const branchWidth = Math.min(380, Math.max(140, Math.round(branchText.length * 8.5 + 24)));

    result.push({
      id: branchId,
      parentId: rootId,
      text: branchText,
      x: 1540,
      y: branchY,
      color: branchColor,
      side: 'right',
      width: branchWidth
    });

    const subList = Array.isArray(item.nodes) ? item.nodes : (Array.isArray(item.children) ? item.children : (Array.isArray(item.items) ? item.items : (Array.isArray(item.subconcepts) ? item.subconcepts : [])));
    if (subList.length > 0) {
      const hasLongSub = subList.some((s: any) => {
        const str = typeof s === 'string' ? s : (s.text || s.title || '');
        return str.length > 30 || str.includes('$') || str.includes('\n');
      });
      const subSpacing = hasLongSub ? 52 : 44;
      const subStartY = branchY - ((subList.length - 1) * subSpacing) / 2;
      subList.forEach((sub: any, sIdx: number) => {
        const subText = typeof sub === 'string' ? sub : (sub.text || sub.title || sub.name || `Sous-notion ${sIdx + 1}`);
        const subWidth = Math.min(420, Math.max(110, Math.round(subText.length * 8 + 22)));
        result.push({
          id: `${branchId}_sub_${sIdx}`,
          parentId: branchId,
          text: subText,
          x: Math.max(1800, 1540 + branchWidth + 30),
          y: subStartY + sIdx * subSpacing,
          color: branchColor,
          side: 'right',
          width: subWidth
        });
      });
    }
  });

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
            const width = Math.max(trimmed.length * 8.5 + 20, 55);
            return { ...n, text: trimmed, width: n.isCentral ? 176 : width };
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
    const offsetX = side === 'left' ? -170 : 170;
    const newChild: MindNode = {
      id: newId,
      parentId: parent.id,
      text: 'Nouvelle idée',
      x: parent.x + offsetX,
      y: parent.y + 35,
      color: parent.color,
      side,
      width: 105
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

  const handleExportSVG = () => {
    const svgEl = document.getElementById('mindmap-svg-canvas');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'carte-mentale.svg';
    a.click();
    URL.revokeObjectURL(url);
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

          {/* Download SVG */}
          <button
            id="btn-mm-export"
            onClick={handleExportSVG}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors active:scale-95"
            title="Télécharger l'image SVG"
          >
            <Download className="w-4 h-4" />
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

              let startX = parent.x;
              let startY = parent.y;

              if (parent.isCentral) {
                if (node.id === 'blog') {
                  startX = parent.x;
                  startY = parent.y + 35;
                } else if (node.side === 'left') {
                  startX = parent.x - 88;
                  startY = parent.y;
                } else {
                  startX = parent.x + 88;
                  startY = parent.y;
                }
              } else {
                const parentW = parent.width || 100;
                if (parent.side === 'left') {
                  startX = parent.x - parentW;
                  startY = parent.y;
                } else {
                  startX = parent.x + parentW;
                  startY = parent.y;
                }
              }

              const endX = node.x;
              const endY = node.y;

              const dx = endX - startX;
              const ctrl1X = startX + dx * 0.48;
              const ctrl1Y = startY;
              const ctrl2X = endX - dx * 0.48;
              const ctrl2Y = endY;

              const pathData = `M ${startX} ${startY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${endX} ${endY}`;
              const strokeWidth = parent.isCentral ? 4.5 : 3;

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

          {/* Nodes and Underlined Labels */}
          <g id="mindmap-nodes-group">
            {nodes.map((node) => {
              if (!isNodeVisible(node)) return null;

              const isSelected = selectedNodeId === node.id;
              const children = childrenMap.get(node.id) || [];
              const hasChildren = children.length > 0;
              const isCollapsed = collapsedNodes[node.id];
              const calcWidth = Math.max(120, Math.min(480, Math.round(node.text.length * 8.5 + 24)));
              const nodeWidth = node.width ? Math.max(node.width, calcWidth) : calcWidth;

              // CENTRAL ROOT BOX (Matches Image 2 exactly)
              if (node.isCentral) {
                const centralW = Math.max(node.width || 180, Math.min(420, Math.round(node.text.length * 9.5 + 36)));
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
                    className="cursor-pointer select-none"
                  >
                    <rect
                      x={-centralW / 2}
                      y={-35}
                      width={centralW}
                      height={70}
                      rx={16}
                      fill="#FFFFFF"
                      stroke={isSelected ? '#0F172A' : '#CBD5E1'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      filter="url(#soft-card-shadow)"
                    />
                    {(() => {
                      const rootLines = node.text.split('\n');
                      if (rootLines.length === 1) {
                        return (
                          <text
                            textAnchor="middle"
                            y={6}
                            className="font-sans font-bold text-[15px] fill-slate-800 pointer-events-none tracking-tight"
                          >
                            {node.text}
                          </text>
                        );
                      }
                      return (
                        <>
                          <text
                            textAnchor="middle"
                            y={-6}
                            className="font-sans font-bold text-[14px] fill-slate-800 pointer-events-none tracking-tight"
                          >
                            {rootLines[0]}
                          </text>
                          <text
                            textAnchor="middle"
                            y={18}
                            className="font-sans font-bold text-[14px] fill-slate-800 pointer-events-none tracking-tight"
                          >
                            {rootLines.slice(1).join(' ')}
                          </text>
                        </>
                      );
                    })()}
                  </g>
                );
              }

              // BRANCH / LEAF NODES (Underlined matching Image 2)
              const isRightSide = node.side === 'right';
              const underlineStartX = isRightSide ? node.x : node.x - nodeWidth;
              const underlineEndX = isRightSide ? node.x + nodeWidth : node.x;

              const textX = isRightSide ? node.x + 3 : node.x - 3;
              const textAnchor = isRightSide ? 'start' : 'end';
              const lines = node.text.split('\n');

              return (
                <g
                  key={node.id}
                  id={`node-${node.id}`}
                  onPointerDown={(e) => handleNodePointerDown(node.id, e)}
                  onDoubleClick={() => startEditing(node)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                  className="cursor-pointer select-none"
                >
                  {/* Invisible Hitbox covering entire idea area for PC mouse click & dragging */}
                  <rect
                    x={isRightSide ? node.x - 6 : node.x - nodeWidth - 6}
                    y={lines.length > 1 ? node.y - 32 : node.y - 24}
                    width={nodeWidth + 12}
                    height={lines.length > 1 ? 44 : 34}
                    fill="transparent"
                    style={{ pointerEvents: 'all' }}
                    className="cursor-pointer"
                    onPointerDown={(e) => handleNodePointerDown(node.id, e)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                    }}
                  />

                  {/* Horizontal Baseline Underline */}
                  <line
                    x1={underlineStartX}
                    y1={node.y}
                    x2={underlineEndX}
                    y2={node.y}
                    stroke={node.color}
                    strokeWidth={node.parentId === 'root' ? 4.2 : 3}
                    strokeLinecap="round"
                  />

                  {/* Selection Highlight */}
                  {isSelected && (
                    <rect
                      x={isRightSide ? node.x - 4 : node.x - nodeWidth - 4}
                      y={node.y - 28}
                      width={nodeWidth + 8}
                      height={34}
                      rx={6}
                      fill={node.color}
                      fillOpacity={0.12}
                      stroke={node.color}
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                  )}

                  {/* Label text */}
                  {node.text.includes('$') || node.text.includes('\\') ? (
                    <foreignObject
                      x={isRightSide ? node.x + 3 : node.x - nodeWidth - 3}
                      y={node.y - 26}
                      width={nodeWidth + 14}
                      height={26}
                      className="pointer-events-none overflow-visible select-none"
                    >
                      <div
                        className={`text-[12.5px] font-medium text-slate-800 select-none ${
                          isRightSide ? 'text-left' : 'text-right'
                        }`}
                      >
                        <MathText text={node.text} />
                      </div>
                    </foreignObject>
                  ) : lines.length === 1 ? (
                    <text
                      x={textX}
                      y={node.y - 5}
                      textAnchor={textAnchor}
                      className="font-sans font-medium text-[13.5px] fill-slate-800 tracking-tight select-none pointer-events-none"
                    >
                      {node.text}
                    </text>
                  ) : (
                    <g className="pointer-events-none select-none">
                      <text
                        x={textX}
                        y={node.y - 19}
                        textAnchor={textAnchor}
                        className="font-sans font-medium text-[13px] fill-slate-800 tracking-tight"
                      >
                        {lines[0]}
                      </text>
                      <text
                        x={textX}
                        y={node.y - 5}
                        textAnchor={textAnchor}
                        className="font-sans font-medium text-[13px] fill-slate-800 tracking-tight"
                      >
                        {lines[1]}
                      </text>
                    </g>
                  )}

                  {/* Fold/unfold pill if has children */}
                  {hasChildren && (
                    <g
                      transform={`translate(${isRightSide ? underlineEndX + 9 : underlineStartX - 9}, ${node.y})`}
                      onClick={(e) => handleToggleCollapse(node.id, e)}
                      className="cursor-pointer hover:scale-125 transition-transform"
                    >
                      <circle
                        r={7.5}
                        fill="#FFFFFF"
                        stroke={node.color}
                        strokeWidth={1.5}
                        filter="url(#soft-card-shadow)"
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        y={-0.5}
                        className="text-[10px] font-bold fill-slate-700 select-none pointer-events-none"
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
