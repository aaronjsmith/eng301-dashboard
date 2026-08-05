import { useEffect, useMemo } from 'react';
import type { HighlightItem, ModuleConfig } from '../../types';
import { useRole } from '../../context/RoleContext';
import { useData } from '../../context/DataContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useHighlights, useModuleChartData, usePresets } from '../../hooks/useMetrics';
import { metricDef } from '../../metrics/registry';
import { Chart } from '../charts/Chart';
import { stampText } from './stamp';
import styles from './PrintReport.module.css';
import './print.css';

interface PrintReportProps {
  onDone: () => void;
}

/**
 * FR7 "Pertinent report" — the auto-composed one-pager: preset KPI values,
 * every currently-breached KRI with its highlight text, and the chart
 * belonging to each breach. Printed via the browser's print-to-PDF path
 * (@media print swaps the app shell for this component). Role gating is by
 * construction: everything renders from the exporter's role-scoped engine.
 */

/** Chart shown for each breached preset (falls back to the investigate slice). */
const BREACH_CHARTS: Record<string, Omit<ModuleConfig, 'id' | 'title'>> = {
  R1: {
    metric: 'genderGap',
    chartType: 'divergingBar',
    size: 'M',
    compareTo: 'none',
    breakdown: 'professor',
    filters: {},
  },
  R4: {
    metric: 'passRate',
    chartType: 'bars',
    size: 'M',
    compareTo: 'courseAvg',
    breakdown: 'firstGen',
    filters: {},
  },
  K5: {
    metric: 'passRate',
    chartType: 'bars',
    size: 'M',
    compareTo: 'courseAvg',
    breakdown: 'intensity',
    filters: {},
  },
  K4: {
    metric: 'passRate',
    chartType: 'bars',
    size: 'M',
    compareTo: 'courseAvg',
    breakdown: 'session',
    filters: {},
  },
};

function BreachBlock({ highlight }: { highlight: HighlightItem }) {
  const presetId = highlight.linkedPresetId ?? '';
  const template = BREACH_CHARTS[presetId];
  const config: ModuleConfig = useMemo(
    () =>
      template
        ? { ...template, id: `print-${highlight.id}`, title: highlight.label }
        : {
            id: `print-${highlight.id}`,
            title: highlight.label,
            metric: highlight.investigate?.metric ?? 'passRate',
            chartType: 'bars',
            size: 'M',
            compareTo: 'none',
            breakdown: 'none',
            filters: highlight.investigate?.slice ?? {},
          },
    [template, highlight],
  );
  const { data, sanitized } = useModuleChartData(config);

  return (
    <section className={styles.breach}>
      <h3 className={styles.breachTitle}>
        <span className={styles.sevIcon} data-severity={highlight.severity} aria-hidden="true" />
        {highlight.severity === 'critical' ? 'CRITICAL' : 'NOTABLE'} — {highlight.label}
        {highlight.linkedPresetId ? ` (${highlight.linkedPresetId})` : ''}
      </h3>
      <p className={styles.breachEvidence}>{highlight.evidence}</p>
      <div className={styles.breachChart}>
        <Chart
          type={sanitized.breakdown === 'none' ? 'bars' : config.chartType}
          size="M"
          data={data}
        />
        <p className={styles.chartCaption}>{metricDef(config.metric).label}</p>
      </div>
    </section>
  );
}

export function PrintReport({ onDone }: PrintReportProps) {
  const { role, facultyProfessor } = useRole();
  const { meta } = useData();
  const { globalFilters } = useWorkspace();
  const { all } = usePresets();
  const highlights = useHighlights();

  useEffect(() => {
    // Give charts a paint + ResizeObserver pass before opening the dialog.
    const timer = setTimeout(() => window.print(), 350);
    const done = () => onDone();
    window.addEventListener('afterprint', done);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', done);
    };
  }, [onDone]);

  const kpis = all.filter((p) => p.kind === 'kpi' && (!p.roles || p.roles.includes(role)));
  const breachedIds = new Set(
    all.filter((p) => p.breach && (!p.roles || p.roles.includes(role))).map((p) => p.id),
  );
  const breachHighlights = highlights.filter(
    (h) =>
      !h.suppressed &&
      (h.severity === 'critical' ||
        (h.linkedPresetId !== undefined && breachedIds.has(h.linkedPresetId))),
  );

  const scopeLine = stampText(role, facultyProfessor, meta, globalFilters);

  return (
    <div className={`${styles.report} print-report`}>
      <header className={styles.head}>
        <h1 className={styles.title}>Student Outcomes — Summary Report</h1>
        <p className={styles.subtitle}>ENG 201 · how students are doing</p>
      </header>

      <section className={styles.kpiStrip}>
        {kpis.map((p) => (
          <div key={p.id} className={styles.kpi}>
            <span className={styles.kpiLabel}>
              {p.id} · {p.label}
            </span>
            <span className={styles.kpiValue}>{p.formatted}</span>
            <span className={styles.kpiTarget}>target {p.target}</span>
          </div>
        ))}
      </section>

      {breachHighlights.length > 0 ? (
        breachHighlights.map((h) => <BreachBlock key={h.id} highlight={h} />)
      ) : (
        <p className={styles.calm}>
          Nothing needs attention for this view — all key numbers are on track.
        </p>
      )}

      <footer className={styles.stamp}>{scopeLine}</footer>
    </div>
  );
}
