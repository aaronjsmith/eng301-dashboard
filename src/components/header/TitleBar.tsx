import { ViewSwitcher } from './ViewSwitcher';
import styles from './TitleBar.module.css';

export function TitleBar() {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <img
          className={styles.logo}
          src="/ensign-logo.png"
          alt="Ensign College"
          height={40}
        />
        <div>
          <h1 className={styles.title}>Student Outcomes Dashboard</h1>
          <p className={styles.subtitle}>ENG 201 · how students are doing</p>
        </div>
      </div>
      <ViewSwitcher />
    </header>
  );
}
