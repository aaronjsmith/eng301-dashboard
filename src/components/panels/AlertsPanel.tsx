import { useState } from 'react';
import type { HighlightItem } from '../../types';
import { useHighlights } from '../../hooks/useMetrics';
import { useWorkspace } from '../../context/WorkspaceContext';
import { metricDef } from '../../metrics/registry';
import { freshId } from '../../state/ids';
import { flashCard } from '../modules/flash';
import { Tip } from '../ui/Tip';
import styles from './AlertsPanel.module.css';

/**
 * The simple critical-case notification that replaced the Highlights panel:
 * a foldable "!" pill with a count; expanding it lists critical items only
 * (label + evidence). Investigate still spawns the frozen root-cause card.
 * Renders nothing at all when the current scope has no critical cases.
 */
export function AlertsPanel() {
  const critical = useHighlights().filter((h) => h.severity === 'critical');
  const { dispatch } = useWorkspace();
  const [open, setOpen] = useState(false);

  if (critical.length === 0) return null;

  const investigate = (h: HighlightItem) => {
    if (!h.investigate) return;
    const id = freshId('inv');
    dispatch({
      type: 'add-module',
      config: {
        id,
        title: `Look closer: ${h.label}`,
        metric: h.investigate.metric,
        chartType: metricDef(h.investigate.metric).defaultChart,
        size: 'L',
        compareTo: 'none',
        breakdown: 'none',
        filters: {},
        investigate: h.investigate,
      },
    });
    requestAnimationFrame(() => flashCard(id));
  };

  return (
    <section className={styles.alerts} aria-label="Critical alerts">
      <Tip
        content={{
          title: 'Needs attention',
          body: 'Problems in the current data that should be looked at now. Click to show or hide the list.',
        }}
      >
        <button
          type="button"
          className={styles.pill}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={styles.bang} aria-hidden="true">
            !
          </span>
          {critical.length} need{critical.length === 1 ? 's' : ''} attention
          <span className={styles.chevron} data-open={open || undefined} aria-hidden="true">
            ▾
          </span>
        </button>
      </Tip>

      {open && (
        <ul className={styles.list}>
          {critical.map((h) => (
            <li key={h.id} className={styles.item}>
              <p className={styles.label}>{h.label}</p>
              <p className={styles.evidence}>{h.evidence}</p>
              {h.investigate && !h.suppressed && (
                <button
                  type="button"
                  className={styles.investigate}
                  onClick={() => investigate(h)}
                >
                  Look closer →
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
