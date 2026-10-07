import React, { useState } from 'react';
import { GitFork, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface DiagramRendererProps {
  data: {
    nodes?: Array<{ id: string; label: string; x?: number; y?: number; color?: string; description?: string }>;
    links?: Array<{ from: string; to: string; label?: string }>;
    rawSvg?: string;
  };
  title?: string;
}

export function DiagramRenderer({ data, title }: DiagramRendererProps) {
  const [zoom, setZoom] = useState(1);

  const nodes = data.nodes || [
    { id: '1', label: 'Concept Central', x: 250, y: 70, color: '#f97316', description: 'Idée maîtresse' },
    { id: '2', label: 'Branche A', x: 120, y: 180, color: '#3b82f6', description: 'Application pratique' },
    { id: '3', label: 'Branche B', x: 380, y: 180, color: '#10b981', description: 'Théorie & Formules' },
    { id: '4', label: 'Détail A.1', x: 70, y: 280, color: '#8b5cf6', description: 'Cas concret' },
    { id: '5', label: 'Détail B.1', x: 430, y: 280, color: '#ec4899', description: 'Démonstration' }
  ];

  const links = data.links || [
    { from: '1', to: '2' },
    { from: '1', to: '3' },
    { from: '2', to: '4' },
    { from: '3', to: '5' }
  ];

  return (
    <div className="w-full h-full flex flex-col p-4 sm:p-6 text-zinc-100 overflow-hidden select-none">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-700/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <GitFork className="w-4 h-4 text-violet-400 shrink-0" />
          <h3 className="text-sm font-bold text-zinc-200 truncate">
            {title || 'Schéma & Carte Conceptuelle'}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.6, z - 0.2))}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 cursor-pointer"
            title="Dézoomer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono text-zinc-400 px-1">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 cursor-pointer"
            title="Zoomer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 cursor-pointer"
            title="Réinitialiser"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 w-full bg-[#14161d] rounded-2xl border border-zinc-800 overflow-auto custom-scrollbar relative flex items-center justify-center p-4">
        {data.rawSvg ? (
          <div
            dangerouslySetInnerHTML={{ __html: data.rawSvg }}
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            className="transition-transform duration-150"
          />
        ) : (
          <svg
            viewBox="0 0 500 360"
            className="w-full max-w-[500px] h-auto transition-transform duration-150"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          >
            {/* Lignes de liaison */}
            {links.map((link, idx) => {
              const src = nodes.find(n => n.id === link.from);
              const dst = nodes.find(n => n.id === link.to);
              if (!src || !dst) return null;
              return (
                <line
                  key={idx}
                  x1={src.x}
                  y1={src.y}
                  x2={dst.x}
                  y2={dst.y}
                  stroke="#3f4450"
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                />
              );
            })}

            {/* Nœuds */}
            {nodes.map((node) => (
              <g key={node.id} className="cursor-pointer group">
                <rect
                  x={(node.x || 0) - 60}
                  y={(node.y || 0) - 22}
                  width="120"
                  height="44"
                  rx="10"
                  fill="#1f232c"
                  stroke={node.color || '#3b82f6'}
                  strokeWidth="2"
                  className="transition-all group-hover:brightness-125 filter drop-shadow-md"
                />
                <text
                  x={node.x}
                  y={(node.y || 0) - 2}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight="bold"
                >
                  {node.label}
                </text>
                {node.description && (
                  <text
                    x={node.x}
                    y={(node.y || 0) + 12}
                    textAnchor="middle"
                    fill="#9ca3af"
                    fontSize="8.5"
                  >
                    {node.description}
                  </text>
                )}
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
export default DiagramRenderer;
