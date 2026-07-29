import { useEffect, useRef, useState } from 'react';
import styles from './ExportButton.module.css';

export type ExportMode = 'report' | 'view';

interface ExportButtonProps {
  onExport: (mode: ExportMode) => void;
}

/**
 * FR7 — the wireframe's "X" button. Click opens the mode choice: Pertinent
 * report (print-stylesheet PDF, default) or Current view (PNG capture).
 * Every export is role-gated and stamped by the export pipeline.
 */
export function ExportButton({ onExport }: ExportButtonProps) {
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

  const pick = (mode: ExportMode) => {
    setOpen(false);
    onExport(mode);
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.button}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Export report"
        title="Export report"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M3.5 3.5 14.5 14.5 M14.5 3.5 3.5 14.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div className={styles.menu} role="menu" aria-label="Export mode">
          <button type="button" role="menuitem" className={styles.item} onClick={() => pick('report')}>
            <span className={styles.itemTitle}>Summary report</span>
            <span className={styles.itemSub}>
              One-page PDF: goal numbers plus every warning that needs attention, with its chart
            </span>
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={() => pick('view')}>
            <span className={styles.itemTitle}>Current view</span>
            <span className={styles.itemSub}>
              PNG of the dashboard exactly as displayed
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
