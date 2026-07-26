import { useRef } from 'react';
import { useData } from '../../context/DataContext';
import styles from './LoadFileButton.module.css';

/**
 * FR1 — point the dashboard at any XLSX or CSV with the workbook schema
 * (CSV parity: one file, Course column + the 14 workbook columns).
 */
export function LoadFileButton() {
  const { loadFromFile, status } = useData();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        className={styles.button}
        onClick={() => inputRef.current?.click()}
        disabled={status.state === 'syncing'}
        title="Import an XLSX or CSV file with the Static Tables schema"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M8 10.5V2.5m0 0L4.8 5.7M8 2.5l3.2 3.2M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Load file…
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv"
        className={styles.input}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadFromFile(file);
          e.target.value = ''; // allow re-picking the same file
        }}
      />
    </>
  );
}
