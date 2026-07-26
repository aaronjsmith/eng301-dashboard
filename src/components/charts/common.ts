import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Shared chart plumbing. Semantic zoom is tier-conditional COMPOSITION:
 * marks and type sizes are constants here; a bigger tier adds marks and
 * labels, never scales them (spec §4).
 */

/** Fixed type scale — never grows with the box. */
export const CHART_FONT = {
  label: 11,
  value: 11.5,
  axis: 10.5,
  heroS: 26,
  heroM: 30,
} as const;

export const MARK = {
  barMax: 24, // bars never thicker than this (dataviz mark spec)
  line: 2,
  gap: 2, // surface gap between touching fills
  radius: 4, // rounded data-end
} as const;

/** Measure the rendered width of a chart host (constant font discipline). */
export function useMeasuredWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/** Clean axis ticks: 0 → a rounded max in `count` steps. */
export function niceTicks(maxValue: number, count = 4): number[] {
  if (maxValue <= 0) return [0];
  const rough = maxValue / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const step =
    (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;
  const ticks: number[] = [];
  for (let v = 0; v <= maxValue + step * 0.001; v += step) ticks.push(v);
  return ticks;
}

/** Truncate a category label to fit tight tiers. */
export function shortLabel(label: string, max = 9): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export interface TooltipState {
  x: number;
  y: number;
  lines: string[];
}

/** L-tier hover tooltips (enhance, never gate — values exist in the table). */
export function useTooltip() {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const show = (evt: { clientX: number; clientY: number }, lines: string[]) => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    setTip({ x: evt.clientX - rect.left, y: evt.clientY - rect.top, lines });
  };
  const hide = () => setTip(null);

  return { tip, show, hide, hostRef };
}

/** Mark color: one hue for the series; status colors only on breached marks. */
export function markColor(status: 'ok' | 'notable' | 'critical'): string {
  if (status === 'critical') return 'var(--status-critical)';
  if (status === 'notable') return 'var(--status-notable-fill)';
  return 'var(--chart-2)';
}

/** Ordinal blues for the four ordered grade bands (A darkest → D/F lightest). */
export const BAND_COLORS = [
  'var(--heat-bin-4)',
  'var(--heat-bin-3)',
  'var(--heat-bin-2)',
  'var(--heat-bin-1)',
] as const;

/** Ink color readable on an ordinal/heat bin fill. */
export function inkForBin(bin: 0 | 1 | 2 | 3): string {
  return bin >= 2 ? 'var(--heat-ink-light)' : 'var(--heat-ink-dark)';
}
