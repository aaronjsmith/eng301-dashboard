import type { SizeTier } from '../../types';
import type { ChartData, SeriesPoint } from '../../metrics/chartData';
import { studentsLabel } from '../../metrics/format';
import {
  BAR_MAX,
  CHART_FONT,
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
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
}

/** Approx width of one character at CHART_FONT.label. */
const LABEL_CHAR_PX = 6.6;

/** Nested split labels use " · " — wrap after the first part when present. */
function labelLines(label: string, maxChars: number): string[] {
  const parts = label.split(' · ');
  if (parts.length === 1) return [shortLabel(label, maxChars)];
  const first = shortLabel(parts[0], Math.max(8, Math.floor(maxChars * 0.55)));
  const rest = shortLabel(parts.slice(1).join(' · '), maxChars);
  return [first, rest];
}

/**
 * Horizontal category bars — labels left, pill bars, values at the tip,
 * optional dashed Compare-to reference. Click a bar to filter the student
 * list to that mark (click again to clear). Label column grows with nested
 * split names; tall series scroll instead of crushing bar height.
 */
export function BarChart({ data, size, selectedKey = null, onSelect }: BarChartProps) {
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

  const visible = size === 'S' ? points.filter((p) => !p.suppressed).slice(0, 5) : points;
  const width = measured.width || 240;
  const values = visible.map((p) => p.value ?? 0);
  const baselineValue = data.baseline?.value ?? 0;
  const maxValue = Math.max(...values, size === 'S' ? 0 : baselineValue, 1);
  const ticks = niceTicks(maxValue);
  const scaleMax = ticks.at(-1) || 1;

  const nested = visible.some((p) => p.label.includes(' · '));
  const longest = Math.max(...visible.map((p) => p.label.length), 4);
  const idealLabelW = longest * LABEL_CHAR_PX + (nested ? 12 : 18);
  const labelCap =
    size === 'S' ? Math.min(100, width * 0.38) : Math.min(260, width * 0.48);
  const labelW = clampNum(
    idealLabelW,
    size === 'S' ? 56 : nested ? 120 : 90,
    labelCap,
  );
  const maxLabelChars = Math.max(8, Math.floor((labelW - 12) / LABEL_CHAR_PX));

  const valueW = size === 'S' ? 36 : 56;
  const topPad = size === 'S' ? 2 : 6;
  const bottomPad = size === 'S' ? 2 : 6;
  // Nested labels need a taller row floor so the second line stays readable.
  const rowFloor = size === 'S' ? 22 : size === 'M' ? (nested ? 40 : 36) : nested ? 48 : 44;
  const rowCeil = size === 'S' ? 32 : size === 'M' ? 56 : 68;
  const availableH = measured.height || rowFloor * visible.length;
  const fitted = availableH / Math.max(visible.length, 1);
  // Prefer readable rows; if they overflow the card, scroll instead of squashing.
  const rowH = fitted >= rowFloor ? clampNum(fitted, rowFloor, rowCeil) : rowFloor;
  const needsScroll = topPad + visible.length * rowH + bottomPad > availableH + 1;
  const barH = Math.min(
    BAR_MAX[size],
    Math.max(10, rowH - (size === 'S' ? 8 : nested ? 18 : 14)),
  );
  const chartW = Math.max(width - labelW - valueW, 64);
  const height = topPad + visible.length * rowH + bottomPad;
  const x = (v: number) => (v / scaleMax) * chartW;
  const axisBottom = topPad + visible.length * rowH - 4;

  const toggle = (key: string) => {
    if (!onSelect) return;
    onSelect(selectedKey === key ? null : key);
  };

  return (
    <div className={styles.host} data-chart="bars">
      <div
        ref={setPlotRef}
        className={styles.plot}
        data-scroll={needsScroll || undefined}
      >
        <svg
          className={styles.svg}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={data.metricLabel}
        >
          {size === 'L' &&
            ticks.slice(1).map((t) => (
              <line
                key={t}
                x1={labelW + x(t)}
                y1={topPad}
                x2={labelW + x(t)}
                y2={axisBottom}
                stroke="var(--chart-grid)"
                strokeWidth={1}
              />
            ))}

          {size !== 'S' && data.baseline && (
            <line
              x1={labelW + x(Math.min(baselineValue, scaleMax))}
              y1={topPad}
              x2={labelW + x(Math.min(baselineValue, scaleMax))}
              y2={axisBottom}
              stroke="var(--text-secondary)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            >
              <title>{`${data.baseline.label}: ${data.baseline.formatted}`}</title>
            </line>
          )}

          {visible.map((p, i) => {
            const y = topPad + i * rowH;
            const barW = p.suppressed ? 0 : x(p.value ?? 0);
            const cy = y + rowH / 2;
            const dimmed = selectedKey !== null && selectedKey !== p.key;
            const lines = labelLines(p.label, maxLabelChars);
            const lineGap = 12;
            const labelBlockH = lines.length * lineGap;
            const labelTop = cy - labelBlockH / 2 + lineGap * 0.35;
            return (
              <g
                key={p.key}
                opacity={dimmed ? 0.35 : 1}
                style={{ cursor: onSelect && !p.suppressed ? 'pointer' : undefined }}
                onClick={
                  onSelect && !p.suppressed
                    ? (e) => {
                        e.stopPropagation();
                        toggle(p.key);
                      }
                    : undefined
                }
                onMouseMove={
                  size === 'L'
                    ? (e) =>
                        show(e, [
                          `${p.label}: ${p.formatted}`,
                          studentsLabel(p.n),
                          onSelect ? 'Click to show in list' : '',
                        ].filter(Boolean))
                    : undefined
                }
                onMouseLeave={size === 'L' ? hide : undefined}
              >
                <title>{`${p.label}: ${p.formatted} (${studentsLabel(p.n)})`}</title>
                {lines.map((line, li) => (
                  <text
                    key={li}
                    x={labelW - 10}
                    y={labelTop + li * lineGap}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={li === 0 ? CHART_FONT.label : CHART_FONT.axis}
                    fontWeight={li === 0 ? 600 : 400}
                    fill="var(--text-secondary)"
                  >
                    {line}
                  </text>
                ))}
                {p.suppressed ? (
                  <text
                    x={labelW + 6}
                    y={cy}
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
                      y={cy - barH / 2}
                      width={Math.max(barW, barH)}
                      height={barH}
                      rx={barH / 2}
                      fill={markColor(p.status)}
                    />
                    {size !== 'S' && (
                      <text
                        x={labelW + Math.max(barW, barH) + 8}
                        y={cy}
                        dominantBaseline="middle"
                        fontSize={CHART_FONT.value}
                        fontWeight={700}
                        fill="var(--text-primary)"
                      >
                        {p.formatted.replace(/%$/, '')}
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
            y2={axisBottom}
            stroke="var(--chart-axis)"
            strokeWidth={1}
          />
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
