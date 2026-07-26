import type { SizeTier } from '../../types';
import type { ChartData } from '../../metrics/chartData';
import { CHART_FONT, MARK, shortLabel, useMeasuredWidth, useTooltip } from './common';
import styles from './Chart.module.css';

interface DivergingBarChartProps {
  data: ChartData;
  size: SizeTier;
}

/**
 * Gap metrics (design doc's Equity view): ranked horizontal bars extending
 * left/right of a centered zero axis, dashed ±threshold lines. Bars within
 * the threshold stay in the neutral series hue; breached bars carry the
 * critical status color (meaning, not decoration).
 */
export function DivergingBarChart({ data, size }: DivergingBarChartProps) {
  const [hostRef, measured] = useMeasuredWidth<HTMLDivElement>();
  const { tip, show, hide, hostRef: tipHost } = useTooltip();

  const points =
    data.points.length > 0
      ? data.points
      : data.hero.value !== null
        ? [
            {
              key: 'all',
              label: 'In scope',
              value: data.hero.value,
              formatted: data.hero.formatted,
              n: data.n,
              suppressed: false,
              status: data.status,
            },
          ]
        : [];
  const visible = size === 'S' ? points.slice(0, 3) : points;
  const threshold = data.threshold ?? 5;

  if (visible.length === 0) {
    return <div className={styles.empty}>Gap not computable in this scope</div>;
  }

  const width = measured || 240;
  const labelW = size === 'S' ? 0 : 86;
  const rowH = size === 'S' ? 14 : 24;
  const topPad = size === 'S' ? 2 : 6;
  const axisBand = size === 'S' ? 0 : 15;
  const height = topPad + visible.length * rowH + axisBand;
  const plotW = width - labelW - 8;
  const cx = labelW + plotW / 2;

  const maxAbs = Math.max(
    ...visible.map((p) => Math.abs(p.value ?? 0)),
    threshold * 1.4,
  );
  const x = (v: number) => cx + (v / maxAbs) * (plotW / 2 - 30);

  return (
    <div className={styles.host} ref={hostRef} data-chart="diverging">
      <div ref={tipHost} style={{ position: 'relative' }}>
        <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={data.metricLabel}>
          {/* zero axis */}
          <line
            x1={cx}
            y1={topPad}
            x2={cx}
            y2={topPad + visible.length * rowH}
            stroke="var(--chart-axis)"
            strokeWidth={1}
          />
          {/* dashed ± threshold lines */}
          {[threshold, -threshold].map((t) => (
            <line
              key={t}
              x1={x(t)}
              y1={topPad}
              x2={x(t)}
              y2={topPad + visible.length * rowH}
              stroke="var(--status-critical)"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.65}
            >
              <title>{`Alert threshold ${t > 0 ? '+' : '−'}${threshold} pts`}</title>
            </line>
          ))}
          {visible.map((p, i) => {
            const y = topPad + i * rowH;
            const v = p.value ?? 0;
            const breached = Math.abs(v) > threshold;
            const barX = v >= 0 ? cx : x(v);
            const barW = Math.abs(x(v) - cx);
            const showValue = size !== 'S';
            return (
              <g
                key={p.key}
                onMouseMove={
                  size === 'L'
                    ? (e) =>
                        show(e, [
                          `${p.label}: ${p.formatted} pts`,
                          breached ? `Beyond ±${threshold} threshold` : `Within ±${threshold}`,
                          `n = ${p.n}`,
                        ])
                    : undefined
                }
                onMouseLeave={size === 'L' ? hide : undefined}
              >
                {size !== 'S' && (
                  <text
                    x={labelW - 8}
                    y={y + rowH / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={CHART_FONT.label}
                    fill="var(--text-secondary)"
                  >
                    {shortLabel(p.label, 12)}
                  </text>
                )}
                {p.suppressed ? (
                  <text
                    x={cx + 6}
                    y={y + rowH / 2}
                    dominantBaseline="middle"
                    fontSize={CHART_FONT.axis}
                    fill="var(--text-muted)"
                  >
                    n&lt;20
                  </text>
                ) : (
                  <>
                    <rect
                      x={barX}
                      y={y + (rowH - (size === 'S' ? 8 : 14)) / 2}
                      width={Math.max(barW, 2)}
                      height={size === 'S' ? 8 : 14}
                      rx={MARK.radius / 2}
                      fill={breached ? 'var(--status-critical)' : 'var(--chart-2)'}
                    >
                      <title>{`${p.label}: ${p.formatted} pts (n=${p.n})`}</title>
                    </rect>
                    {showValue && (
                      <text
                        x={v >= 0 ? x(v) + 5 : x(v) - 5}
                        y={y + rowH / 2}
                        textAnchor={v >= 0 ? 'start' : 'end'}
                        dominantBaseline="middle"
                        fontSize={CHART_FONT.value}
                        fontWeight={600}
                        fill="var(--text-primary)"
                      >
                        {p.formatted}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}
          {size !== 'S' && (
            <>
              <text x={cx} y={height - 3} textAnchor="middle" fontSize={CHART_FONT.axis} fill="var(--text-muted)">
                0
              </text>
              <text x={x(threshold)} y={height - 3} textAnchor="middle" fontSize={CHART_FONT.axis} fill="var(--status-critical)">
                +{threshold}
              </text>
              <text x={x(-threshold)} y={height - 3} textAnchor="middle" fontSize={CHART_FONT.axis} fill="var(--status-critical)">
                −{threshold}
              </text>
            </>
          )}
        </svg>
        {tip && (
          <div className={styles.tooltip} style={{ left: tip.x, top: tip.y }}>
            {tip.lines.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
