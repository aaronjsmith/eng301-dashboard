import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ChartType, CompareTo, Dimension, ModuleConfig, SizeTier } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useModuleChartData } from '../../hooks/useMetrics';
import { useRole } from '../../context/RoleContext';
import { metricDef } from '../../metrics/registry';
import {
  availableBreakdowns,
  availableChartTypes,
  availableCompareTos,
  effectiveChartType,
} from '../../metrics/availability';
import { activeFilterCount, DIMENSION_META } from '../../metrics/scope';
import { GLOSSARY } from '../../metrics/glossary';
import { Chart } from '../charts/Chart';
import { FilterPopup } from '../filters/FilterPopup';
import { Tip } from '../ui/Tip';
import { DataTable } from './DataTable';
import { InvestigateView } from './InvestigateView';
import { useDashboardScope } from '../../hooks/useMetrics';
import styles from './MetricModule.module.css';

interface MetricModuleProps {
  config: ModuleConfig;
  onDragStart?: (e: ReactPointerEvent<HTMLElement>) => void;
  dragging?: boolean;
}

const SIZES: SizeTier[] = ['S', 'M', 'L'];

const COMPARE_LABEL: Record<CompareTo, string> = {
  none: 'Nothing',
  priorSession: 'Previous term',
  sameTermLastYear: 'Same term last year',
  courseAvg: 'Course average',
  allCoursesAvg: 'Average of all courses',
  peerLevel: 'Similar course level',
};

const CHART_LABEL: Record<ChartType, string> = {
  donut: 'Donut',
  bars: 'Bars',
  pie: 'Pie',
  area: 'Area',
  heatmap: 'Heatmap',
  divergingBar: 'Gap bars',
};

/**
 * THE repeatable module — every blue box is one of these, instantiated from a
 * ModuleConfig. Controls scale with the size tier (S: filter badge only;
 * M: + the two comparison dropdowns; L: full row + data-table toggle); hidden
 * controls stay active — a filtered S-tile still shows filtered numbers (FR5).
 */
