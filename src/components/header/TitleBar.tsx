import { ViewSwitcher } from './ViewSwitcher';
import styles from './TitleBar.module.css';

export function TitleBar() {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true" />
        <div>
          <h1 className={styles.title}>Student Outcomes Dashboard</h1>
          <p className={styles.subtitle}>ENG 201 · Core Competency Throughput</p>
        </div>
      </div>
      <ViewSwitcher />
    </header>
  );
}
