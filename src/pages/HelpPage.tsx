import styles from './HelpPage.module.css';

const TC01_STEPS = [
  {
    action:
      'Open Dashboard_Prototype folder, double-click mac_run.command (Mac) or win_run.bat (Windows).',
    expected:
      'Terminal opens, installs packages on first run, browser opens http://localhost:5173.',
  },
  {
    action: 'Wait for dashboard to load.',
    expected:
      'Title bar shows “Student Outcomes Dashboard — ENG 201 · Core Competency Throughput” and a metric card grid.',
  },
  {
    action: 'Read status bar.',
    expected:
      'Data source Static Tables-2.xlsx (ENG 201 rows only), last-sync time, Viewing as Faculty Professor A.',
  },
  {
    action: 'Check filter chips.',
    expected: 'Year 2026 selected by default; no Course chip (ENG 201 only).',
  },
  {
    action: 'Review Presets panel.',
    expected: 'Each KPI and KRI shows name and live value.',
  },
  {
    action: 'Confirm no errors.',
    expected: 'No red Sync failed chip in the status bar.',
  },
] as const;

/**
 * Hidden companion page at /help — process map + test cases.
 * Not linked from the main dashboard chrome; direct URL only.
 */
export function HelpPage() {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <img className={styles.logo} src="/ensign-logo.png" alt="Ensign College" height={36} />
          <div>
            <p className={styles.kicker}>Companion documentation</p>
            <h1 className={styles.title}>ENG 201 Dashboard Help</h1>
          </div>
        </div>
        <nav className={styles.nav} aria-label="Help sections">
          <a href="#process-map">Process map</a>
          <a href="#test-cases">Test cases</a>
          <a href="/">Back to dashboard</a>
        </nav>
      </header>

      <main className={styles.main}>
        <section id="process-map" className={styles.section} aria-labelledby="process-map-heading">
          <h2 id="process-map-heading" className={styles.sectionTitle}>
            Process Map — ENG 201 Core Competency Throughput Dashboard
          </h2>
          <p className={styles.caption}>
            Companion process map for the stakeholder journey across Data Refresh through Act &amp;
            Report (System, Administrators, Department Chairs, Faculty, Student Success Team).
          </p>
          <figure className={styles.figure}>
            <img
              src="/process-map.png"
              alt="Process map swimlanes for System, Administrators, Department Chairs, Faculty, and Student Success Team across Data Refresh through Act and Report"
            />
          </figure>
        </section>

        <section id="test-cases" className={styles.section} aria-labelledby="test-cases-heading">
          <h2 id="test-cases-heading" className={styles.sectionTitle}>
            Test Cases
          </h2>
          <p className={styles.caption}>
            Structured cases from the project test template. No additional test-case documents were
            found in the repository beyond TC-01.
          </p>

          <article aria-labelledby="tc01-title">
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Project</span>
                <span className={styles.metaValue}>
                  ENG 201 Core Competency Throughput Dashboard
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Document</span>
                <span className={styles.metaValue}>Test Case Template</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Test Case ID</span>
                <span className={styles.metaValue}>TC-01</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Priority</span>
                <span className={styles.priority}>High</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Designed by</span>
                <span className={styles.metaValue}>Medina Business Insights</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Designed date</span>
                <span className={styles.metaValue}>July 28, 2026</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Executed by</span>
                <span className={styles.metaValue}>—</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Execution date</span>
                <span className={styles.metaValue}>—</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Dependencies</span>
                <span className={styles.metaValue}>None</span>
              </div>
            </div>

            <h3 id="tc01-title" className={styles.sectionTitle}>
              TC-01 — Launch and default view
            </h3>
            <p className={styles.bodyText}>
              Verify that the dashboard starts from the provided launch scripts.
            </p>
            <p className={styles.bodyText}>
              <strong>Preconditions:</strong> Tester has access to the dashboard system; Node.js 18
              or later is installed.
            </p>

            <ol className={styles.steps}>
              {TC01_STEPS.map((step, i) => (
                <li key={step.action} className={styles.step}>
                  <div className={styles.stepHead}>
                    <span className={styles.stepNum}>{i + 1}</span>
                    <p className={styles.stepAction}>{step.action}</p>
                  </div>
                  <p className={styles.expected}>
                    <strong>Expected</strong> {step.expected}
                  </p>
                </li>
              ))}
            </ol>

            <p className={styles.refNote}>Template screenshot (reference)</p>
            <figure className={styles.figure}>
              <img
                src="/test-case-tc01.png"
                alt="TC-01 Launch and default view test case template screenshot"
              />
            </figure>
          </article>
        </section>
      </main>
    </div>
  );
}
