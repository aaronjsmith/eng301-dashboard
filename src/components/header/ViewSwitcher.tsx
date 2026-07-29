import { useEffect, useRef, useState } from 'react';
import { useRole } from '../../context/RoleContext';
import { useData } from '../../context/DataContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ROLE_OPTIONS } from '../../types';
import styles from './ViewSwitcher.module.css';

/**
 * FR4 — the VIEW dropdown. A view is not a saved filter: it changes which
 * presets, highlights, and dimensions exist. Selecting Faculty reveals the
 * professor picker — the faculty view is row-scoped to those sections.
 */
export function ViewSwitcher() {
  const { role, setRole, facultyProfessor, setFacultyProfessor } = useRole();
  const { professors } = useData();
  const { dispatch } = useWorkspace();
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

  const active = ROLE_OPTIONS.find((r) => r.id === role)!;

  return (
    <div className={styles.wrap}>
      {role === 'faculty' && professors.length > 0 && (
        <label className={styles.professorPick}>
          <span className={styles.pickLabel}>Viewing as</span>
          <select
            value={facultyProfessor}
            onChange={(e) => setFacultyProfessor(e.target.value)}
            aria-label="Faculty professor"
          >
            {professors.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className={styles.root} ref={rootRef}>
        <button
          type="button"
          className={styles.trigger}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={styles.label}>View</span>
          <span className={styles.value}>{active.label}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M2.5 4.5 6 8l3.5-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && (
          <ul className={styles.menu} role="listbox" aria-label="View as role">
            {ROLE_OPTIONS.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.id === role}
                  className={option.id === role ? styles.itemActive : styles.item}
                  onClick={() => {
                    setRole(option.id);
                    setOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  <span className={styles.scope}>{option.scope}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        className={styles.reset}
        aria-label="Reset layout and filters"
        title="Reset layout and filters"
        onClick={() => dispatch({ type: 'reset-layout' })}
      >
        Reset
      </button>
    </div>
  );
}
