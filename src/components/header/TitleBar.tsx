import { ViewSwitcher } from './ViewSwitcher';
import styles from './TitleBar.module.css';

export function TitleBar() {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <img
          className={styles.logo}
          src="/ensign-logo.svg"
          alt="Ensign College"
          width={40}
          height={42}
        />
        <div>
          <h1 className={styles.title}>Student Outcomes Dashboard</h1>
          <p className={styles.subtitle}>ENG 201 · Core Competency Throughput</p>
        </div>
      </div>
      <ViewSwitcher />
    </header>
  );
}
