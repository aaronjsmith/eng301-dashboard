import type { SizeTier } from '../../types';
import type { ChartData, SeriesPoint } from '../../metrics/chartData';
import { BAND_COLORS, inkForBin, useTooltip } from './common';
import styles from './Chart.module.css';

interface PieChartProps {
  data: ChartData;
  size: SizeTier;
}

/**
 * Composition of a whole, ≤4 slices (grade bands A/B/C/D-F on the ordinal
 * blue ramp, 2px surface gaps). Legend at M/L (≥2 series); slice labels at L
 * where they fit; slices beyond 4 fold into "Other" upstream.
 */
export function PieChart({ data, size }: PieChartProps) {
  const { tip, show, hide, hostRef } = useTooltip();
  const slices: SeriesPoint[] = (data.slices ?? data.points).slice(0, 4);
  const total = slices.reduce((sum, s) => sum + (s.value ?? 0), 0);

  const r = size === 'S' ? 38 : 52;
  const box = r * 2 + 8;

  let angle = -Math.PI / 2;
  const arcs = slices.map((slice, i) => {
    const share = total > 0 ? (slice.value ?? 0) / total : 0;
    const start = angle;
    const end = angle + share * Math.PI * 2;
    angle = end;
    const large = share > 0.5 ? 1 : 0;
    const cx = box / 2;
    const cy = box / 2;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const mid = (start + end) / 2;
    return {
      slice,
      share,
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
      labelX: cx + r * 0.62 * Math.cos(mid),
      labelY: cy + r * 0.62 * Math.sin(mid),
      color: BAND_COLORS[i],
      binIndex: (3 - i) as 0 | 1 | 2 | 3, // BAND_COLORS[0] is the darkest bin
    };
  });

  return (
    <div className={styles.host} data-chart="pie">
      <div ref={hostRef} style={{ position: 'relative' }}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${box} ${box}`}
          style={{ maxWidth: box, margin: '0 auto' }}
          role="img"
          aria-label={data.metricLabel}
        >
          <g stroke="var(--bg-surface)" strokeWidth={2}>
            {arcs.map((a) => (
              <path
                key={a.slice.key}
                d={a.d}
                fill={a.color}
                onMouseMove={
                  size === 'L'
                    ? (e) => show(e, [`${a.slice.label}: ${a.slice.formatted}`, `n = ${a.slice.n}`])
                    : undefined
                }
                onMouseLeave={size === 'L' ? hide : undefined}
              >
                <title>{`${a.slice.label}: ${a.slice.formatted} (n=${a.slice.n})`}</title>
              </path>
            ))}
          </g>
          {size === 'L' &&
            arcs
              .filter((a) => a.share >= 0.09)
              .map((a) => (
                <text
                  key={a.slice.key}
                  x={a.labelX}
                  y={a.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10.5}
                  fontWeight={600}
                  fill={inkForBin(a.binIndex)}
                >
                  {a.slice.label}
                </text>
              ))}
        </svg>
        {tip && (
          <div className={styles.tooltip} style={{ left: tip.x, top: tip.y }}>
            {tip.lines.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        )}
      </div>
      {size !== 'S' && (
        <div className={styles.legend}>
          {arcs.map((a) => (
            <span key={a.slice.key} className={styles.legendItem}>
              <span className={styles.swatch} style={{ background: a.color }} />
              {a.slice.label} · {a.slice.formatted}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
