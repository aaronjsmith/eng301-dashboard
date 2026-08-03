import type { ChartType, SizeTier } from '../../types';
import type { ChartData } from '../../metrics/chartData';
import { BarChart } from './BarChart';
import { DonutChart } from './DonutChart';
import { PieChart } from './PieChart';
import { AreaChart } from './AreaChart';
import { HeatmapChart } from './HeatmapChart';
import { DivergingBarChart } from './DivergingBarChart';
import { Tip } from '../ui/Tip';
import styles from './Chart.module.css';

interface ChartProps {
  type: ChartType;
  size: SizeTier;
  data: ChartData;
}

/**
 * THE chart entry point — one API for every module chart. Size is semantic
 * zoom: each type renders more marks/labels per tier, never scaled-up ones.
 * The hero number leads every form except the donut (which embeds it).
 */
export function Chart({ type, size, data }: ChartProps) {
  if (data.n === 0) {
    return <div className={styles.empty}>No students in the current scope</div>;
  }

  const heroRow = type !== 'donut' && (
    <div className={styles.heroRow}>
      <span className={`${styles.hero} ${size !== 'S' ? styles.heroM : ''}`}>
        {data.hero.formatted}
      </span>
      {data.status !== 'ok' && (
        <Tip
          content={{
            title: data.status === 'critical' ? 'Breach' : 'Off target',
            body:
              data.status === 'critical'
                ? 'The current value crosses the critical threshold for this metric.'
                : 'The current value misses this metric’s target, within the notable band.',
          }}
        >
          <span className={styles.heroStatus} data-status={data.status}>
            <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
              <circle cx="5" cy="5" r="4" fill="currentColor" />
            </svg>
            {data.status === 'critical' ? 'Breach' : 'Off target'}
          </span>
        </Tip>
      )}
    </div>
  );

  const mark = (() => {
    switch (type) {
      case 'donut':
        return <DonutChart data={data} size={size} />;
      case 'bars':
        return <BarChart data={data} size={size} />;
      case 'pie':
        return <PieChart data={data} size={size} />;
      case 'area':
        return <AreaChart data={data} size={size} />;
      case 'heatmap':
        return <HeatmapChart data={data} size={size} />;
      case 'divergingBar':
        return <DivergingBarChart data={data} size={size} />;
    }
  })();

  return (
    <div className={styles.frame}>
      {heroRow}
      {type !== 'donut' && size === 'S' && (
        <p className={styles.heroSub}>{data.hero.sub}</p>
      )}
      <div className={styles.markArea}>{mark}</div>
      {type !== 'donut' && size !== 'S' && (
        <p className={styles.heroSub}>{data.hero.sub}</p>
      )}
      {data.flagCounts && (
        <p className={styles.flagLegend} aria-label="Failing and marginal counts">
          <span className={styles.flagFail}>{data.flagCounts.fail} failing</span>
          <span className={styles.flagSep} aria-hidden="true">
            ·
          </span>
          <span className={styles.flagMarginal}>{data.flagCounts.marginal} marginal</span>
        </p>
      )}
    </div>
  );
}
