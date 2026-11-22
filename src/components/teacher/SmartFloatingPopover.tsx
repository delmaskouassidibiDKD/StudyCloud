import React, { useLayoutEffect, useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

export type PopoverPlacement =
  | 'bottom-start'
  | 'bottom-end'
  | 'bottom-center'
  | 'top-start'
  | 'top-end'
  | 'top-center'
  | 'right-start'
  | 'left-start';

export interface SmartFloatingPopoverProps {
  /** Whether the popover is visible */
  open: boolean;
  /** The trigger DOM element to anchor to */
  anchorEl: HTMLElement | null;
  /** Optional fallback DOMRect when anchorEl is unavailable */
  fallbackRect?: DOMRect | null;
  /** Optional workspace boundary element (e.g. <main>) so popover avoids sidebars and top chrome */
  boundaryEl?: HTMLElement | null;
  /** Optional compact pill/header obstacle to keep clear of (auto-detected via [data-popover-avoid] if omitted) */
  avoidEl?: HTMLElement | null;
  /** Preferred opening direction (auto-flips when blocked by edges or obstacles) */
  preferredSide?: 'bottom' | 'top' | 'right' | 'left';
  /** Preferred horizontal alignment relative to trigger */
  preferredAlign?: 'start' | 'end' | 'center';
  /** Gap in pixels between trigger/pill and popover */
  gap?: number;
  /** Safe margin inside boundary & viewport */
  padding?: number;
  /** Render a crisp directional pointer caret pointing back to the trigger */
  showCaret?: boolean;
  /** Scroll behavior: 'reposition' follows trigger smoothly, 'close' closes immediately */
  scrollBehavior?: 'reposition' | 'close';
  /** Callback to close popover on outside click, Escape, or trigger leaving view */
  onClose?: () => void;
  /** Disable internal outside-click listener if caller uses a custom backdrop */
  disableOutsideClick?: boolean;
  /** CSS selector for elements whose clicks should NOT trigger outside-click close */
  ignoreOutsideSelector?: string;
  /** Z-index for portal layer (default 99999 — above all sidebars, sticky headers & modals) */
  zIndex?: number;
  /** Additional classes on the floating surface */
  className?: string;
  /** Additional inline styles on the floating surface */
  style?: React.CSSProperties;
  /** Data attribute for styling/debugging */
  dataPopoverId?: string;
  children: React.ReactNode;
}

interface RectBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface ComputedPosition {
  left: number;
  top: number;
  maxHeight: number;
  maxWidth: number;
  placement: PopoverPlacement;
  caretSide: 'top' | 'bottom' | 'left' | 'right' | null;
  caretOffset: number;
  ready: boolean;
}

function toRectBox(r: DOMRect): RectBox {
  return {
    left: r.left,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
  };
}

function intersectionArea(a: RectBox, b: RectBox): number {
  const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return xOverlap * yOverlap;
}

function clamp(val: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(val, min), max);
}

/**
 * Compute optimal obstacle-aware popover coordinates inside safe workspace bounds.
 * Guarantees the floating panel:
 * 1. Never enters left/right sidebars, top navigation bars, or mobile bottom bars.
 * 2. Never clips outside viewport or workspace edges.
 * 3. Avoids covering its trigger button and compact parent pills/badges.
 * 4. Automatically flips vertically (bottom <-> top), horizontally (start <-> end),
 *    or moves to the side (right / left) when space is tight.
 */
