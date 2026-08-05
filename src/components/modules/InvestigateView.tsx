import { useMemo } from 'react';
import type { Dimension, FilterState, ModuleConfig } from '../../types';
import { useRole } from '../../context/RoleContext';
import { useDashboardScope } from '../../hooks/useMetrics';
import { dimensionScan } from '../../metrics/investigate';
import { metricDef } from '../../metrics/registry';
import { availableChartTypes } from '../../metrics/availability';
import { DIMENSION_META, valueLabel } from '../../metrics/scope';
import { studentsLabel } from '../../metrics/format';
import styles from './InvestigateView.module.css';

interface InvestigateViewProps {
  config: ModuleConfig;
  onPromote: (patch: Partial<ModuleConfig>) => void;
}

/**
 * Root-cause mode (spec §3): the frozen slice, the healthy-complement
 * baseline, and the ranked dimension scan — "what explains this number
 * most". Promoting a row turns the module into a normal chart with that
 * dimension as Break-down-by (the slice stays as module filters).
 */
export function InvestigateView({ config, onPromote }: InvestigateViewProps) {
  const { role } = useRole();
  const { scopeRows } = useDashboardScope();
  const payload = config.investigate!;

  const scan = useMemo(
    () => dimensionScan(scopeRows, payload, role),
    [scopeRows, payload, role],
  );

  const def = metricDef(payload.metric);

  const sliceChips = (Object.entries(payload.slice) as [Dimension, string[]][]).map(
    ([dim, values]) => `${DIMENSION_META[dim].label}: ${values.map((v) => valueLabel(dim, v)).join(', ')}`,
  );

  const promote = (dim: Dimension) => {
    const mergedFilters: FilterState = { ...config.filters, ...payload.slice };
    const nextConfig = { ...config, breakdown: dim, filters: mergedFilters };
    const types = availableChartTypes(nextConfig, { courseCount: 1 });
    onPromote({
      filters: mergedFilters,
      breakdown: dim,
      thenBy: undefined,
      chartType: types[0],
      compareTo: 'median',
      investigate: undefined,
    });
  };

  return (
    <div className={styles.root}>
      <div className={styles.sliceRow}>
        <span className={styles.frozen}>Frozen slice</span>
        {sliceChips.map((chip) => (
          <span key={chip} className={styles.chip}>
            {chip}
          </span>
        ))}
      </div>

      <div className={styles.compare}>
        <div className={styles.compareCell}>
          <span className={styles.compareValue}>{scan.sliceFormatted}</span>
          <span className={styles.compareLabel}>
            {def.label} · slice ({studentsLabel(scan.sliceN)})
          </span>
        </div>
        <span className={styles.vs}>vs</span>
        <div className={styles.compareCell}>
          <span className={styles.compareValue}>{scan.baselineFormatted}</span>
          <span className={styles.compareLabel}>{payload.baselineLabel}</span>
        </div>
      </div>

      <p className={styles.scanTitle}>
        Dimension scan — splits ranked by gap size
      </p>
      {scan.rows.length === 0 ? (
        <p className={styles.emptyScan}>
          No dimension splits the slice into two reportable groups (at least 20 students each).
        </p>
      ) : (
        <ol className={styles.scanList}>
          {scan.rows.map((row, i) => (
            <li key={row.dim} className={styles.scanRow}>
              <div className={styles.scanHead}>
                <span className={styles.rank}>{i + 1}</span>
                <span className={styles.dimLabel}>{row.dimLabel}</span>
                <span className={styles.gap}>Δ {row.formattedGap}</span>
                <button
                  type="button"
                  className={styles.promote}
                  onClick={() => promote(row.dim)}
                  title={`Break the module down by ${row.dimLabel}`}
                >
                  Promote →
                </button>
              </div>
              <p className={styles.scanDetail}>
                {row.lowest.label} {row.lowest.formatted} ({studentsLabel(row.lowest.n)}) ·{' '}
                {row.highest.label} {row.highest.formatted} ({studentsLabel(row.highest.n)})
                {row.groupCount > 2 ? ` · ${row.groupCount} groups` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
