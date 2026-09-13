import React, { useState } from 'react';
import { Brain, ZoomIn, ZoomOut, RotateCcw, ChevronRight, ChevronDown, Sparkles } from 'lucide-react';
import { MindMapContent, MindMapNode } from './types';

interface MindMapViewProps {
  title: string;
  sourceFileName?: string;
  content: MindMapContent;
  onUpdateContent?: (newContent: MindMapContent) => void;
}

const BRANCH_COLORS = [
  'from-violet-500 to-purple-600 border-violet-400 text-violet-100',
  'from-blue-500 to-indigo-600 border-blue-400 text-blue-100',
  'from-emerald-500 to-teal-600 border-emerald-400 text-emerald-100',
  'from-amber-500 to-orange-600 border-amber-400 text-amber-100',
  'from-rose-500 to-pink-600 border-rose-400 text-rose-100',
  'from-cyan-500 to-blue-600 border-cyan-400 text-cyan-100',
];

interface TreeNodeProps {
  node: MindMapNode;
  level: number;
  branchIndex: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, level, branchIndex }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const colorClass = BRANCH_COLORS[branchIndex % BRANCH_COLORS.length];

  return (
    <div className="flex flex-col items-start relative pl-4 sm:pl-6 my-1.5 border-l-2 border-zinc-700/60 transition-all">
      {/* Node Pill */}
      <div className="flex items-center gap-2 group">
        <div
          onClick={() => hasChildren && setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm transition-all cursor-pointer ${
            level === 0
              ? 'bg-gradient-to-r from-orange-500 to-amber-600 border-orange-400 text-white font-black text-sm sm:text-base shadow-[0_0_15px_rgba(249,115,22,0.3)]'
              : level === 1
              ? `bg-gradient-to-r ${colorClass} font-bold text-xs sm:text-sm`
              : 'bg-[#282b30] border-zinc-700 text-zinc-200 hover:border-zinc-500 font-medium text-xs'
          }`}
        >
          {hasChildren && (
            <span className="p-0.5 rounded hover:bg-black/20 transition-colors">
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
          )}
          <span>{node.label}</span>
          {node.details && (
            <span className="text-[10px] opacity-80 italic max-w-[150px] truncate">
              ({node.details})
            </span>
          )}
        </div>
      </div>

      {/* Children list */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col w-full mt-1.5 space-y-1">
          {node.children!.map((child, idx) => (
            <TreeNode
              key={child.id || idx}
              node={child}
              level={level + 1}
              branchIndex={level === 0 ? idx : branchIndex}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const MindMapView: React.FC<MindMapViewProps> = ({
  title,
  sourceFileName,
  content,
}) => {
  const [zoom, setZoom] = useState(1);

  const rootNode: MindMapNode = content.root || {
    id: 'root',
    label: title || 'Thème Principal',
    children: [],
  };

  return (
    <div className="w-full h-full flex flex-col space-y-4 animate-fadeIn p-1">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-700/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30 shadow-sm">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white leading-tight">{title}</h2>
            {sourceFileName && (
              <p className="text-xs text-zinc-400 font-medium truncate max-w-[240px]">
                Arborescence pour <span className="text-violet-300 font-semibold">{sourceFileName}</span>
              </p>
            )}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-zinc-800 p-1 rounded-xl border border-zinc-700">
          <button
            onClick={() => setZoom(prev => Math.max(0.7, prev - 0.1))}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-700 transition-colors cursor-pointer"
            title="Dézoomer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-zinc-300 px-1">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(prev => Math.min(1.4, prev + 0.1))}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-700 transition-colors cursor-pointer"
            title="Zoomer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-700 transition-colors cursor-pointer"
            title="Réinitialiser le zoom"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Tip Banner */}
      <div className="flex items-center gap-2 bg-violet-950/20 border border-violet-500/30 px-3.5 py-2 rounded-xl text-xs text-violet-200">
        <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
        <span>Cliquez sur les nœuds fléchés pour déplier ou replier les branches conceptuelles.</span>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 bg-[#1d1f23] border border-zinc-800 rounded-2xl p-4 sm:p-6 overflow-auto custom-scrollbar shadow-inner relative">
        <div 
          className="transition-transform duration-200 origin-top-left"
          style={{ transform: `scale(${zoom})` }}
        >
          <TreeNode node={rootNode} level={0} branchIndex={0} />
        </div>
      </div>
    </div>
  );
};