export function computeSmartPopoverPosition(params: {
  anchor: RectBox;
  avoid: RectBox | null;
  safe: RectBox;
  popW: number;
  popH: number;
  preferredSide: 'bottom' | 'top' | 'right' | 'left';
  preferredAlign: 'start' | 'end' | 'center';
  gap: number;
  extraObstacles?: RectBox[];
}): ComputedPosition {
  const {
    anchor,
    avoid,
    safe,
    popW,
    popH,
    preferredSide,
    preferredAlign,
    gap,
    extraObstacles = [],
  } = params;

  const availW = Math.max(160, safe.right - safe.left);
  const availH = Math.max(110, safe.bottom - safe.top);
  const effW = Math.min(popW, availW);
  const effH = Math.min(popH, availH);

  // If the trigger lives inside a compact pill/chip (<= 68px tall), clear the whole pill vertically
  // so the menu never overlaps its label or luminous glow.
  const isCompactAvoid = Boolean(avoid && avoid.height > 0 && avoid.height <= 68);
  const vTopEdge = isCompactAvoid && avoid ? Math.min(anchor.top, avoid.top) : anchor.top;
  const vBottomEdge = isCompactAvoid && avoid ? Math.max(anchor.bottom, avoid.bottom) : anchor.bottom;

  const anchorCenterX = anchor.left + anchor.width / 2;
  const anchorCenterY = anchor.top + anchor.height / 2;

  const xStart = anchor.left;
  const xEnd = anchor.right - effW;
  const xCenter = anchorCenterX - effW / 2;

  const yBottom = vBottomEdge + gap;
  const yTop = vTopEdge - effH - gap;

  // Side placements (fallback when neither below nor above fits cleanly)
  const sideRightLeft = (isCompactAvoid && avoid ? Math.max(anchor.right, avoid.right) : anchor.right) + gap;
  const sideLeftLeft = (isCompactAvoid && avoid ? Math.min(anchor.left, avoid.left) : anchor.left) - effW - gap;
  const sideTop = clamp(anchor.top - 4, safe.top, safe.bottom - effH);

  const candidates: Array<{ placement: PopoverPlacement; left: number; top: number; prefOrder: number }> = [
    { placement: 'bottom-start', left: xStart, top: yBottom, prefOrder: 0 },
    { placement: 'bottom-end', left: xEnd, top: yBottom, prefOrder: 1 },
    { placement: 'bottom-center', left: xCenter, top: yBottom, prefOrder: 2 },
    { placement: 'top-start', left: xStart, top: yTop, prefOrder: 3 },
    { placement: 'top-end', left: xEnd, top: yTop, prefOrder: 4 },
    { placement: 'top-center', left: xCenter, top: yTop, prefOrder: 5 },
    { placement: 'right-start', left: sideRightLeft, top: sideTop, prefOrder: 6 },
    { placement: 'left-start', left: sideLeftLeft, top: sideTop, prefOrder: 7 },
  ];

  let bestCandidate = candidates[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const cand of candidates) {
    const box: RectBox = {
      left: cand.left,
      top: cand.top,
      right: cand.left + effW,
      bottom: cand.top + effH,
      width: effW,
      height: effH,
    };

    // 1. Hard boundary overflow penalty (sidebar, topbar, viewport edges)
    const overLeft = Math.max(0, safe.left - box.left);
    const overRight = Math.max(0, box.right - safe.right);
    const overTop = Math.max(0, safe.top - box.top);
    const overBottom = Math.max(0, box.bottom - safe.bottom);
    const overflowPx = overLeft + overRight + overTop + overBottom;

    // 2. Overlap with the trigger button itself (must avoid)
    const triggerOverlap = intersectionArea(box, anchor);

    // 3. Overlap with compact parent pill/badge (strongly prefer zero overlap)
    const avoidOverlap = isCompactAvoid && avoid ? intersectionArea(box, avoid) : 0;

    // 4. Overlap with any additional DOM obstacles (e.g. sticky headers)
    let obstacleOverlap = 0;
    for (const obs of extraObstacles) {
      obstacleOverlap += intersectionArea(box, obs);
    }

    // 5. Preference bias (tiny tie-breaker when candidates fit equally well)
    let prefPenalty = 0;
    const isTop = cand.placement.startsWith('top');
    const isBottom = cand.placement.startsWith('bottom');
    const isRight = cand.placement.startsWith('right');
    const isLeft = cand.placement.startsWith('left');
    const isSide = isRight || isLeft;

    if (preferredSide === 'right') {
      if (isRight) prefPenalty += 0;
      else if (isBottom) prefPenalty += 16;
      else if (isTop) prefPenalty += 24;
      else if (isLeft) prefPenalty += 32;
    } else if (preferredSide === 'left') {
      if (isLeft) prefPenalty += 0;
      else if (isBottom) prefPenalty += 16;
      else if (isTop) prefPenalty += 24;
      else if (isRight) prefPenalty += 32;
    } else if (isSide) {
      prefPenalty += 45;
    } else if ((preferredSide === 'bottom' && isTop) || (preferredSide === 'top' && isBottom)) {
      prefPenalty += 18;
    }

    if (preferredAlign === 'start') {
      if (cand.placement.endsWith('end')) prefPenalty += 8;
      if (cand.placement.endsWith('center')) prefPenalty += 12;
    } else if (preferredAlign === 'end') {
      if (cand.placement.endsWith('start')) prefPenalty += 8;
      if (cand.placement.endsWith('center')) prefPenalty += 12;
    } else if (preferredAlign === 'center') {
      if (!cand.placement.endsWith('center')) prefPenalty += 8;
    }

    const totalScore =
      overflowPx * 10000 +
      triggerOverlap * 400 +
      avoidOverlap * 12 +
      obstacleOverlap * 4 +
      prefPenalty;

    if (totalScore < bestScore) {
      bestScore = totalScore;
      bestCandidate = cand;
    }
  }

  // Final hard clamp inside safe workspace bounds so clipping is mathematically impossible
  const finalLeft = Math.round(clamp(bestCandidate.left, safe.left, Math.max(safe.left, safe.right - effW)));
  const finalTop = Math.round(clamp(bestCandidate.top, safe.top, Math.max(safe.top, safe.bottom - effH)));

  // Determine directional caret side & offset pointing accurately at the trigger
  let caretSide: 'top' | 'bottom' | 'left' | 'right' | null = null;
  let caretOffset = 0;

  if (bestCandidate.placement.startsWith('bottom') && finalTop >= anchor.bottom - 2) {
    if (anchorCenterX >= finalLeft - 4 && anchorCenterX <= finalLeft + effW + 4) {
      caretSide = 'top';
      caretOffset = Math.round(clamp(anchorCenterX - finalLeft, 14, Math.max(14, effW - 14)));
    }
  } else if (bestCandidate.placement.startsWith('top') && finalTop + effH <= anchor.top + 2) {
    if (anchorCenterX >= finalLeft - 4 && anchorCenterX <= finalLeft + effW + 4) {
      caretSide = 'bottom';
      caretOffset = Math.round(clamp(anchorCenterX - finalLeft, 14, Math.max(14, effW - 14)));
    }
  } else if (bestCandidate.placement === 'right-start' && finalLeft >= anchor.right - 2) {
    if (anchorCenterY >= finalTop - 4 && anchorCenterY <= finalTop + effH + 4) {
      caretSide = 'left';
      caretOffset = Math.round(clamp(anchorCenterY - finalTop, 14, Math.max(14, effH - 14)));
    }
  } else if (bestCandidate.placement === 'left-start' && finalLeft + effW <= anchor.left + 2) {
    if (anchorCenterY >= finalTop - 4 && anchorCenterY <= finalTop + effH + 4) {
      caretSide = 'right';
      caretOffset = Math.round(clamp(anchorCenterY - finalTop, 14, Math.max(14, effH - 14)));
    }
  }

  return {
    left: finalLeft,
    top: finalTop,
    maxHeight: Math.round(availH),
    maxWidth: Math.round(availW),
    placement: bestCandidate.placement,
    caretSide,
    caretOffset,
    ready: true,
  };
}

