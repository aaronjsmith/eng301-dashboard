import { useState, type CSSProperties } from 'react';
import type { HighlightCategory, HighlightItem, Severity } from '../../types';
import { useHighlights } from '../../hooks/useMetrics';
import { useWorkspace } from '../../context/WorkspaceContext';
import { metricDef } from '../../metrics/registry';
import styles from './Panel.module.css';

const accent = {
  '--panel-accent': 'var(--accent-highlights)',
  '--panel-soft': 'var(--accent-highlights-soft)',
  '--panel-soft-border': 'var(--accent-highlights-border)',
} as CSSProperties;

const SEVERITIES: { id: Severity; label: string }[] = [
  { id: 'critical', label: 'Critical' },
  { id: 'notable', label: 'Notable' },
  { id: 'context', label: 'Context' },
];

const CATEGORIES: { id: HighlightCategory; label: string }[] = [
  { id: 'equity', label: 'Equity' },
  { id: 'instructor', label: 'Instructor' },
  { id: 'session', label: 'Session' },
  { id: 'course', label: 'Course' },
];

function freshId(base: string): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${base}-${suffix}`;
}

/**
 * Unique module: "what should you look at today" (FR6). Severity filter
 * defaults to Critical-only; the category filter narrows within what the role
 * may see (role gating happened upstream — it is not a filter). Every 🔴/🟡
 * row carries Investigate: it spawns a pre-configured module frozen to the
 * highlight's slice (spec §3 root-cause mode).
 */
export function HighlightsPanel() {
  const highlights = useHighlights();
  const { dispatch } = useWorkspace();
  const [severities, setSeverities] = useState<Set<Severity>>(new Set(['critical']));
  const [category, setCategory] = useState<HighlightCategory | null>(null);

  const toggleSeverity = (s: Severity) =>
    setSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next.size === 0 ? new Set<Severity>(['critical']) : next;
    });

  const visible = highlights.filter(
    (h) => severities.has(h.severity) && (category === null || h.category === category),
  );

  const investigate = (h: HighlightItem) => {
    if (!h.investigate) return;
    dispatch({
      type: 'add-module',
      config: {
        id: freshId('inv'),
        title: `Investigate: ${h.label}`,
        metric: h.investigate.metric,
        chartType: metricDef(h.investigate.metric).defaultChart,
        size: 'L',
        compareTo: 'none',
        breakdown: 'none',
        filters: {},
        investigate: h.investigate,
      },
    });
  };

  const jumpToPreset = (presetId: string) => {
    const el = document.getElementById(`preset-${presetId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.animate(
      [{ outline: '2px solid var(--accent-presets)' }, { outline: '2px solid transparent' }],
      { duration: 1200 },
    );
  };

  return (
    <section className={styles.panel} style={accent} aria-label="Highlights">
      <p className={styles.kicker}>Unique module</p>
      <h2 className={styles.title}>Highlights</h2>
      <p className={styles.caption}>Role-based alerts &amp; discrepancies</p>

      <div className={styles.filterRow} role="group" aria-label="Severity filter">
        {SEVERITIES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={severities.has(s.id) ? styles.filterChipActive : styles.filterChip}
            data-severity={s.id}
            aria-pressed={severities.has(s.id)}
            onClick={() => toggleSeverity(s.id)}
          >
            <span className={styles.sevDot} data-severity={s.id} aria-hidden="true" />
            {s.label}
          </button>
        ))}
      </div>
      <div className={styles.filterRow} role="group" aria-label="Category filter">
        <button
          type="button"
          className={category === null ? styles.filterChipActive : styles.filterChip}
          aria-pressed={category === null}
          onClick={() => setCategory(null)}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={category === c.id ? styles.filterChipActive : styles.filterChip}
            aria-pressed={category === c.id}
            onClick={() => setCategory((prev) => (prev === c.id ? null : c.id))}
          >
            {c.label}
          </button>
        ))}
      </div>

      {visible.length > 0 ? (
        <ul className={styles.list}>
          {visible.map((h) => (
            <li
              key={h.id}
              className={h.suppressed ? styles.suppressedRow : styles.highlightRow}
              data-severity={h.severity}
            >
              <div className={styles.highlightHead}>
                <span className={styles.sevBadge} data-severity={h.severity}>
                  <span className={styles.sevDot} data-severity={h.severity} aria-hidden="true" />
                  {h.severity === 'critical' ? 'Critical' : h.severity === 'notable' ? 'Notable' : 'Context'}
                </span>
                {h.linkedPresetId && (
                  <button
                    type="button"
                    className={styles.tagButton}
                    onClick={() => jumpToPreset(h.linkedPresetId!)}
                    title={`Jump to preset ${h.linkedPresetId}`}
                  >
                    {h.linkedPresetId}
                  </button>
                )}
              </div>
              <p className={styles.highlightLabel}>{h.label}</p>
              <p className={styles.evidence}>{h.evidence}</p>
              {h.investigate && !h.suppressed && (
                <button
                  type="button"
                  className={styles.investigate}
                  onClick={() => investigate(h)}
                  title="Spawn a module frozen to this slice with a dimension scan"
                >
                  Investigate →
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Nothing at this severity for this role — widen the filter</p>
      )}
    </section>
  );
}
