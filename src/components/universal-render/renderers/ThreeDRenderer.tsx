import React, { useRef, useEffect, useState } from 'react';
import { Box, Rotate3d, Eye, RefreshCw } from 'lucide-react';

interface ThreeDRendererProps {
  data: {
    modelType?: 'cube' | 'sphere' | 'torus' | 'pyramid' | string;
    color?: string;
    wireframe?: boolean;
    autoRotate?: boolean;
  };
  title?: string;
}

export function ThreeDRenderer({ data, title }: ThreeDRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wireframe, setWireframe] = useState(data.wireframe ?? true);
  const [autoRotate, setAutoRotate] = useState(data.autoRotate ?? true);
  const [shape, setShape] = useState<'cube' | 'pyramid' | 'torus'>((data.modelType as any) || 'cube');

  const rotRef = useRef({ x: 0.4, y: 0.6 });
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    // Définition des sommets 3D selon la forme
    let vertices: [number, number, number][] = [];
    let edges: [number, number][] = [];

    if (shape === 'cube') {
      const s = 1.1;
      vertices = [
        [-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s],
        [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s]
      ];
      edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7]
      ];
    } else if (shape === 'pyramid') {
      const s = 1.3;
      vertices = [
        [-s, s, -s], [s, s, -s], [s, s, s], [-s, s, s],
        [0, -s, 0]
      ];
      edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [0, 4], [1, 4], [2, 4], [3, 4]
      ];
    } else {
      // Anneau / Torus discret
      const R = 1.3;
      const r = 0.5;
      const segU = 16;
      const segV = 8;
      for (let i = 0; i < segU; i++) {
        const u = (i / segU) * Math.PI * 2;
        for (let j = 0; j < segV; j++) {
          const v = (j / segV) * Math.PI * 2;
          const x = (R + r * Math.cos(v)) * Math.cos(u);
          const y = (R + r * Math.cos(v)) * Math.sin(u);
          const z = r * Math.sin(v);
          vertices.push([x, y, z]);
          const current = i * segV + j;
          const nextV = i * segV + ((j + 1) % segV);
          const nextU = ((i + 1) % segU) * segV + j;
          edges.push([current, nextV], [current, nextU]);
        }
      }
    }

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (autoRotate && !isDraggingRef.current) {
        rotRef.current.y += 0.015;
        rotRef.current.x += 0.008;
      }

      const cx = width / 2;
      const cy = height / 2;
      const scale = Math.min(width, height) / 3.8;

      const cosX = Math.cos(rotRef.current.x);
      const sinX = Math.sin(rotRef.current.x);
      const cosY = Math.cos(rotRef.current.y);
      const sinY = Math.sin(rotRef.current.y);

      // Projection 3D -> 2D
      const projected = vertices.map(([vx, vy, vz]) => {
        // Rotation Y
        const x1 = vx * cosY + vz * sinY;
        const y1 = vy;
        const z1 = -vx * sinY + vz * cosY;

        // Rotation X
        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;

        // Perspective
        const fov = 3.5;
        const dist = z2 + fov;
        const projX = cx + (x2 / dist) * scale;
        const projY = cy + (y2 / dist) * scale;
        return { x: projX, y: projY, z: z2 };
      });

      // Dessiner les arêtes
      ctx.lineWidth = 2;
      ctx.strokeStyle = data.color || '#38bdf8';
      ctx.beginPath();
      for (const [p1, p2] of edges) {
        const pt1 = projected[p1];
        const pt2 = projected[p2];
        if (pt1 && pt2) {
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
        }
      }
      ctx.stroke();

      // Dessiner les sommets
      ctx.fillStyle = '#f97316';
      for (const pt of projected) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [shape, autoRotate, wireframe, data.color]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    rotRef.current.y += dx * 0.01;
    rotRef.current.x += dy * 0.01;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="w-full h-full flex flex-col p-4 sm:p-6 text-zinc-100 overflow-hidden select-none">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-700/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Box className="w-4 h-4 text-cyan-400 shrink-0" />
          <h3 className="text-sm font-bold text-zinc-200 truncate">
            {title || 'Modèle 3D interactif'}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShape(s => s === 'cube' ? 'pyramid' : s === 'pyramid' ? 'torus' : 'cube')}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-700 transition-colors"
            title="Changer de géométrie"
          >
            Forme: <span className="text-cyan-300 capitalize">{shape}</span>
          </button>

          <button
            type="button"
            onClick={() => setAutoRotate(r => !r)}
            className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              autoRotate ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
            title="Rotation automatique"
          >
            <Rotate3d className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 w-full bg-[#12141a] rounded-2xl border border-zinc-800/80 shadow-2xl relative flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          className="w-full h-full object-contain"
        />

        <div className="absolute bottom-3 left-3 text-[10px] text-zinc-500 pointer-events-none bg-black/40 px-2 py-1 rounded-md backdrop-blur-sm">
          Glissez avec la souris pour pivoter à 360°
        </div>
      </div>
    </div>
  );
}
export default ThreeDRenderer;
