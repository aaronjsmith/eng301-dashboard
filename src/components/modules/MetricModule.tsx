import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ChartType, CompareTo, Dimension, ModuleConfig, SizeTier } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useModuleChartData } from '../../hooks/useMetrics';
import { useRole } from '../../context/RoleContext';
import { metricDef } from '../../metrics/registry';
import {
  availableBreakdowns,
  availableChartTypes,
  availableCompareTos,
  breakdownChain,
  effectiveChartType,
  MAX_BREAKDOWN_DEPTH,
} from '../../metrics/availability';
import { activeFilterCount, DIMENSION_META } from '../../metrics/scope';
import { GLOSSARY } from '../../metrics/glossary';
import { Chart } from '../charts/Chart';
import { FilterPopup } from '../filters/FilterPopup';
import { Tip } from '../ui/Tip';
import { DataTable } from './DataTable';
import { InvestigateView } from './InvestigateView';
import { useDashboardScope } from '../../hooks/useMetrics';
import { studentsLabel } from '../../metrics/format';
import styles from './MetricModule.module.css';

interface MetricModuleProps {
  config: ModuleConfig;
  /** Lone card in the grid — fill height and keep the student list open. */
  solo?: boolean;
  onDragStart?: (e: ReactPointerEvent<HTMLElement>) => void;
  dragging?: boolean;
}

const SIZES: SizeTier[] = ['S', 'M', 'L'];

const COMPARE_LABEL: Record<CompareTo, string> = {
  none: 'Nothing',
  median: 'Median value',
  priorSession: 'Previous term',
  sameTermLastYear: 'Same term last year',
  courseAvg: 'Course average',
};

const CHART_LABEL: Record<ChartType, string> = {
  bars: 'Bars',
  pie: 'Pie',
  area: 'Area',
  heatmap: 'Heatmap',
  divergingBar: 'Gap bars',
};

/**
 * THE repeatable module — every blue box is one of these, instantiated from a
 * ModuleConfig. Controls scale with the size tier (S: filter badge only;
 * M: + the two comparison dropdowns; L: full chart-type row); the student-list
 * toggle stays available at every size. Hidden controls stay active — a
 * filtered S-tile still shows filtered numbers (FR5).
 */
export function MetricModule({ config, solo, onDragStart, dragging }: MetricModuleProps) {
  const { dispatch } = useWorkspace();
  const { role } = useRole();
  const { scopeRows } = useDashboardScope();
  const { data, sanitized } = useModuleChartData(config);
  const [filterOpen, setFilterOpen] = useState(false);
  const [drillKey, setDrillKey] = useState<string | null>(null);

  const def = metricDef(config.metric);
  const patch = (p: Partial<ModuleConfig>) =>
    dispatch({ type: 'update-module', id: config.id, patch: p });

  useEffect(() => {
    setDrillKey(null);
  }, [config.metric, config.breakdown, config.thenBy, config.filters, config.id]);

  const courseCount = useMemo(
    () => new Set(scopeRows.map((r) => r.course)).size,
    [scopeRows],
  );
  const chartTypes = availableChartTypes(sanitized, { courseCount });
  const chartType = effectiveChartType(sanitized, { courseCount });
  const breakdowns = availableBreakdowns(config.metric, role, scopeRows);
  const activeSplits = breakdownChain(sanitized);
  /** Cascading selects: one slot per active dim, plus an empty "then by" when room remains. */
  const splitSlots: (Dimension | 'none')[] =
    activeSplits.length === 0
      ? ['none']
      : activeSplits.length < MAX_BREAKDOWN_DEPTH
        ? [...activeSplits, 'none']
        : [...activeSplits];

  const setSplitAt = (index: number, value: Dimension | 'none') => {
    if (index === 0) {
      if (value === 'none') {
        patch({ breakdown: 'none', thenBy: undefined });
        return;
      }
      const rest = activeSplits.slice(1).filter((d) => d !== value);
      patch({ breakdown: value, thenBy: rest.length ? rest : undefined });
      return;
    }
    const next = [...activeSplits];
    if (value === 'none') {
      next.splice(index);
    } else {
      next[index] = value;
      // Drop later slots that collide with the new choice.
      for (let i = next.length - 1; i > index; i--) {
        if (next[i] === value) next.splice(i, 1);
      }
    }
    const [primary, ...thenBy] = next;
    if (!primary) {
      patch({ breakdown: 'none', thenBy: undefined });
      return;
    }
    patch({ breakdown: primary, thenBy: thenBy.length ? thenBy : undefined });
  };

  const optionsForSlot = (index: number): (Dimension | 'none')[] => {
    const usedEarlier = new Set(activeSplits.slice(0, index));
    return breakdowns.filter((d) => d === 'none' || !usedEarlier.has(d));
  };

  const filterCount = activeFilterCount(sanitized.filters);
  const size = config.investigate ? 'L' : config.size;
  const isInvestigate = config.investigate !== undefined;
  const tableOpen = Boolean(solo) || Boolean(config.showTable) || drillKey !== null;

  const selectPoint = (key: string | null) => {
    setDrillKey(key);
    if (key && !config.showTable && !solo) {
      patch({ showTable: true });
    }
  };

  return (
    <article
      className={styles.card}
      data-size={size}
      data-solo={solo || undefined}
      data-table-open={tableOpen || undefined}
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
          {def.indicator === 'leading' && (
            <Tip content={GLOSSARY.leading}>
              <span className={styles.indicator}>Opportunities</span>
            </Tip>
          )}
          <p className={styles.description}>
            {config.title === def.label
              ? def.description
              : `${def.label} — ${def.description}`}
          </p>
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
          {splitSlots.map((value, index) => (
            <label key={index} className={styles.control}>
              <span className={styles.controlLabel}>
                {index === 0 ? 'Split by' : 'Then by'}
              </span>
              <select
                className={styles.select}
                value={value}
                onChange={(e) => setSplitAt(index, e.target.value as Dimension | 'none')}
                aria-label={index === 0 ? 'Break down by dimension' : `Then by dimension ${index + 1}`}
              >
                {optionsForSlot(index).map((d) => (
                  <option key={d} value={d}>
                    {d === 'none' ? 'None' : DIMENSION_META[d].label}
                  </option>
                ))}
              </select>
            </label>
          ))}
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
          <Chart
            type={chartType}
            size={size}
            data={data}
            selectedKey={drillKey}
            onSelect={selectPoint}
          />
        )}
      </div>

      {!isInvestigate && (
        <div className={styles.tableRow}>
          <button
            type="button"
            className={styles.tableToggle}
            aria-expanded={tableOpen}
            onClick={() => {
              if (tableOpen) setDrillKey(null);
              patch({ showTable: !tableOpen });
            }}
          >
            {tableOpen ? 'Hide student list' : 'Show student list'}
          </button>
          {tableOpen && (
            <DataTable
              data={data}
              expanded={solo}
              selectedKey={drillKey}
              metric={config.metric}
              breakdown={sanitized.breakdown}
              thenBy={sanitized.thenBy}
              onClearSelection={() => setDrillKey(null)}
            />
          )}
        </div>
      )}

      <footer className={styles.footer}>
        <p className={styles.kicker}>{def.label}</p>
        <p className={styles.meta}>
          {studentsLabel(data.n)}
          {data.suppressedNote ? ` · ${data.suppressedNote}` : ''}
        </p>
      </footer>
    </article>
  );
}
