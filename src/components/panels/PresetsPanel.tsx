import type { CSSProperties } from 'react';
import type { PresetValue } from '../../types';
import { usePresets } from '../../hooks/useMetrics';
import { useRole } from '../../context/RoleContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { metricDef } from '../../metrics/registry';
import { freshId } from '../../state/ids';
import { flashCard } from '../modules/flash';
import { Tip } from '../ui/Tip';
import styles from './Panel.module.css';

const accent = {
  '--panel-accent': 'var(--accent-presets)',
  '--panel-soft': 'var(--accent-presets-soft)',
  '--panel-soft-border': 'var(--accent-presets-border)',
} as CSSProperties;

/**
 * Unique module: the predefined KPI/KRI presets (FR3) as a simple clickable
 * list — name + live value only. Clicking opens the preset as a card in the
 * grid; if a card for that metric already exists, it flashes instead of
 * duplicating. The full explanation (incl. target) lives in the hover tip.
 */
export function PresetsPanel() {
  const { panel } = usePresets();
  const { modules, dispatch } = useWorkspace();
  const { role } = useRole();

  const openPreset = (preset: PresetValue) => {
    const existing = modules.find(
      (m) =>
        m.metric === preset.metric &&
        !m.investigate &&
        (!m.visibleTo || m.visibleTo.includes(role)),
    );
    if (existing) {
      flashCard(existing.id);
      return;
    }
    const def = metricDef(preset.metric);
    const id = freshId('preset');
    dispatch({
      type: 'add-module',
      config: {
        id,
        title: preset.label,
        metric: preset.metric,
        chartType: def.defaultChart,
        size: 'M',
        compareTo: 'none',
        breakdown: 'none',
        filters: {},
      },
    });
    requestAnimationFrame(() => flashCard(id));
  };

  return (
    <section className={styles.panel} style={accent} aria-label="Key numbers">
      <p className={styles.kicker}>Start here</p>
      <h2 className={styles.title}>Key numbers</h2>
      <p className={styles.caption}>Click one to open a chart about it</p>
      <ul className={styles.list}>
        {panel.map((preset) => (
          <li key={preset.id}>
            <Tip
              content={{
                title: preset.label,
                body: preset.description,
                note: 'Click to open a chart',
              }}
            >
              <button
                type="button"
                className={styles.presetButton}
                onClick={() => openPreset(preset)}
              >
                <span className={styles.presetLabel}>{preset.label}</span>
                <span className={styles.presetMeta}>
                  <span className={styles.presetValue}>{preset.formatted}</span>
                  <span
                    className={
                      preset.kind === 'kpi' ? styles.tagGoal : styles.tagWarn
                    }
                  >
                    {preset.kind === 'kpi' ? 'Goal' : 'Warning'}
                  </span>
                </span>
              </button>
            </Tip>
          </li>
        ))}
      </ul>
    </section>
  );
}
