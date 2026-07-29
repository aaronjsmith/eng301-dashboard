import { useId } from 'react';
import type { SizeTier } from '../../types';
import type { ChartData } from '../../metrics/chartData';
import { studentsLabel } from '../../metrics/format';
import {
  BAND_COLORS,
  CHART_FONT,
  MARK,
  niceTicks,
  useMeasuredSize,
  useTooltip,
} from './common';
import styles from './Chart.module.css';

interface AreaChartProps {
  data: ChartData;
  size: SizeTier;
}

/**
 * Trends over an ordered axis (sessions). Single series: 2px line + 10% wash;
 * S renders as a filled sparkline. Stacked variant (grade-band mix per
 * session): ≤4 bands with a 2px surface separation. Only offered when the
 * module has an ordered axis (availability.ts).
 */
export function AreaChart({ data, size }: AreaChartProps) {
  const [plotRef, measured] = useMeasuredSize<HTMLDivElement>();
  const { tip, show, hide, hostRef: tipHost } = useTooltip();
  // Per-instance gradient id (several charts share the page); no colons —
  // useId's ":r1:" form breaks url(#…) references.
  const gradId = `area-fill-${useId().replace(/:/g, '')}`;
  const setPlotRef = (el: HTMLDivElement | null) => {
    plotRef.current = el;
    tipHost.current = el;
  };

  const width = measured.width || 240;
  // Old per-tier constants floor the measured plot height.
  const minPlotH = size === 'S' ? 46 : size === 'M' ? 116 : 144;
  const axisBand = size === 'S' ? 0 : 16;
  const topPad = size === 'S' ? 4 : 14;
  const plotH = Math.max(minPlotH, measured.height - topPad - axisBand);
  const height = topPad + plotH + axisBand;
  const sidePad = 10;

  const stacked = data.stacks !== undefined && data.stacks.length > 0;

  if (stacked) {
    const stacks = data.stacks!;
    const bandCount = Math.min(stacks[0]?.bands.length ?? 0, 4);
    const x = (i: number) =>
      sidePad + (i / Math.max(stacks.length - 1, 1)) * (width - sidePad * 2);
    const y = (v: number) => topPad + plotH - (v / 100) * plotH;

    // Cumulative shares per stack, band-major for path building.
    const cumulative = stacks.map((s) => {
      let running = 0;
      return s.bands.slice(0, bandCount).map((b) => {
        const from = running;
        running += b.value ?? 0;
        return { from, to: running };
      });
    });

    const bandPath = (bandIdx: number) => {
      const top = cumulative.map((c, i) => `${x(i)},${y(c[bandIdx].to)}`);
      const bottom = cumulative
        .map((c, i) => `${x(i)},${y(c[bandIdx].from)}`)
        .reverse();
      return `M ${top.join(' L ')} L ${bottom.join(' L ')} Z`;
    };

    return (
      <div className={styles.host} data-chart="area">
        <div ref={setPlotRef} className={styles.plot}>
          <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={data.metricLabel}>
            {Array.from({ length: bandCount }, (_, b) => (
              <path
                key={b}
                d={bandPath(b)}
                fill={BAND_COLORS[b]}
                stroke="var(--bg-surface)"
                strokeWidth={MARK.gap}
                onMouseMove={
                  size === 'L'
                    ? (e) => {
                        const i = Math.round(
                          ((e.nativeEvent.offsetX - sidePad) / (width - sidePad * 2)) *
                            (stacks.length - 1),
                        );
                        const stack = stacks[Math.max(0, Math.min(i, stacks.length - 1))];
                        if (stack) {
                          show(e, [
                            stack.label,
                            ...stack.bands.map((band) => `${band.label}: ${band.formatted}`),
                          ]);
                        }
                      }
                    : undefined
                }
                onMouseLeave={size === 'L' ? hide : undefined}
              />
            ))}
            {size !== 'S' &&
              stacks.map((s, i) => (
                <text
                  key={s.label}
                  x={x(i)}
                  y={height - 4}
                  textAnchor={i === 0 ? 'start' : i === stacks.length - 1 ? 'end' : 'middle'}
                  fontSize={CHART_FONT.axis}
                  fill="var(--text-muted)"
                >
                  {s.label}
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
            {stacks[0]?.bands.slice(0, bandCount).map((b, i) => (
              <span key={b.key} className={styles.legendItem}>
                <span className={styles.swatch} style={{ background: BAND_COLORS[i] }} />
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Single series over the ordered axis
  const points = data.points;
  if (points.length === 0) {
    return <div className={styles.empty}>Nothing to chart in this view</div>;
  }
  const values = points.map((p) => p.value ?? 0);
  const maxValue = Math.max(...values, data.baseline?.value ?? 0, 1);
  const x = (i: number) =>
    sidePad + (i / Math.max(points.length - 1, 1)) * (width - sidePad * 2);
  const y = (v: number) => topPad + plotH - (v / maxValue) * plotH;
  const linePath = `M ${points.map((p, i) => `${x(i)},${y(p.value ?? 0)}`).join(' L ')}`;
  const areaPath = `${linePath} L ${x(points.length - 1)},${topPad + plotH} L ${x(0)},${topPad + plotH} Z`;
  const last = points[points.length - 1];

  return (
    <div className={styles.host} data-chart="area">
      <div ref={setPlotRef} className={styles.plot}>
        <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={data.metricLabel}>
          {size === 'L' &&
            niceTicks(maxValue).map((t) => (
              <line
                key={t}
                x1={0}
                y1={y(t)}
                x2={width}
                y2={y(t)}
                stroke="var(--chart-grid)"
                strokeWidth={1}
              />
            ))}
          <defs>
            {/* Real area-chart affordance: strong at the line, fading to the
                axis — a flat 10% wash disappeared on tall dark-mode plots. */}
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} />
          <path
            d={linePath}
            fill="none"
            stroke="var(--chart-2)"
            strokeWidth={MARK.line}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {(size === 'L' ? points : [last]).map((p, idx) => {
            const i = size === 'L' ? idx : points.length - 1;
            return (
              <circle
                key={p.key}
                cx={x(i)}
                cy={y(p.value ?? 0)}
                r={4}
                fill="var(--chart-2)"
                stroke="var(--bg-surface)"
                strokeWidth={MARK.gap}
                onMouseMove={
                  size === 'L'
                    ? (e) => show(e, [`${p.label}: ${p.formatted}`, studentsLabel(p.n)])
                    : undefined
                }
                onMouseLeave={size === 'L' ? hide : undefined}
              >
                <title>{`${p.label}: ${p.formatted}`}</title>
              </circle>
            );
          })}
          {size !== 'S' && (
            <text
              x={x(points.length - 1)}
              y={y(last.value ?? 0) - 9}
              textAnchor="end"
              fontSize={CHART_FONT.value}
              fontWeight={600}
              fill="var(--text-primary)"
            >
              {last.formatted}
            </text>
          )}
          {size !== 'S' &&
            points.map((p, i) => (
              <text
                key={p.key}
                x={x(i)}
                y={height - 4}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                fontSize={CHART_FONT.axis}
                fill="var(--text-muted)"
              >
                {p.label}
              </text>
            ))}
          {size !== 'S' && data.baseline && (
            <line
              x1={0}
              y1={y(Math.min(data.baseline.value, maxValue))}
              x2={width}
              y2={y(Math.min(data.baseline.value, maxValue))}
              stroke="var(--text-secondary)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            >
              <title>{`${data.baseline.label}: ${data.baseline.formatted}`}</title>
            </line>
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
      {size !== 'S' && data.baseline && (
        <p className={styles.heroSub}>
          ┄ {data.baseline.label}: {data.baseline.formatted}
        </p>
      )}
    </div>
  );
}
