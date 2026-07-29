import type { SizeTier } from '../../types';
import type { ChartData } from '../../metrics/chartData';
import { THRESHOLDS } from '../../metrics/thresholds';
import { CHART_FONT, clampNum, inkForBin, useMeasuredSize, useTooltip } from './common';
import styles from './Chart.module.css';

interface HeatmapChartProps {
  data: ChartData;
  size: SizeTier;
}

const BIN_TOKENS = [
  'var(--heat-bin-1)',
  'var(--heat-bin-2)',
  'var(--heat-bin-3)',
  'var(--heat-bin-4)',
] as const;

/**
 * Pass-rate surface: course rows × dimension columns, colored by the
 * justification doc's bins (<78 / 78–82 / 82–85 / ≥85) on a one-hue
 * sequential ramp. Every cell prints its value — color is never the only
 * encoding; suppressed cells hatch as "n<20".
 */
export function HeatmapChart({ data, size }: HeatmapChartProps) {
  const [plotRef, measured] = useMeasuredSize<HTMLDivElement>();
  const { tip, show, hide, hostRef: tipHost } = useTooltip();
  const setPlotRef = (el: HTMLDivElement | null) => {
    plotRef.current = el;
    tipHost.current = el;
  };
  const matrix = data.matrix;

  if (!matrix) {
    return (
      <div className={styles.empty}>
        This grid needs at least 2 courses — set Course to All
      </div>
    );
  }

  const width = measured.width || 260;
  const labelW = size === 'S' ? 0 : 64;
  const headerH = size === 'S' ? 0 : 16;
  const gap = 2;
  // Cells stretch into free card height; the old per-tier constant floors.
  const minCellH = size === 'S' ? 18 : size === 'M' ? 30 : 34;
  const cellH = clampNum(
    measured.height
      ? (measured.height - headerH) / matrix.rowLabels.length - gap
      : minCellH,
    minCellH,
    44,
  );
  const cols = matrix.colLabels.length;
  const cellW = Math.max((width - labelW - gap * (cols - 1)) / cols, 24);
  const height = headerH + matrix.rowLabels.length * (cellH + gap);
  const [b1, b2, b3] = THRESHOLDS.heatBins;
  const binLabels = [`<${b1}`, `${b1}–${b2}`, `${b2}–${b3}`, `≥${b3}`];

  return (
    <div className={styles.host} data-chart="heatmap">
      <div ref={setPlotRef} className={styles.plot}>
        <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={data.metricLabel}>
          {size !== 'S' &&
            matrix.colLabels.map((col, c) => (
              <text
                key={col}
                x={labelW + c * (cellW + gap) + cellW / 2}
                y={headerH - 5}
                textAnchor="middle"
                fontSize={CHART_FONT.axis}
                fill="var(--text-muted)"
              >
                {col}
              </text>
            ))}
          {matrix.rowLabels.map((row, ri) => (
            <g key={row}>
              {size !== 'S' && (
                <text
                  x={labelW - 8}
                  y={headerH + ri * (cellH + gap) + cellH / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={CHART_FONT.label}
                  fill="var(--text-secondary)"
                >
                  {row}
                </text>
              )}
              {matrix.cells[ri].map((cell, ci) => {
                const x = labelW + ci * (cellW + gap);
                const y = headerH + ri * (cellH + gap);
                return (
                  <g
                    key={ci}
                    onMouseMove={
                      size === 'L'
                        ? (e) =>
                            show(e, [
                              `${row} · ${matrix.colLabels[ci]}`,
                              cell.suppressed
                                ? 'Hidden (fewer than 20 students)'
                                : `${cell.formatted} · n = ${cell.n}`,
                            ])
                        : undefined
                    }
                    onMouseLeave={size === 'L' ? hide : undefined}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={cellW}
                      height={cellH}
                      rx={3}
                      fill={cell.suppressed || cell.bin === null ? 'var(--bg-inset)' : BIN_TOKENS[cell.bin]}
                    >
                      <title>
                        {`${row} × ${matrix.colLabels[ci]}: ${cell.suppressed ? 'n<20 suppressed' : cell.formatted}`}
                      </title>
                    </rect>
                    {cell.suppressed && (
                      <line
                        x1={x + 3}
                        y1={y + cellH - 3}
                        x2={x + cellW - 3}
                        y2={y + 3}
                        stroke="var(--text-muted)"
                        strokeWidth={1}
                      />
                    )}
                    {size !== 'S' && (
                      <text
                        x={x + cellW / 2}
                        y={y + cellH / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={CHART_FONT.axis}
                        fontWeight={600}
                        fill={
                          cell.suppressed || cell.bin === null
                            ? 'var(--text-muted)'
                            : inkForBin(cell.bin)
                        }
                      >
                        {cell.suppressed ? 'n<20' : cell.formatted}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
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
        <div className={styles.legend} aria-label="Pass-rate bins">
          {binLabels.map((label, i) => (
            <span key={label} className={styles.legendItem}>
              <span className={styles.swatch} style={{ background: BIN_TOKENS[i] }} />
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
