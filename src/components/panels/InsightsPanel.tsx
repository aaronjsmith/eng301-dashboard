import { useEffect, useState, type CSSProperties } from 'react';
import type {
  HighlightCategory,
  HighlightItem,
  PresetValue,
  Severity,
} from '../../types';
import { useHighlights, usePresets } from '../../hooks/useMetrics';
import { useWorkspace } from '../../context/WorkspaceContext';
import { metricDef } from '../../metrics/registry';
import styles from './Panel.module.css';

type TabId = 'presets' | 'highlights';

const KIND_LABEL = { kpi: 'Goal', kri: 'Warning' } as const;

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
 * Combined sidebar: Key numbers (presets) + Things to notice (highlights).
 * Preset rows are clickable — they spawn a chart module for that metric.
 */
export function InsightsPanel() {
  const [tab, setTab] = useState<TabId>('presets');
  const [pendingPresetId, setPendingPresetId] = useState<string | null>(null);
  const accent = (
    tab === 'presets'
      ? {
          '--panel-accent': 'var(--accent-presets)',
          '--panel-soft': 'var(--accent-presets-soft)',
          '--panel-soft-border': 'var(--accent-presets-border)',
        }
      : {
          '--panel-accent': 'var(--accent-highlights)',
          '--panel-soft': 'var(--accent-highlights-soft)',
          '--panel-soft-border': 'var(--accent-highlights-border)',
        }
  ) as CSSProperties;

  useEffect(() => {
    if (tab !== 'presets' || !pendingPresetId) return;
    const el = document.getElementById(`preset-${pendingPresetId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.animate(
      [{ outline: '2px solid var(--accent-presets)' }, { outline: '2px solid transparent' }],
      { duration: 1200 },
    );
    setPendingPresetId(null);
  }, [tab, pendingPresetId]);

  const showPreset = (presetId: string) => {
    setPendingPresetId(presetId);
    setTab('presets');
  };

  return (
    <section className={styles.panel} style={accent} aria-label="Key numbers and alerts">
      <p className={styles.kicker}>Start here</p>
      <h2 className={styles.title}>Insights</h2>
      <p className={styles.caption}>
        Key numbers everyone shares, plus alerts worth a closer look.
      </p>

      <div className={styles.tabs} role="tablist" aria-label="Insights sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'presets'}
          className={tab === 'presets' ? styles.tabActive : styles.tab}
          onClick={() => setTab('presets')}
        >
          Key numbers
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'highlights'}
          className={tab === 'highlights' ? styles.tabActive : styles.tab}
          onClick={() => setTab('highlights')}
        >
          Things to notice
        </button>
      </div>

      {tab === 'presets' ? (
        <PresetsTab />
      ) : (
        <HighlightsTab onJumpToPreset={showPreset} />
      )}
    </section>
  );
}

function PresetsTab() {
  const { panel } = usePresets();
  const { dispatch } = useWorkspace();

  const openPreset = (preset: PresetValue) => {
    const def = metricDef(preset.metric);
    dispatch({
      type: 'add-module',
      config: {
        id: freshId(`preset-${preset.id}`),
        title: preset.label,
        metric: preset.metric,
        chartType: def.defaultChart,
        size: 'M',
        compareTo: def.target ? 'target' : 'none',
        breakdown: 'none',
        filters: {},
      },
    });
  };

  return (
    <>
      <p className={styles.tabHint}>
        Click any number to open a chart about it on the dashboard.
      </p>
      <ul className={styles.list}>
        {panel.map((preset) => (
          <li key={preset.id} id={`preset-${preset.id}`}>
            <button
              type="button"
              className={styles.presetButton}
              onClick={() => openPreset(preset)}
              title={`Open a chart for ${preset.label}`}
            >
              <div className={styles.presetTop}>
                <span className={styles.presetLabel}>{preset.label}</span>
                <span className={styles.tag}>{KIND_LABEL[preset.kind]}</span>
              </div>
              <div className={styles.presetValueRow}>
                <span className={styles.presetValue}>{preset.formatted}</span>
                {preset.breach && (
                  <span className={styles.breach} data-severity={preset.breach.severity}>
                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                      <circle cx="5" cy="5" r="4" fill="currentColor" />
                    </svg>
                    {preset.breach.severity === 'critical' ? 'Needs attention' : 'Off goal'}
                  </span>
                )}
              </div>
              <p className={styles.presetDetail}>
                {preset.detail} · goal {preset.target}
              </p>
              <span className={styles.presetAction}>Open chart →</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function HighlightsTab({ onJumpToPreset }: { onJumpToPreset: (presetId: string) => void }) {
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

  return (
    <>
      <p className={styles.tabHint}>
        Alerts about gaps and risks. Use Investigate to dig into a problem.
      </p>
      <div className={styles.filterRow} role="group" aria-label="How serious">
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
      <div className={styles.filterRow} role="group" aria-label="Topic">
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
                  {h.severity === 'critical'
                    ? 'Critical'
                    : h.severity === 'notable'
                      ? 'Notable'
                      : 'Context'}
                </span>
                {h.linkedPresetId && (
                  <button
                    type="button"
                    className={styles.tagButton}
                    onClick={() => onJumpToPreset(h.linkedPresetId!)}
                    title={`Related key number ${h.linkedPresetId}`}
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
                  title="Open a detailed chart frozen to this group of students"
                >
                  Investigate →
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>
          Nothing at this level right now — try turning on Notable or Context.
        </p>
      )}
    </>
  );
}
