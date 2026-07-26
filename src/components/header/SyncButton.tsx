import { useData } from '../../context/DataContext';
import styles from './SyncButton.module.css';

/** FR2 — one click re-imports the data source and refreshes everything. */
export function SyncButton() {
  const { sync, status } = useData();
  const syncing = status.state === 'syncing';

  return (
    <button
      type="button"
      className={styles.button}
      onClick={sync}
      disabled={syncing}
      data-state={status.state}
      title="Re-import the data source (Static Tables-2.xlsx)"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={syncing ? styles.spin : undefined}
      >
        <path
          d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 1.8v2.7h-2.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {syncing ? 'Syncing…' : 'Sync'}
    </button>
  );
}
