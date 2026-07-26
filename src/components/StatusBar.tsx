import { useData } from '../context/DataContext';
import { useRole } from '../context/RoleContext';
import { ROLE_OPTIONS } from '../types';
import styles from './StatusBar.module.css';

/** FR1/FR2 — live status chips: source, last sync (+ mode), errors, role. */

const MODE_LABEL = {
  manual: 'synced manually',
  auto: 'auto-refreshed on load',
  file: 'loaded from file',
} as const;

function timeOf(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function StatusBar() {
  const { role, facultyProfessor } = useRole();
  const { meta, status } = useData();
  const roleLabel = ROLE_OPTIONS.find((r) => r.id === role)!.label;

  return (
    <footer className={styles.bar}>
      <span className={styles.chip}>
        <span
          className={styles.dot}
          data-tone={status.state === 'error' ? 'error' : meta ? 'ok' : 'pending'}
        />
        Data source: {meta ? `${meta.source} (${meta.rowCount} rows)` : 'none yet'}
      </span>
      <span className={styles.chip}>
        {status.state === 'syncing'
          ? 'Syncing…'
          : meta
            ? `Last sync: ${timeOf(meta.lastSynced)} · ${MODE_LABEL[meta.mode]}`
            : 'Last sync: —'}
      </span>
      {status.state === 'error' && (
        <span className={`${styles.chip} ${styles.errorChip}`} title={status.error}>
          <span className={styles.dot} data-tone="error" />
          Sync failed — showing previous data
        </span>
      )}
      <span className={styles.spacer} />
      <span className={styles.chip}>
        Viewing as: {roleLabel}
        {role === 'faculty' ? ` · ${facultyProfessor}` : ''}
      </span>
    </footer>
  );
}
