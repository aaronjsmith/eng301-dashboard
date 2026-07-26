import type { SizeTier } from '../../types';
import type { ChartData } from '../../metrics/chartData';
import { markColor } from './common';
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
  const value = data.hero.value;
  const r = size === 'S' ? 34 : 44;
  const stroke = 11;
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
      <svg
        className={styles.svg}
        viewBox={`0 0 ${box} ${box}`}
        style={{ maxWidth: box, margin: '0 auto' }}
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
            strokeWidth={2}
          />
        )}
        <text
          x={box / 2}
          y={box / 2 + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size === 'S' ? 17 : 19}
          fontWeight={700}
          fill="var(--text-primary)"
        >
          {data.hero.formatted}
        </text>
      </svg>
      {size !== 'S' && data.baseline && (
        <p className={styles.heroSub} style={{ textAlign: 'center', margin: '4px 0 0' }}>
          {data.baseline.label}: {data.baseline.formatted}
        </p>
      )}
    </div>
  );
}
