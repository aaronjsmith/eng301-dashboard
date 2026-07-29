import { useData } from '../../context/DataContext';
import { useRole } from '../../context/RoleContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { SESSION_ORDER, type Dimension } from '../../types';
import { GLOSSARY } from '../../metrics/glossary';
import { Tip } from '../ui/Tip';
import styles from './GlobalFilterBar.module.css';

/**
 * FR5 — the global filter bar: the outer population every panel computes
 * against (presets, highlights, every module). Course · year · session ·
 * professor (chair/admin only; faculty are row-scoped already). Module
 * popups narrow WITHIN this scope.
 */
export function GlobalFilterBar() {
  const { role } = useRole();
  const { professors, years, meta } = useData();
  const { globalFilters, dispatch } = useWorkspace();

  const setDim = (dim: Dimension, value: string | null) => {
    const next = { ...globalFilters };
    if (value === null) delete next[dim];
    else next[dim] = [value];
    dispatch({ type: 'set-global', filters: next });
  };

  const group = (dim: Dimension, label: string, values: string[]) => {
    const active = globalFilters[dim]?.[0] ?? null;
    return (
      <div className={styles.group} role="group" aria-label={`${label} scope`}>
        <Tip content={GLOSSARY.globalScope}>
          <span className={styles.label}>{label}</span>
        </Tip>
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
              {dim === 'professor' ? value.replace('Professor ', '') : value}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const courses = meta?.courses ?? [];

  return (
    <div className={styles.bar}>
      {courses.length > 0 && group('course', 'Course', courses)}
      {years.length > 1 && group('year', 'Year', years)}
      {group('session', 'Session', [...SESSION_ORDER])}
      {role !== 'faculty' && group('professor', 'Professor', professors)}
    </div>
  );
}
