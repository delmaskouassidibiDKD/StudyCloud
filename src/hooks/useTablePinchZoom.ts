import { useEffect, useRef } from 'react';

interface UseTablePinchZoomOptions {
  min?: number;
  max?: number;
  onZoomChange?: (nextZoom: number) => void;
  onPinchStart?: () => void;
}

/**
 * Active le zoom fluide à deux doigts (pinch-to-zoom) sur un conteneur défilable de tableur,
 * tout en préservant le défilement normal à un doigt et en gardant le point pincé centré.
 */
export function useTablePinchZoom(
  containerRef: React.RefObject<HTMLElement | null>,
  zoomPercent: number,
  setZoomPercent: (next: number) => void,
  options?: UseTablePinchZoomOptions
): void {
  const min = options?.min ?? 30;
  const max = options?.max ?? 200;

  const zoomRef = useRef(zoomPercent);
  zoomRef.current = zoomPercent;

  const setZoomRef = useRef(setZoomPercent);
  setZoomRef.current = setZoomPercent;

  const onZoomChangeRef = useRef(options?.onZoomChange);
  onZoomChangeRef.current = options?.onZoomChange;

  const onPinchStartRef = useRef(options?.onPinchStart);
  onPinchStartRef.current = options?.onPinchStart;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let pinchActive = false;
    let startDist = 0;
    let startZoom = 70;
    let lastAppliedZoom = 70;
    let startContentX = 0;
    let startContentY = 0;

    const getTouchDist = (t1: Touch, t2: Touch) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = getTouchDist(t1, t2);
        if (dist < 10) return;

        pinchActive = true;
        startDist = dist;
        startZoom = zoomRef.current;
        lastAppliedZoom = startZoom;

        const rect = el.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
        const scale = Math.max(0.2, startZoom / 100);
        startContentX = (el.scrollLeft + midX) / scale;
        startContentY = (el.scrollTop + midY) / scale;

        onPinchStartRef.current?.();
      } else if (e.touches.length > 2) {
        pinchActive = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pinchActive || e.touches.length !== 2) return;
      e.preventDefault();

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const curDist = getTouchDist(t1, t2);
      if (startDist <= 0 || curDist <= 0) return;

      const rawZoom = startZoom * (curDist / startDist);
      const nextZoom = Math.max(min, Math.min(max, Math.round(rawZoom)));

      if (nextZoom !== lastAppliedZoom) {
        lastAppliedZoom = nextZoom;
        zoomRef.current = nextZoom;
        setZoomRef.current(nextZoom);
        onZoomChangeRef.current?.(nextZoom);

        const rect = el.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
        const nextScale = nextZoom / 100;
        const targetScrollLeft = Math.max(0, startContentX * nextScale - midX);
        const targetScrollTop = Math.max(0, startContentY * nextScale - midY);
        requestAnimationFrame(() => {
          el.scrollLeft = targetScrollLeft;
          el.scrollTop = targetScrollTop;
        });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchActive = false;
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [containerRef, min, max]);
}
