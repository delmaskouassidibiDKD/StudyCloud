import React, { useEffect, useRef } from 'react';

/**
 * Fond animé 3D isométrique doux et continu (nouveau modèle 3D ultra-propre sans artefacts) :
 * - Scène 3D haute netteté (bureau lumineux sur socle néon, 20/20, calculatrice, chapeau, graphique)
 *   animée par un mouvement lent, fluide et continu (respiration douce sans coupure de boucle).
 * - Halos néon respirants harmonisés avec la scène + poussières lumineuses bokeh montant doucement (Canvas 60 FPS).
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
    const startTime = performance.now();

    interface Sparkle {
      x: number;
      y: number;
      vy: number;
      swayAmp: number;
      swayFreq: number;
      r: number;
      phase: number;
      color: string;
      maxAlpha: number;
    }

    let sparkles: Sparkle[] = [];

    const initSparkles = (w: number, h: number) => {
      const palette = [
        '56, 189, 248',  // cyan néon
        '129, 140, 248', // violet doux
        '251, 191, 36',  // or chaud (médaille / lampe)
        '45, 212, 191',  // turquoise
        '251, 146, 60',  // corail lumineux (graphique)
      ];
      const count = Math.min(48, Math.max(24, Math.floor((w * h) / 30000)));
      sparkles = Array.from({ length: count }, (_, i) => ({
        x: (((i * 223.7) % 1000) / 1000) * w,
        y: (((i * 389.1) % 1000) / 1000) * h,
        // Montée très douce et apaisante
        vy: 0.14 + ((i * 19) % 10) * 0.022,
        swayAmp: 0.18 + ((i * 11) % 6) * 0.04,
        swayFreq: 0.35 + ((i * 7) % 5) * 0.09,
        r: 1.2 + ((i * 13) % 9) * 0.24,
        phase: i * 1.17,
        color: palette[i % palette.length],
        maxAlpha: 0.38 + ((i * 29) % 10) * 0.045,
      }));
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
      if (sparkles.length === 0) initSparkles(width, height);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const drawFrame = (now: number) => {
      const t = (now - startTime) * 0.001;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < sparkles.length; i++) {
        const s = sparkles[i];
        if (!prefersReducedMotion) {
          s.y -= s.vy;
          s.x += Math.sin(t * s.swayFreq + s.phase) * s.swayAmp;
          if (s.y < -14) {
            s.y = height + 14;
            s.x = ((s.x + width * 0.13) % Math.max(1, width));
          }
        }
        const twinkle = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(t * 0.95 + s.phase));
        const alpha = s.maxAlpha * twinkle;

        // Doux halo bokeh autour de chaque particule lumineuse
        const haloR = s.r * 3.4;
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, haloR);
        grad.addColorStop(0, `rgba(${s.color}, ${(alpha * 0.95).toFixed(3)})`);
        grad.addColorStop(0.45, `rgba(${s.color}, ${(alpha * 0.32).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${s.color}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, haloR, 0, Math.PI * 2);
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
          'radial-gradient(ellipse 85% 75% at 50% 55%, #091833 0%, #061024 55%, #040b18 100%)',
      }}
    >
      <style>{`
        @keyframes sc3dSceneGentleBreath {
          0%, 100% {
            transform: scale(0.96) translate3d(0px, 0px, 0);
          }
          33% {
            transform: scale(0.99) translate3d(-5px, -4px, 0);
          }
          66% {
            transform: scale(0.978) translate3d(5px, 3px, 0);
          }
        }
        @keyframes sc3dHaloPulse {
          0%, 100% { opacity: 0.22; transform: scale(0.97); }
          50% { opacity: 0.42; transform: scale(1.03); }
        }
        @keyframes sc3dAccentGlow {
          0%, 100% { opacity: 0.14; }
          50% { opacity: 0.30; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sc-3d-gentle-motion { animation: none !important; }
        }
      `}</style>

      {/* Scène 3D isométrique bien proportionnée (dézoomée, entièrement visible, fondue sans bordure dans le fond nuit) */}
      <div className="absolute inset-0 flex items-center justify-center pt-6 pb-2 px-4 sm:px-8">
        <img
          src="/assets/teacher-bg-3d-scene.jpg"
          alt=""
          decoding="async"
          className="sc-3d-gentle-motion w-full h-full max-w-[960px] max-h-[82vh] object-contain object-center will-change-transform"
          style={{
            animation: 'sc3dSceneGentleBreath 26s ease-in-out infinite',
            filter: 'brightness(1.05) contrast(1.04) saturate(1.08)',
            maskImage:
              'radial-gradient(ellipse 90% 88% at 50% 52%, rgba(0,0,0,1) 64%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 90% 88% at 50% 52%, rgba(0,0,0,1) 64%, rgba(0,0,0,0) 100%)',
          }}
        />
      </div>

      {/* Respiration lumineuse douce du socle néon central */}
      <div
        className="sc-3d-gentle-motion absolute left-1/2 bottom-[6%] -translate-x-1/2 w-[56%] h-[36%] rounded-full blur-3xl mix-blend-screen"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(56, 189, 248, 0.45) 0%, rgba(129, 140, 248, 0.28) 45%, transparent 75%)',
          animation: 'sc3dHaloPulse 9s ease-in-out infinite',
        }}
      />

      {/* Lueur douce sur le coin gauche (20/20 & calculatrice) */}
      <div
        className="sc-3d-gentle-motion absolute left-[6%] top-[36%] w-[26%] h-[34%] rounded-full blur-3xl mix-blend-screen"
        style={{
          background:
            'radial-gradient(circle, rgba(251, 191, 36, 0.36) 0%, rgba(56, 189, 248, 0.18) 55%, transparent 78%)',
          animation: 'sc3dAccentGlow 11s ease-in-out infinite 1.5s',
        }}
      />

      {/* Lueur douce sur le coin droit (chapeau & graphique) */}
      <div
        className="sc-3d-gentle-motion absolute right-[5%] top-[34%] w-[28%] h-[38%] rounded-full blur-3xl mix-blend-screen"
        style={{
          background:
            'radial-gradient(circle, rgba(45, 212, 191, 0.36) 0%, rgba(251, 146, 60, 0.22) 52%, transparent 78%)',
          animation: 'sc3dAccentGlow 12s ease-in-out infinite 3.5s',
        }}
      />

      {/* Poussières lumineuses bokeh montant lentement en 60 FPS */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Léger voile uniquement tout en haut pour une lisibilité parfaite du bandeau */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#060f22]/55 to-transparent" />
    </div>
  );
};
