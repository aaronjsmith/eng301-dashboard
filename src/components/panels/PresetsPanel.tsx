import type { CSSProperties } from 'react';
import { usePresets } from '../../hooks/useMetrics';
import styles from './Panel.module.css';

const accent = {
  '--panel-accent': 'var(--accent-presets)',
  '--panel-soft': 'var(--accent-presets-soft)',
  '--panel-soft-border': 'var(--accent-presets-border)',
} as CSSProperties;

/**
 * Unique module: the predefined, non-configurable KPI/KRI presets (FR3),
 * computed live from the current scope. Breaches carry icon + label + color
 * (never color alone). Rows carry DOM ids so highlight rows can jump here.
 */
export function PresetsPanel() {
  const { panel } = usePresets();

  return (
    <section className={styles.panel} style={accent} aria-label="Presets">
      <p className={styles.kicker}>Unique module</p>
      <h2 className={styles.title}>Presets</h2>
      <p className={styles.caption}>Predefined KPIs / KRIs</p>
      <ul className={styles.list}>
        {panel.map((preset) => (
          <li key={preset.id} id={`preset-${preset.id}`} className={styles.presetRow}>
            <div className={styles.presetTop}>
              <span className={styles.presetLabel}>{preset.label}</span>
              <span className={styles.tag}>{preset.kind}</span>
            </div>
            <div className={styles.presetValueRow}>
              <span className={styles.presetValue}>{preset.formatted}</span>
              {preset.breach && (
                <span className={styles.breach} data-severity={preset.breach.severity}>
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                    <circle cx="5" cy="5" r="4" fill="currentColor" />
                  </svg>
                  {preset.breach.severity === 'critical' ? 'Breach' : 'Off target'}
                </span>
              )}
            </div>
            <p className={styles.presetDetail}>
              {preset.detail} · target {preset.target}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
