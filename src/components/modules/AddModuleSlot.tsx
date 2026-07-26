import { useEffect, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import styles from './AddModuleSlot.module.css';

function freshId(base: string): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${base}-${suffix}`;
}

/**
 * The dashed "new instance" slot — always reflows to the end of the roster.
 * Offers a blank module plus the three ready-made bundles (Overview /
 * Course Detail / Equity starting layouts).
 */
export function AddModuleSlot() {
  const { dispatch, bundles } = useWorkspace();
  const { meta } = useData();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const addBlank = () => {
    dispatch({
      type: 'add-module',
      config: {
        id: freshId('mod'),
        title: 'New module',
        metric: 'passRate',
        chartType: 'donut',
        size: 'S',
        compareTo: 'target',
        breakdown: 'none',
        filters: {},
      },
    });
    setOpen(false);
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.slot}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <path d="M14 5v18M5 14h18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        New module
      </button>

      {open && (
        <div className={styles.menu} role="menu" aria-label="Add module">
          <button type="button" role="menuitem" className={styles.item} onClick={addBlank}>
            <span className={styles.itemTitle}>Blank module</span>
            <span className={styles.itemSub}>Pass-rate donut — configure from there</span>
          </button>
          <p className={styles.menuHeading}>Starting layouts</p>
          {bundles.map((bundle) => (
            <button
              key={bundle.id}
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => {
                dispatch({
                  type: 'add-bundle',
                  bundle,
                  courses: meta?.courses ?? [],
                });
                setOpen(false);
              }}
            >
              <span className={styles.itemTitle}>{bundle.label}</span>
              <span className={styles.itemSub}>{bundle.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