export const SmartFloatingPopover: React.FC<SmartFloatingPopoverProps> = ({
  open,
  anchorEl,
  fallbackRect = null,
  boundaryEl = null,
  avoidEl = null,
  preferredSide = 'bottom',
  preferredAlign = 'start',
  gap = 8,
  padding = 12,
  showCaret = true,
  scrollBehavior = 'reposition',
  onClose,
  disableOutsideClick = false,
  ignoreOutsideSelector,
  zIndex = 99999,
  className = '',
  style,
  dataPopoverId,
  children,
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [pos, setPos] = useState<ComputedPosition>({
    left: -9999,
    top: -9999,
    maxHeight: 500,
    maxWidth: 360,
    placement: 'bottom-start',
    caretSide: null,
    caretOffset: 18,
    ready: false,
  });

  const updatePosition = useCallback(() => {
    const popEl = popoverRef.current;
    if (!popEl) return;

    const liveAnchorRect =
      anchorEl && document.body.contains(anchorEl)
        ? anchorEl.getBoundingClientRect()
        : fallbackRect;

    if (!liveAnchorRect || (liveAnchorRect.width === 0 && liveAnchorRect.height === 0)) {
      if (onClose) onClose();
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Leave clearance for mobile bottom bar when viewport is narrow
    const bottomChromePadding = vw < 768 ? Math.max(padding, 74) : padding;

    const popRect = popEl.getBoundingClientRect();
    const popW = Math.max(popRect.width, popEl.offsetWidth, 160);
    const popH = Math.max(popRect.height, popEl.offsetHeight, 60);

    // Compute safe workspace rectangle (excluding sidebars & top bar)
    let safeLeft = padding;
    let safeRight = vw - padding;
    let safeTop = padding;
    let safeBottom = vh - bottomChromePadding;

    if (boundaryEl && document.body.contains(boundaryEl)) {
      const b = boundaryEl.getBoundingClientRect();
      const bLeft = Math.max(padding, b.left + padding);
      const bRight = Math.min(vw - padding, b.right - padding);
      const bTop = Math.max(padding, b.top + padding);
      const bBottom = Math.min(vh - bottomChromePadding, b.bottom - padding);

      // Only constrain horizontally/vertically by boundary when boundary can fit the popover
      if (bRight - bLeft >= Math.min(popW, 200)) {
        safeLeft = bLeft;
        safeRight = bRight;
      }
      if (bBottom - bTop >= Math.min(popH, 120)) {
        safeTop = bTop;
        safeBottom = bBottom;
      }

      // Auto-close if anchor scrolled completely outside visible workspace
      if (
        scrollBehavior === 'reposition' &&
        (liveAnchorRect.bottom < b.top - 4 ||
          liveAnchorRect.top > b.bottom + 4 ||
          liveAnchorRect.right < b.left - 4 ||
          liveAnchorRect.left > b.right + 4)
      ) {
        if (onClose) onClose();
        return;
      }
    }

    const resolvedAvoidEl =
      avoidEl || (anchorEl?.closest('[data-popover-avoid="true"]') as HTMLElement | null) || null;
    const avoidRect =
      resolvedAvoidEl && document.body.contains(resolvedAvoidEl)
        ? toRectBox(resolvedAvoidEl.getBoundingClientRect())
        : null;

    const next = computeSmartPopoverPosition({
      anchor: toRectBox(liveAnchorRect),
      avoid: avoidRect,
      safe: {
        left: safeLeft,
        top: safeTop,
        right: safeRight,
        bottom: safeBottom,
        width: safeRight - safeLeft,
        height: safeBottom - safeTop,
      },
      popW,
      popH,
      preferredSide,
      preferredAlign,
      gap,
    });

    setPos((prev) => {
      if (
        prev.ready === next.ready &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.maxHeight === next.maxHeight &&
        prev.maxWidth === next.maxWidth &&
        prev.placement === next.placement &&
        prev.caretSide === next.caretSide &&
        prev.caretOffset === next.caretOffset
      ) {
        return prev;
      }
      return next;
    });
  }, [
    anchorEl,
    fallbackRect,
    boundaryEl,
    avoidEl,
    preferredSide,
    preferredAlign,
    gap,
    padding,
    scrollBehavior,
    onClose,
  ]);

  // Synchronous layout measurement before browser paint (eliminates flicker/jump)
  useLayoutEffect(() => {
    if (!open) {
      setPos((prev) => (prev.ready ? { ...prev, ready: false } : prev));
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  // Track dynamic content resizing (e.g. expanding nested color palettes) + window resize + scroll
  useEffect(() => {
    if (!open) return;

    const scheduleUpdate = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updatePosition();
      });
    };

    const handleScroll = (event: Event) => {
      // Ignore scrolling inside the popover itself
      if (popoverRef.current && event.target instanceof Node && popoverRef.current.contains(event.target)) {
        return;
      }
      if (scrollBehavior === 'close') {
        if (onClose) onClose();
      } else {
        scheduleUpdate();
      }
    };

    const handleResize = () => scheduleUpdate();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && popoverRef.current) {
      resizeObserver = new ResizeObserver(() => scheduleUpdate());
      resizeObserver.observe(popoverRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      if (resizeObserver) resizeObserver.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [open, scrollBehavior, onClose, updatePosition]);

  // Outside click & Escape handling
  useEffect(() => {
    if (!open || !onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      if (disableOutsideClick) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      if (anchorEl && anchorEl.contains(target)) return;
      if (ignoreOutsideSelector && target.closest(ignoreOutsideSelector)) return;
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    if (!disableOutsideClick) {
      document.addEventListener('mousedown', handlePointerDown, true);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (!disableOutsideClick) {
        document.removeEventListener('mousedown', handlePointerDown, true);
      }
    };
  }, [open, onClose, disableOutsideClick, anchorEl, ignoreOutsideSelector]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={popoverRef}
      data-smart-popover="true"
      data-popover-id={dataPopoverId}
      data-placement={pos.placement}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        zIndex,
        maxHeight: `${pos.maxHeight}px`,
        maxWidth: `${pos.maxWidth}px`,
        visibility: pos.ready ? 'visible' : 'hidden',
        opacity: pos.ready ? 1 : 0,
        transition: pos.ready ? 'opacity 110ms ease-out' : 'none',
        boxShadow:
          '0 22px 50px -10px rgba(2, 12, 27, 0.50), 0 8px 20px -4px rgba(2, 12, 27, 0.24), 0 0 0 1px rgba(15, 23, 42, 0.14)',
        ...style,
      }}
      className={`teacher-dark-scope bg-white dark:bg-[#111827] rounded-xl border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 select-none ${className}`}
    >
      {/* Subtle directional caret pointing back to the trigger */}
      {showCaret && pos.ready && pos.caretSide === 'top' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-[6px] w-2.5 h-2.5 bg-white dark:bg-[#111827] border-l border-t border-slate-300 dark:border-slate-600 rotate-45"
          style={{ left: `${pos.caretOffset - 5}px` }}
        />
      )}
      {showCaret && pos.ready && pos.caretSide === 'bottom' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[6px] w-2.5 h-2.5 bg-white dark:bg-[#111827] border-r border-b border-slate-300 dark:border-slate-600 rotate-45"
          style={{ left: `${pos.caretOffset - 5}px` }}
        />
      )}
      {showCaret && pos.ready && pos.caretSide === 'left' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-[6px] w-2.5 h-2.5 bg-white dark:bg-[#111827] border-l border-b border-slate-300 dark:border-slate-600 rotate-45"
          style={{ top: `${pos.caretOffset - 5}px` }}
        />
      )}
      {showCaret && pos.ready && pos.caretSide === 'right' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-[6px] w-2.5 h-2.5 bg-white dark:bg-[#111827] border-r border-t border-slate-300 dark:border-slate-600 rotate-45"
          style={{ top: `${pos.caretOffset - 5}px` }}
        />
      )}

      {/* Inner scroll-safe wrapper sitting cleanly above the caret */}
      <div
        className="relative z-10 overflow-y-auto overflow-x-hidden rounded-xl"
        style={{ maxHeight: `${Math.max(90, pos.maxHeight - 2)}px` }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
