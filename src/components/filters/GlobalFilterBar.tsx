import { useEffect, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useRole } from '../../context/RoleContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { SESSION_ORDER, type Dimension } from '../../types';
import styles from './GlobalFilterBar.module.css';

/**
 * FR5 — global population filter as a single button menu. Course · session ·
 * professor (chair/admin) set the outer scope every panel uses.
 */
export function GlobalFilterBar() {
  const { role } = useRole();
  const { meta, professors } = useData();
  const { globalFilters, dispatch } = useWorkspace();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const setDim = (dim: Dimension, value: string | null) => {
    const next = { ...globalFilters };
    if (value === null) delete next[dim];
    else next[dim] = [value];
    dispatch({ type: 'set-global', filters: next });
  };

  const activeCount = Object.keys(globalFilters).length;
  const summaryParts: string[] = [];
  if (globalFilters.course?.[0]) summaryParts.push(globalFilters.course[0]);
  if (globalFilters.session?.[0]) summaryParts.push(globalFilters.session[0]);
  if (globalFilters.professor?.[0]) {
    summaryParts.push(globalFilters.professor[0].replace(/^Professor\s+/i, ''));
  }
  const summary =
    summaryParts.length > 0 ? summaryParts.join(' · ') : 'All courses & sessions';

  const group = (dim: Dimension, label: string, values: string[]) => {
    const active = globalFilters[dim]?.[0] ?? null;
    return (
      <div className={styles.group} role="group" aria-label={`${label} filter`}>
        <span className={styles.groupLabel}>{label}</span>
        <div className={styles.chips}>
          <button
            type="button"
            className={active === null ? styles.chipActive : styles.chip}
            onClick={() => setDim(dim, null)}
          >
            All
          </button>
          {values.map((value) => (
            <button
              key={value}
              type="button"
              className={active === value ? styles.chipActive : styles.chip}
              onClick={() => setDim(dim, value)}
            >
              {dim === 'professor' ? value.replace(/^Professor\s+/i, '') : value}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.wrap} ref={rootRef}>
      <button
        type="button"
        className={activeCount > 0 ? styles.buttonActive : styles.button}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M1.5 2h9L7 6.6V10l-2-1V6.6L1.5 2Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
        Filters{activeCount > 0 ? ` · ${activeCount}` : ''}
        <span className={styles.summary}>{summary}</span>
      </button>

      {open && (
        <div className={styles.menu} role="dialog" aria-label="Dashboard filters">
          <p className={styles.menuHint}>
            Narrow everything on the dashboard — key numbers, alerts, and charts all
            use the same filter.
          </p>
          {group('course', 'Course', meta?.courses ?? [])}
          {group('session', 'Session', [...SESSION_ORDER])}
          {role !== 'faculty' && group('professor', 'Professor', professors)}
          <div className={styles.menuFooter}>
            <button
              type="button"
              className={styles.clear}
              onClick={() => dispatch({ type: 'set-global', filters: {} })}
            >
              Clear all filters
            </button>
            <button type="button" className={styles.done} onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
