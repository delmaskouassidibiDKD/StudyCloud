import React, { useEffect, useRef } from 'react';

const COLS = 22;
const ROWS = 18;

// Line color — neutral grey for the Cloudflare OS design system
const LINE_R = 120;
const LINE_G = 118;
const LINE_B = 113;

/**
 * Static perspective hexagonal mesh background from Cloudflare OS.
 * Draws a wireframe hex grid that recedes toward a vanishing point.
 */
export const MeshBackground: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cssW = 0;
    let cssH = 0;

    // Project a flat-space point (fx, fy) in normalized coords into perspective.
    const project = (
      fx: number,
      fy: number,
      w: number,
      h: number,
      t: number
    ): [number, number] => {
      const vpX = w * 0.5;
      const vpY = h * 0.15;

      const depth = Math.max(0, Math.min(1, fy));
      const spread = 1 - depth * 0.85;
      const x = vpX + (fx - 0.5) * w * 1.4 * spread;
      const y = vpY + (1 - depth) * (h * 1.05 - vpY);

      // Layered sine displacement
      const wave1 = Math.sin(t * 0.6 + fx * 5 + fy * 3) * 8 * (1 - depth * 0.5);
      const wave2 = Math.sin(t * 0.35 + fx * 3 - fy * 7) * 5 * (1 - depth * 0.6);
      const wave3 = Math.cos(t * 0.2 + fx * 8 + fy * 2) * 3 * (1 - depth * 0.4);
      const wave4 = Math.sin(t * 0.8 + fx * 12 + fy * 5) * 2 * (1 - depth * 0.7);

      return [x + wave3 * 0.7 + wave4 * 0.3, y + wave1 + wave2];
    };

    const hexH = 1 / ROWS;
    const hexW = 1 / COLS;
    const rowH = hexH * 0.75;

    type Edge = [[number, number], [number, number]];
    const edges: Edge[] = [];

    const rx = hexW * 0.55;
    const ry = hexH * 0.5;

    const extraCols = 3;
    const extraRows = 3;

    for (let r = -extraRows; r <= ROWS + extraRows; r++) {
      for (let c = -extraCols; c <= COLS + extraCols; c++) {
        const offset = r % 2 !== 0 ? hexW * 0.5 : 0;
        const cx = c * hexW + hexW * 0.5 + offset;
        const cy = r * rowH + hexH * 0.5;

        const v: [number, number][] = [
          [cx, cy - ry],
          [cx + rx, cy - ry * 0.5],
          [cx + rx, cy + ry * 0.5],
          [cx, cy + ry],
          [cx - rx, cy + ry * 0.5],
          [cx - rx, cy - ry * 0.5],
        ];

        edges.push([v[0], v[1]]);
        edges.push([v[1], v[2]]);
        edges.push([v[2], v[3]]);
      }
    }

    const ALPHA_STEPS = 64;
    const strokeCache: string[] = Array.from({ length: ALPHA_STEPS });
    const rVal = isDark ? 160 : LINE_R;
    const gVal = isDark ? 165 : LINE_G;
    const bVal = isDark ? 180 : LINE_B;

    for (let i = 0; i < ALPHA_STEPS; i++) {
      const a = (i / (ALPHA_STEPS - 1)) * (isDark ? 0.35 : 0.25);
      strokeCache[i] = `rgba(${rVal}, ${gVal}, ${bVal}, ${a})`;
    }

    const draw = () => {
      const w = cssW;
      const h = cssH;
      const t = 0;

      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < edges.length; i++) {
        const [a, b] = edges[i];
        const [x1, y1] = project(a[0], a[1], w, h, t);
        const [x2, y2] = project(b[0], b[1], w, h, t);

        const avgDepth = Math.max(0, Math.min(1, (a[1] + b[1]) * 0.5));
        const nearness = 1 - avgDepth;
        const alpha = 0.05 + nearness * (isDark ? 0.25 : 0.2);
        const lw = 0.4 + nearness * 0.7;

        const alphaIdx = Math.min(ALPHA_STEPS - 1, Math.max(0, Math.round(alpha * (ALPHA_STEPS - 1))));
        ctx.strokeStyle = strokeCache[alphaIdx];
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cssW = rect.width;
      cssH = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    return () => {
      ro.disconnect();
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none opacity-60 dark:opacity-40"
    />
  );
};