export function MetricModule({ config, onDragStart, dragging }: MetricModuleProps) {
  const { dispatch } = useWorkspace();
  const { role } = useRole();
  const { scopeRows } = useDashboardScope();
  const { data, sanitized } = useModuleChartData(config);
  const [filterOpen, setFilterOpen] = useState(false);

  const def = metricDef(config.metric);
  const patch = (p: Partial<ModuleConfig>) =>
    dispatch({ type: 'update-module', id: config.id, patch: p });

  const courseCount = useMemo(
    () => new Set(scopeRows.map((r) => r.course)).size,
    [scopeRows],
  );
  const chartTypes = availableChartTypes(sanitized, { courseCount });
  const chartType = effectiveChartType(sanitized, { courseCount });
  const breakdowns = availableBreakdowns(config.metric, role, scopeRows);
  const filterCount = activeFilterCount(sanitized.filters);
  const size = config.investigate ? 'L' : config.size;
  const isInvestigate = config.investigate !== undefined;

  return (
    <article
      className={styles.card}
      data-size={size}
      data-dragging={dragging || undefined}
      aria-label={config.title}
    >
      <header className={styles.header}>
        <button
          type="button"
          className={styles.handle}
          onPointerDown={onDragStart}
          aria-label="Drag to move module"
          title="Drag to move module"
        >
          <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
            <g fill="currentColor">
              <circle cx="2.5" cy="2" r="1.4" />
              <circle cx="7.5" cy="2" r="1.4" />
              <circle cx="2.5" cy="7" r="1.4" />
              <circle cx="7.5" cy="7" r="1.4" />
              <circle cx="2.5" cy="12" r="1.4" />
              <circle cx="7.5" cy="12" r="1.4" />
            </g>
          </svg>
        </button>
        <div className={styles.headText}>
          <Tip
            content={{
              title: config.title,
              body:
                config.title === def.label
                  ? def.description
                  : `${def.label} — ${def.description}`,
            }}
          >
            <h3 className={styles.title}>{config.title}</h3>
          </Tip>
          <Tip content={GLOSSARY[def.indicator]}>
            <span className={styles.indicator}>
              {def.indicator === 'lagging' ? 'After the fact' : 'Early warning'}
            </span>
          </Tip>
        </div>
        <div className={styles.headActions}>
          <div className={styles.filterWrap}>
            <Tip content={GLOSSARY.moduleFilter}>
              <button
                type="button"
                className={filterCount > 0 ? styles.filterBtnActive : styles.filterBtn}
                onClick={() => setFilterOpen((v) => !v)}
                aria-expanded={filterOpen}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
                  <path
                    d="M1.5 2h9L7 6.6V10l-2-1V6.6L1.5 2Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className={styles.filterText}>
                  Filter{filterCount > 0 ? ` · ${filterCount}` : ''}
                </span>
              </button>
            </Tip>
            {filterOpen && (
              <FilterPopup
                scopeRows={scopeRows}
                filters={sanitized.filters}
                onApply={(filters) => patch({ filters })}
                onClose={() => setFilterOpen(false)}
              />
            )}
          </div>
          {!isInvestigate && (
            <div className={styles.sizeSwitch} role="group" aria-label="Module size">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={s === size ? styles.sizeBtnActive : styles.sizeBtn}
                  aria-pressed={s === size}
                  onClick={() => patch({ size: s })}
                  title={s === 'S' ? 'Overview (small)' : s === 'M' ? 'Standard (wide)' : 'Detail (large)'}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className={styles.remove}
            onClick={() => dispatch({ type: 'remove-module', id: config.id })}
            aria-label="Remove module"
            title="Remove module"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {!isInvestigate && size !== 'S' && (
        <div className={styles.controls}>
          <label className={styles.control}>
            <span className={styles.controlLabel}>Compare with</span>
            <select
              className={styles.select}
              value={sanitized.compareTo}
              onChange={(e) => patch({ compareTo: e.target.value as CompareTo })}
              aria-label="Compare to baseline"
            >
              {availableCompareTos(config.metric).map((c) => (
                <option key={c} value={c}>
                  {COMPARE_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.control}>
            <span className={styles.controlLabel}>Split by</span>
            <select
              className={styles.select}
              value={sanitized.breakdown}
              onChange={(e) => patch({ breakdown: e.target.value as Dimension | 'none' })}
              aria-label="Break down by dimension"
            >
              {breakdowns.map((d) => (
                <option key={d} value={d}>
                  {d === 'none' ? 'None' : DIMENSION_META[d].label}
                </option>
              ))}
            </select>
          </label>
          {size === 'L' && chartTypes.length > 1 && (
            <div className={styles.chartTypes} role="group" aria-label="Chart type">
              {chartTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={t === chartType ? styles.typeBtnActive : styles.typeBtn}
                  aria-pressed={t === chartType}
                  onClick={() => patch({ chartType: t })}
                >
                  {CHART_LABEL[t]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={styles.chart}>
        {isInvestigate ? (
          <InvestigateView config={config} onPromote={patch} />
        ) : (
          <Chart type={chartType} size={size} data={data} />
        )}
      </div>

      {size === 'L' && !isInvestigate && (
        <div className={styles.tableRow}>
          <button
            type="button"
            className={styles.tableToggle}
            aria-expanded={config.showTable ?? false}
            onClick={() => patch({ showTable: !config.showTable })}
          >
            {config.showTable ? 'Hide student list' : 'Show student list'}
          </button>
          {config.showTable && <DataTable data={data} />}
        </div>
      )}

      <footer className={styles.footer}>
        <p className={styles.kicker}>{def.label}</p>
        <p className={styles.meta}>
          n = {data.n}
          {data.suppressedNote ? ` · ${data.suppressedNote}` : ''}
        </p>
      </footer>
    </article>
  );
}
