import type { SizeTier } from '../../types';
import type { ChartData } from '../../metrics/chartData';
import { clampNum, markColor, useMeasuredSize } from './common';
import styles from './Chart.module.css';

interface DonutChartProps {
  data: ChartData;
  size: SizeTier;
}

/**
 * A single rate against its complement — hero number in the ring (the S-tier
 * default for rate metrics). M/L add the Compare-to baseline tick + caption.
 */
export function DonutChart({ data, size }: DonutChartProps) {
  const [plotRef, measured] = useMeasuredSize<HTMLDivElement>();
  const value = data.hero.value;
  // Ring fills the card; stroke, radius, and the in-ring number scale
  // together so a large donut never reads as a thin thread with tiny type.
  // The old per-tier radius floors it (print/unmeasured renders unchanged).
  const avail =
    measured.width && measured.height
      ? Math.min(measured.width, measured.height)
      : 0;
  const stroke = avail ? clampNum(avail * 0.055, 11, 30) : 11;
  const minR = size === 'S' ? 34 : size === 'M' ? 44 : 50;
  const r = avail ? Math.max(minR, avail / 2 - stroke - 6) : minR;
  const heroFont = clampNum(r * 0.4, size === 'S' ? 17 : 19, 44);
  const c = 2 * Math.PI * r;
  const box = (r + stroke) * 2;
  const share = value !== null ? Math.max(0, Math.min(100, value)) / 100 : 0;
  const color = markColor(data.status);

  const baselineShare =
    size !== 'S' && data.baseline !== undefined && data.unit === 'percent'
      ? Math.max(0, Math.min(100, data.baseline.value)) / 100
      : null;
  const baselineRad =
    baselineShare !== null ? (baselineShare * 360 - 90) * (Math.PI / 180) : null;

  return (
    <div className={styles.host} data-chart="donut">
      <div ref={plotRef} className={`${styles.plot} ${styles.centered}`}>
        <svg
          viewBox={`0 0 ${box} ${box}`}
          width={box}
          height={box}
          role="img"
          aria-label={`${data.metricLabel}: ${data.hero.formatted}`}
        >
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          fill="none"
          stroke="var(--chart-track)"
          strokeWidth={stroke}
        />
        {share > 0 && (
          <circle
            cx={box / 2}
            cy={box / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * share} ${c * (1 - share)}`}
            transform={`rotate(-90 ${box / 2} ${box / 2})`}
          />
        )}
        {baselineRad !== null && (
          <line
            x1={box / 2 + (r - stroke * 0.95) * Math.cos(baselineRad)}
            y1={box / 2 + (r - stroke * 0.95) * Math.sin(baselineRad)}
            x2={box / 2 + (r + stroke * 0.95) * Math.cos(baselineRad)}
            y2={box / 2 + (r + stroke * 0.95) * Math.sin(baselineRad)}
            stroke="var(--text-secondary)"
            strokeWidth={Math.max(2, stroke * 0.18)}
          />
        )}
        <text
          x={box / 2}
          y={box / 2 + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={heroFont}
          fontWeight={700}
          fill="var(--text-primary)"
        >
          {data.hero.formatted}
        </text>
        </svg>
      </div>
      {size !== 'S' && data.baseline && (
        <p className={styles.heroSub} style={{ textAlign: 'center', margin: '4px 0 0' }}>
          {data.baseline.label}: {data.baseline.formatted}
        </p>
      )}
    </div>
  );
}
