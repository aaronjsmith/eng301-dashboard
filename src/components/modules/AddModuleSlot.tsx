import { useEffect, useRef, useState } from 'react';
import type { ChartType, ModuleConfig } from '../../types';
import { useRole } from '../../context/RoleContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { freshId } from '../../state/ids';
import { flashCard } from './flash';
import styles from './AddModuleSlot.module.css';

const CHART_LABEL: Record<ChartType, string> = {
  donut: 'donut',
  bars: 'bars',
  pie: 'pie',
  area: 'area',
  heatmap: 'heatmap',
  divergingBar: 'gap bars',
};

/**
 * The dashed "new instance" slot — always reflows to the end of the roster.
 * Offers a blank module plus the three starting layouts as accordions: each
 * expands to its modules for one-at-a-time adds (menu stays open; the global
 * scope is untouched), with "Add all" appending the whole bundle.
 */
export function AddModuleSlot() {
  const { dispatch, bundles } = useWorkspace();
  const { role } = useRole();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setExpanded(null);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setExpanded(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const addBlank = () => {
    dispatch({
      type: 'add-module',
      config: {
        id: freshId('mod'),
        title: 'New chart',
        metric: 'passRate',
        chartType: 'donut',
        size: 'S',
        compareTo: 'none',
        breakdown: 'none',
        filters: {},
      },
    });
    close();
  };

  // Single module from a bundle: fresh id, no global-filter change, menu
  // stays open so several can be added in a row.
  const addOne = (template: ModuleConfig) => {
    const id = freshId(template.id);
    dispatch({ type: 'add-module', config: { ...template, id } });
    requestAnimationFrame(() => flashCard(id));
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.slot}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <path d="M14 5v18M5 14h18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        New chart
      </button>

      {open && (
        <div className={styles.menu} role="menu" aria-label="Add a chart">
          <button type="button" role="menuitem" className={styles.item} onClick={addBlank}>
            <span className={styles.itemTitle}>Blank chart</span>
            <span className={styles.itemSub}>Starts as a pass-rate chart — change it from there</span>
          </button>
          <p className={styles.menuHeading}>Ready-made layouts</p>
          {bundles.map((bundle) => {
            const isExpanded = expanded === bundle.id;
            const visibleModules = bundle.modules.filter(
              (m) => !m.visibleTo || m.visibleTo.includes(role),
            );
            return (
              <div key={bundle.id}>
                <button
                  type="button"
                  className={styles.bundleHead}
                  aria-expanded={isExpanded}
                  onClick={() => setExpanded(isExpanded ? null : bundle.id)}
                >
                  <span className={styles.bundleText}>
                    <span className={styles.itemTitle}>{bundle.label}</span>
                    <span className={styles.itemSub}>{bundle.description}</span>
                  </span>
                  <span className={styles.chevron} data-open={isExpanded || undefined} aria-hidden="true">
                    ▾
                  </span>
                </button>

                {isExpanded && (
                  <div className={styles.subList} role="group" aria-label={`${bundle.label} modules`}>
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.addAll}
                      onClick={() => {
                        dispatch({
                          type: 'add-bundle',
                          bundle,
                        });
                        close();
                      }}
                    >
                      ⊕ Add all ({bundle.modules.length})
                    </button>
                    {visibleModules.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="menuitem"
                        className={styles.subItem}
                        onClick={() => addOne(m)}
                      >
                        <span className={styles.itemTitle}>{m.title}</span>
                        <span className={styles.subMeta}>
                          {m.size} · {CHART_LABEL[m.chartType]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
