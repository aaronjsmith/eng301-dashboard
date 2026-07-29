import type { SizeTier } from '../../types';
import type { ChartData, SeriesPoint } from '../../metrics/chartData';
import { studentsLabel } from '../../metrics/format';
import {
  BAR_MAX,
  CHART_FONT,
  MARK,
  clampNum,
  markColor,
  niceTicks,
  shortLabel,
  useMeasuredSize,
  useTooltip,
} from './common';
import styles from './Chart.module.css';

interface BarChartProps {
  data: ChartData;
  size: SizeTier;
}

/**
 * Category comparison. S: ≤5 mini bars, no chrome. M: axis + direct labels on
 * the extremes + Compare-to reference line. L: + gridlines, a value at every
 * bar tip, hover tooltips. Horizontal when category labels run long.
 */
export function BarChart({ data, size }: BarChartProps) {
  const [plotRef, measured] = useMeasuredSize<HTMLDivElement>();
  const { tip, show, hide, hostRef: tipHost } = useTooltip();
  const setPlotRef = (el: HTMLDivElement | null) => {
    plotRef.current = el;
    tipHost.current = el;
  };

  const points =
    data.points.length > 0
      ? data.points
      : [
          {
            key: 'all',
            label: data.metricLabel,
            value: data.hero.value,
            formatted: data.hero.formatted,
            n: data.n,
            suppressed: false,
            status: data.status,
          } satisfies SeriesPoint,
        ];

  const width = measured.width || 240;
  const values = points.map((p) => p.value ?? 0);
  const baselineValue = data.baseline?.value ?? 0;
  const maxValue = Math.max(...values, size === 'S' ? 0 : baselineValue, 1);

  const horizontal =
    size !== 'S' &&
    (points.some((p) => p.label.length > 10) || points.length > 6);

  const visible = size === 'S' ? points.filter((p) => !p.suppressed).slice(0, 5) : points;

  if (horizontal) {
    const labelW = 92;
    const topPad = 4;
    // Rows stretch modestly into free card height; 24 (the old constant) floors.
    const rowH = clampNum(
      measured.height ? (measured.height - topPad - 18) / visible.length : 24,
      24,
      44,
    );
    const barH = Math.min(BAR_MAX[size], rowH - 8);
    const chartW = Math.max(width - labelW - 46, 60);
    const height = topPad + visible.length * rowH + 18;
    const ticks = niceTicks(maxValue);
    const x = (v: number) => (v / (ticks.at(-1) || 1)) * chartW;

    return (
      <div className={styles.host} data-chart="bars">
        <div ref={setPlotRef} className={styles.plot}>
          <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={data.metricLabel}>
            {size === 'L' &&
              ticks.map((t) => (
                <line
                  key={t}
                  x1={labelW + x(t)}
                  y1={topPad}
                  x2={labelW + x(t)}
                  y2={height - 16}
                  stroke="var(--chart-grid)"
                  strokeWidth={1}
                />
              ))}
            {visible.map((p, i) => {
              const y = topPad + i * rowH;
              const barW = p.suppressed ? 0 : x(p.value ?? 0);
              const showValue =
                size === 'L' ||
                p.suppressed ||
                p.value === Math.max(...values) ||
                p.value === Math.min(...values);
              return (
                <g
                  key={p.key}
                  onMouseMove={
                    size === 'L'
                      ? (e) => show(e, [`${p.label}: ${p.formatted}`, studentsLabel(p.n)])
                      : undefined
                  }
                  onMouseLeave={size === 'L' ? hide : undefined}
                >
                  <text
                    x={labelW - 8}
                    y={y + rowH / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={CHART_FONT.label}
                    fill="var(--text-secondary)"
                  >
                    {shortLabel(p.label, 13)}
                  </text>
                  {p.suppressed ? (
                    <text
                      x={labelW + 4}
                      y={y + rowH / 2}
                      dominantBaseline="middle"
                      fontSize={CHART_FONT.axis}
                      fill="var(--text-muted)"
                    >
                      {p.formatted}
                    </text>
                  ) : (
                    <>
                      <rect
                        x={labelW}
                        y={y + (rowH - barH) / 2}
                        width={Math.max(barW, 2)}
                        height={barH}
                        rx={MARK.radius}
                        fill={markColor(p.status)}
                      >
                        <title>{`${p.label}: ${p.formatted} (${studentsLabel(p.n)})`}</title>
                      </rect>
                      {showValue && (
                        <text
                          x={labelW + Math.max(barW, 2) + 6}
                          y={y + rowH / 2}
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
            <line
              x1={labelW}
              y1={topPad}
              x2={labelW}
              y2={height - 16}
              stroke="var(--chart-axis)"
              strokeWidth={1}
            />
            {data.baseline && (
              <line
                x1={labelW + x(baselineValue)}
                y1={topPad}
                x2={labelW + x(baselineValue)}
                y2={height - 16}
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
        {data.baseline && (
          <p className={styles.heroSub}>
            ┄ {data.baseline.label}: {data.baseline.formatted}
          </p>
        )}
      </div>
    );
  }

  // Vertical columns — the old per-tier constants floor the measured height.
  const minPlotH = size === 'S' ? 56 : size === 'M' ? 122 : 150;
  const axisBand = size === 'S' ? 0 : 16;
  const topPad = size === 'S' ? 2 : 14;
  const plotH = Math.max(minPlotH, measured.height - topPad - axisBand);
  const height = topPad + plotH + axisBand;
  const slot = width / Math.max(visible.length, 1);
  const barW = clampNum(slot * 0.55, 8, BAR_MAX[size]);
  const y = (v: number) => topPad + plotH - (v / maxValue) * plotH;

  const maxV = Math.max(...values);
  const minV = Math.min(...values);

  return (
    <div className={styles.host} data-chart="bars">
      <div ref={setPlotRef} className={styles.plot}>
        <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={data.metricLabel}>
          {size === 'L' &&
            niceTicks(maxValue).map((t) => (
              <g key={t}>
                <line
                  x1={0}
                  y1={y(t)}
                  x2={width}
                  y2={y(t)}
                  stroke="var(--chart-grid)"
                  strokeWidth={1}
                />
                <text x={2} y={y(t) - 3} fontSize={CHART_FONT.axis} fill="var(--text-muted)">
                  {t}
                </text>
              </g>
            ))}
          {visible.map((p, i) => {
            const cx = i * slot + slot / 2;
            const barH = p.suppressed ? 0 : Math.max(topPad + plotH - y(p.value ?? 0), 2);
            const showValue =
              size !== 'S' &&
              (size === 'L' || p.value === maxV || p.value === minV || p.suppressed);
            return (
              <g
                key={p.key}
                onMouseMove={
                  size === 'L'
                    ? (e) => show(e, [`${p.label}: ${p.formatted}`, studentsLabel(p.n)])
                    : undefined
                }
                onMouseLeave={size === 'L' ? hide : undefined}
              >
                {p.suppressed ? (
                  <text
                    x={cx}
                    y={topPad + plotH - 4}
                    textAnchor="middle"
                    fontSize={CHART_FONT.axis}
                    fill="var(--text-muted)"
                  >
                    {p.formatted}
                  </text>
                ) : (
                  <>
                    <path
                      d={`M ${cx - barW / 2} ${topPad + plotH}
                          L ${cx - barW / 2} ${topPad + plotH - barH + MARK.radius}
                          Q ${cx - barW / 2} ${topPad + plotH - barH} ${cx - barW / 2 + MARK.radius} ${topPad + plotH - barH}
                          L ${cx + barW / 2 - MARK.radius} ${topPad + plotH - barH}
                          Q ${cx + barW / 2} ${topPad + plotH - barH} ${cx + barW / 2} ${topPad + plotH - barH + MARK.radius}
                          L ${cx + barW / 2} ${topPad + plotH} Z`}
                      fill={markColor(p.status)}
                    >
                      <title>{`${p.label}: ${p.formatted} (${studentsLabel(p.n)})`}</title>
                    </path>
                    {showValue && (
                      <text
                        x={cx}
                        y={topPad + plotH - barH - 4}
                        textAnchor="middle"
                        fontSize={CHART_FONT.value}
                        fontWeight={600}
                        fill="var(--text-primary)"
                      >
                        {p.formatted}
                      </text>
                    )}
                  </>
                )}
                {size !== 'S' && (
                  <text
                    x={cx}
                    y={height - 4}
                    textAnchor="middle"
                    fontSize={CHART_FONT.axis}
                    fill="var(--text-muted)"
                  >
                    {shortLabel(p.label, Math.max(4, Math.floor(slot / 7)))}
                  </text>
                )}
              </g>
            );
          })}
          <line
            x1={0}
            y1={topPad + plotH}
            x2={width}
            y2={topPad + plotH}
            stroke="var(--chart-axis)"
            strokeWidth={1}
          />
          {size !== 'S' && data.baseline && (
            <line
              x1={0}
              y1={y(Math.min(baselineValue, maxValue))}
              x2={width}
              y2={y(Math.min(baselineValue, maxValue))}
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
