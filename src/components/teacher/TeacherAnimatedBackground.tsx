import React, { useEffect, useRef } from 'react';

/**
 * Fond animé continu, lent et professionnel conçu sur mesure pour l'espace Enseignant (Calcul de Moyenne & Gestion Scolaire).
 * - Palette harmonisée avec la barre latérale StudyCloud (#002f3a -> #061826 -> #0a172b).
 * - Animation 100 % vectorielle & Canvas 60 FPS, sans coupure de boucle ni artefact :
 *   aurores lentes, grille analytique fine, réseau de particules douces, courbe de progression fluide
 *   et repères académiques discrets en flottement très lent.
 */
export const TeacherAnimatedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;
    let startTime = performance.now();

    interface DriftNode {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      phase: number;
      tint: 'cyan' | 'teal' | 'sky' | 'amber';
    }

    let nodes: DriftNode[] = [];

    const initNodes = (w: number, h: number) => {
      const count = Math.min(44, Math.max(22, Math.floor((w * h) / 34000)));
      const tints: DriftNode['tint'][] = ['cyan', 'teal', 'sky', 'cyan', 'amber'];
      nodes = Array.from({ length: count }, (_, idx) => {
        // Mouvement volontairement très doux et lent
        const angle = (idx * 2.39996) % (Math.PI * 2);
        const speed = 0.08 + ((idx * 17) % 10) * 0.014;
        return {
          x: ((idx * 197.3) % 1000) / 1000 * w,
          y: ((idx * 353.7) % 1000) / 1000 * h,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 1.3 + ((idx * 13) % 10) * 0.16,
          phase: idx * 0.7,
          tint: tints[idx % tints.length],
        };
      });
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = parent.clientWidth || window.innerWidth;
      height = parent.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nodes.length === 0) initNodes(width, height);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const getTintRgba = (tint: DriftNode['tint'], alpha: number) => {
      switch (tint) {
        case 'cyan':
          return `rgba(56, 189, 248, ${alpha})`;
        case 'teal':
          return `rgba(45, 212, 191, ${alpha})`;
        case 'sky':
          return `rgba(125, 211, 252, ${alpha})`;
        case 'amber':
          return `rgba(251, 191, 36, ${alpha})`;
      }
    };

    const drawFrame = (now: number) => {
      const t = (now - startTime) * 0.001; // secondes écoulées

      ctx.clearRect(0, 0, width, height);

      // 1. Halo lumineux lent et fluide (3 nappes douces sans aucune saccade)
      const orb1X = width * (0.22 + Math.sin(t * 0.14) * 0.06);
      const orb1Y = height * (0.28 + Math.cos(t * 0.11) * 0.06);
      const g1 = ctx.createRadialGradient(orb1X, orb1Y, 0, orb1X, orb1Y, Math.max(width, height) * 0.48);
      g1.addColorStop(0, 'rgba(14, 165, 233, 0.15)');
      g1.addColorStop(0.55, 'rgba(6, 182, 212, 0.06)');
      g1.addColorStop(1, 'rgba(6, 24, 38, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, width, height);

      const orb2X = width * (0.78 + Math.cos(t * 0.12) * 0.06);
      const orb2Y = height * (0.68 + Math.sin(t * 0.10) * 0.07);
      const g2 = ctx.createRadialGradient(orb2X, orb2Y, 0, orb2X, orb2Y, Math.max(width, height) * 0.50);
      g2.addColorStop(0, 'rgba(20, 184, 166, 0.14)');
      g2.addColorStop(0.5, 'rgba(59, 130, 246, 0.05)');
      g2.addColorStop(1, 'rgba(6, 24, 38, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, height);

      const orb3X = width * (0.52 + Math.sin(t * 0.09 + 1.8) * 0.08);
      const orb3Y = height * (0.88 + Math.cos(t * 0.08) * 0.04);
      const g3 = ctx.createRadialGradient(orb3X, orb3Y, 0, orb3X, orb3Y, Math.max(width, height) * 0.36);
      g3.addColorStop(0, 'rgba(56, 189, 248, 0.09)');
      g3.addColorStop(1, 'rgba(6, 24, 38, 0)');
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, width, height);

      // 2. Courbes analytiques douces en bas (évoquent l'évolution des moyennes, mouvement très lent)
      const drawSmoothWave = (
        baseYRatio: number,
        amp: number,
        freq: number,
        speed: number,
        strokeColor: string,
        fillTop: string
      ) => {
        ctx.beginPath();
        const baseY = height * baseYRatio;
        const step = Math.max(24, width / 40);
        for (let x = 0; x <= width + step; x += step) {
          const nx = x / Math.max(1, width);
          const trendLift = -nx * height * 0.045; // légère montée harmonieuse vers la droite
          const y =
            baseY +
            trendLift +
            Math.sin(nx * Math.PI * freq + t * speed) * amp +
            Math.cos(nx * Math.PI * (freq * 0.55) - t * (speed * 0.65)) * (amp * 0.45);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.lineTo(width + step, height + 10);
        ctx.lineTo(0, height + 10);
        ctx.closePath();
        const fillGrad = ctx.createLinearGradient(0, baseY - amp - 40, 0, height);
        fillGrad.addColorStop(0, fillTop);
        fillGrad.addColorStop(1, 'rgba(6, 24, 38, 0)');
        ctx.fillStyle = fillGrad;
        ctx.fill();
      };

      drawSmoothWave(0.84, 14, 2.2, 0.24, 'rgba(56, 189, 248, 0.19)', 'rgba(14, 165, 233, 0.065)');
      drawSmoothWave(0.89, 10, 1.8, -0.18, 'rgba(45, 212, 191, 0.16)', 'rgba(20, 184, 166, 0.05)');

      // 3. Constellation douce de particules & filaments très fins
      const maxDist = 145;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!prefersReducedMotion) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < -20) n.x = width + 20;
          if (n.x > width + 20) n.x = -20;
          if (n.y < -20) n.y = height + 20;
          if (n.y > height + 20) n.y = -20;
        }
      }

      ctx.lineWidth = 0.7;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < maxDist * maxDist) {
            const alpha = (1 - Math.sqrt(distSq) / maxDist) * 0.12;
            ctx.strokeStyle = `rgba(125, 211, 252, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const pulse = 0.55 + 0.35 * Math.sin(t * 0.7 + n.phase);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = getTintRgba(n.tint, pulse * 0.65);
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };

    const start = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(drawFrame);
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
      } else {
        startTime = performance.now() - 1000;
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0"
      style={{
        background:
          'radial-gradient(ellipse 85% 70% at 15% 15%, #0c3547 0%, #071e2e 45%, #051220 100%)',
      }}
    >
      {/* Keyframes locales lentes et fluides (aucune saccade, respiration calme) */}
      <style>{`
        @keyframes scTeacherFloatSlow {
          0%, 100% { transform: translate3d(0, 0px, 0); }
          50% { transform: translate3d(0, -10px, 0); }
        }
        @keyframes scTeacherFloatSlowAlt {
          0%, 100% { transform: translate3d(0, 0px, 0); }
          50% { transform: translate3d(0, 9px, 0); }
        }
        @keyframes scTeacherBarBreath1 {
          0%, 100% { transform: scaleY(0.78); }
          50% { transform: scaleY(1); }
        }
        @keyframes scTeacherBarBreath2 {
          0%, 100% { transform: scaleY(0.86); }
          50% { transform: scaleY(1); }
        }
        @keyframes scTeacherRingSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Grille analytique fine (rappel élégant d'un cahier de notes / tableur) */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(125, 211, 252, 0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(125, 211, 252, 0.22) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 80% 75% at 50% 48%, rgba(0,0,0,0.95) 20%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 75% at 50% 48%, rgba(0,0,0,0.95) 20%, transparent 100%)',
        }}
      />

      {/* Canvas 60 FPS : nappes lumineuses lentes, courbes de moyennes douces et constellation */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Anneaux orbitaux discrets en arrière-plan (rotation ultra-lente 60s) */}
      <div className="hidden lg:block absolute -right-28 -bottom-28 w-[420px] h-[420px] opacity-[0.16]">
        <svg
          viewBox="0 0 300 300"
          className="w-full h-full"
          style={{ animation: 'scTeacherRingSpin 75s linear infinite' }}
        >
          <circle cx="150" cy="150" r="130" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="6 10" />
          <circle cx="150" cy="150" r="95" fill="none" stroke="#2dd4bf" strokeWidth="0.9" strokeDasharray="3 12" />
        </svg>
      </div>

      {/* Élément flottant périphérique gauche : Repère pédagogique Moyenne / 20 (mouvement très doux) */}
      <div
        className="hidden md:flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/[0.06] border border-cyan-300/20 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.22)] absolute left-8 bottom-16 opacity-80"
        style={{ animation: 'scTeacherFloatSlow 11s ease-in-out infinite' }}
      >
        <div className="w-8 h-8 rounded-xl bg-cyan-400/15 border border-cyan-300/30 flex items-center justify-center text-cyan-200 font-mono font-black text-xs">
          /20
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200/80">
            Calcul de moyenne
          </span>
          <span className="text-xs font-extrabold text-white/90 font-mono">
            Coefficients &bull; Rangs &bull; Mentions
          </span>
        </div>
      </div>

      {/* Élément flottant périphérique droit : Mini graphique de progression vectoriel net (respiration lente) */}
      <div
        className="hidden md:flex items-end gap-3 px-3.5 py-2.5 rounded-2xl bg-white/[0.06] border border-teal-300/20 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.22)] absolute right-8 bottom-16 opacity-80"
        style={{ animation: 'scTeacherFloatSlowAlt 13s ease-in-out infinite' }}
      >
        <div className="flex items-end gap-1.5 h-8">
          <span
            className="w-2 h-3.5 rounded-t bg-cyan-400/75 origin-bottom"
            style={{ animation: 'scTeacherBarBreath1 7s ease-in-out infinite' }}
          />
          <span
            className="w-2 h-5 rounded-t bg-sky-400/80 origin-bottom"
            style={{ animation: 'scTeacherBarBreath2 8.5s ease-in-out infinite 0.8s' }}
          />
          <span
            className="w-2 h-6 rounded-t bg-teal-400/85 origin-bottom"
            style={{ animation: 'scTeacherBarBreath1 9.5s ease-in-out infinite 1.4s' }}
          />
          <span
            className="w-2 h-8 rounded-t bg-emerald-400/90 origin-bottom"
            style={{ animation: 'scTeacherBarBreath2 10.5s ease-in-out infinite 2s' }}
          />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-200/80">
            Suivi scolaire
          </span>
          <span className="text-xs font-extrabold text-white/90">
            Trimestres &amp; Bilans
          </span>
        </div>
      </div>

      {/* Voile supérieur léger uniquement sur l'en-tête pour une lisibilité irréprochable */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#04101c]/55 to-transparent" />
    </div>
  );
};
