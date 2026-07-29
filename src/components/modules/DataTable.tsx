import type { FlagLevel } from '../../types';
import type { ChartData } from '../../metrics/chartData';
import { useRole } from '../../context/RoleContext';
import styles from './DataTable.module.css';

interface DataTableProps {
  data: ChartData;
}

const FLAG_LABEL: Record<FlagLevel, string> = {
  fail: 'Failing',
  marginal: 'Marginal pass',
  riskSlice: 'Risk slice',
};

/**
 * FR6 — the L-tier data table. Faculty (row-scoped to their own sections) get
 * the named list with flag conditional formatting; chair/admin views are
 * anonymous by construction — aggregates only, `Student #` never rendered.
 */
export function DataTable({ data }: DataTableProps) {
  const { role } = useRole();

  if (role === 'faculty' && data.tableRows) {
    const flagged = data.tableRows.filter((r) => r.flag);
    return (
      <div className={styles.wrap}>
        <p className={styles.caption}>
          {data.tableRows.length} students in scope · {flagged.length} flagged
          (🔴 failing · 🟡 marginal / risk-slice)
        </p>
        <div className={styles.scroller}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Student #</th>
                <th>Course</th>
                <th>Year</th>
                <th>Session</th>
                <th>Score</th>
                <th>Grade</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {data.tableRows.map(({ row, flag }) => (
                <tr
                  key={`${row.course}-${row.studentNum}-${row.year}`}
                  data-flag={flag ?? 'none'}
                >
                  <td>{row.studentNum}</td>
                  <td>{row.course}</td>
                  <td>{row.year}</td>
                  <td>{row.session}</td>
                  <td>{row.score}</td>
                  <td>{row.grade}</td>
                  <td>{flag ? FLAG_LABEL[flag] : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Chair/admin: aggregate counts per breakdown group only.
  const rows =
    data.points.length > 0
      ? data.points
      : [
          {
            key: 'all',
            label: 'All in scope',
            value: data.hero.value,
            formatted: data.hero.formatted,
            n: data.n,
            suppressed: false,
            status: data.status,
          },
        ];

  return (
    <div className={styles.wrap}>
      <p className={styles.caption}>
        Aggregates only — student identifiers are removed at this access level
      </p>
      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Group</th>
              <th>{data.metricLabel}</th>
              <th>n</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.key} data-status={p.status}>
                <td>{p.label}</td>
                <td>{p.formatted}</td>
                <td>{p.suppressed ? `<20` : p.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
