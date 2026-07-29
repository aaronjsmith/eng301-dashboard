import { useRef, useState } from 'react';
import { TitleBar } from './components/header/TitleBar';
import { SyncButton } from './components/header/SyncButton';
import { ExportButton, type ExportMode } from './components/header/ExportButton';
import { LoadFileButton } from './components/header/LoadFileButton';
import { MagneticToggle, ThemeToggle } from './components/header/Toggles';
import { GlobalFilterBar } from './components/filters/GlobalFilterBar';
import { PresetsPanel } from './components/panels/PresetsPanel';
import { AlertsPanel } from './components/panels/AlertsPanel';
import { ModuleGrid } from './components/modules/ModuleGrid';
import { StatusBar } from './components/StatusBar';
import { PrintReport } from './components/export/PrintReport';
import { exportCurrentView } from './components/export/exportPng';
import { stampText } from './components/export/stamp';
import { useData } from './context/DataContext';
import { useRole } from './context/RoleContext';
import { useWorkspace } from './context/WorkspaceContext';
import styles from './App.module.css';

export default function App() {
  const { ready, status, meta } = useData();
  const { role, facultyProfessor } = useRole();
  const { globalFilters } = useWorkspace();
  const bodyRef = useRef<HTMLElement>(null);
  const [printing, setPrinting] = useState(false);

  const handleExport = (mode: ExportMode) => {
    if (mode === 'view') {
      // FR7 "Current view" — the dashboard exactly as displayed.
      if (bodyRef.current) {
        void exportCurrentView(
          bodyRef.current,
          stampText(role, facultyProfessor, meta, globalFilters),
          role,
        );
      }
    } else {
      // FR7 "Pertinent report" — print-stylesheet PDF path.
      setPrinting(true);
    }
  };

  if (!ready) {
    return (
      <div className={styles.boot}>
        {status.state === 'error' ? (
          <div className={styles.bootError}>
            <h1>Could not load the data source</h1>
            <pre>{status.error}</pre>
          </div>
        ) : (
          <p>Loading data…</p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={`${styles.app} app-shell`}>
        <TitleBar />

        <div className={styles.toolbar}>
          <GlobalFilterBar />
          <span className={styles.spacer} />
          <div className={styles.actions}>
            <MagneticToggle />
            <ThemeToggle />
            <LoadFileButton />
            <SyncButton />
            <ExportButton onExport={handleExport} />
          </div>
        </div>

        <main className={styles.body} ref={bodyRef}>
          <aside className={styles.sidebar}>
            <AlertsPanel />
            <PresetsPanel />
          </aside>
          <ModuleGrid />
        </main>

        <StatusBar />
      </div>

      {printing && <PrintReport onDone={() => setPrinting(false)} />}
    </>
  );
}
