import type { Dimension, FlagLevel, MetricId } from '../../types';
import type { ChartData } from '../../metrics/chartData';
import { useRole } from '../../context/RoleContext';
import { studentMatchesChartKey } from '../../metrics/chartSelection';
import styles from './DataTable.module.css';

interface DataTableProps {
  data: ChartData;
  /** Solo focused card — grow the scroller to fill remaining height. */
  expanded?: boolean;
  /** Chart mark key to filter the list (bar/slice click). */
  selectedKey?: string | null;
  metric?: MetricId;
  breakdown?: Dimension | 'none';
  onClearSelection?: () => void;
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
 * Clicking a chart mark filters this list to the students/groups in that mark.
 */
export function DataTable({
  data,
  expanded,
  selectedKey = null,
  metric = 'passRate',
  breakdown = 'none',
  onClearSelection,
}: DataTableProps) {
  const { role } = useRole();

  if (role === 'faculty' && data.tableRows) {
    const rows = selectedKey
      ? data.tableRows.filter(({ row, flag }) =>
          studentMatchesChartKey(row, flag, selectedKey, metric, breakdown),
        )
      : data.tableRows;
    const flagged = rows.filter((r) => r.flag);
    const selectedLabel =
      data.points.find((p) => p.key === selectedKey)?.label ??
      data.slices?.find((p) => p.key === selectedKey)?.label ??
      selectedKey;

    return (
      <div className={styles.wrap} data-expanded={expanded || undefined}>
        <p className={styles.caption}>
          {selectedKey
            ? `${rows.length} students in “${selectedLabel}”`
            : `${rows.length} students in scope · ${flagged.length} flagged (🔴 failing · 🟡 marginal / risk-slice)`}
          {selectedKey && onClearSelection && (
            <>
              {' · '}
              <button type="button" className={styles.clear} onClick={onClearSelection}>
                Show all
              </button>
            </>
          )}
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
              {rows.map(({ row, flag }) => (
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
  const allPoints =
    data.points.length > 0
      ? data.points
      : data.slices && data.slices.length > 0
        ? data.slices
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
  const rows = selectedKey
    ? allPoints.filter((p) => p.key === selectedKey)
    : allPoints;
  const selectedLabel = rows[0]?.label ?? selectedKey;

  return (
    <div className={styles.wrap} data-expanded={expanded || undefined}>
      <p className={styles.caption}>
        {selectedKey
          ? `Showing “${selectedLabel}” only — student identifiers are removed at this access level`
          : 'Aggregates only — student identifiers are removed at this access level'}
        {selectedKey && onClearSelection && (
          <>
            {' · '}
            <button type="button" className={styles.clear} onClick={onClearSelection}>
              Show all
            </button>
          </>
        )}
      </p>
      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Group</th>
              <th>{data.metricLabel}</th>
              <th>Students</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.key} data-status={p.status}>
                <td>{p.label}</td>
                <td>{p.formatted}</td>
                <td>{p.suppressed ? 'Fewer than 20' : p.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
