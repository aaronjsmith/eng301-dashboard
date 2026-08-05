import { useMemo, useState } from 'react';
import type { Dimension, FlagLevel, MetricId, StudentRow } from '../../types';
import type { ChartData, SeriesPoint } from '../../metrics/chartData';
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

const FLAG_RANK: Record<FlagLevel, number> = {
  fail: 0,
  marginal: 1,
  riskSlice: 2,
};

type FacultyCol =
  | 'studentNum'
  | 'course'
  | 'year'
  | 'session'
  | 'score'
  | 'grade'
  | 'flag';

type AggregateCol = 'label' | 'value' | 'n';

type SortDir = 'asc' | 'desc';

function compareValues(a: string | number, b: string | number, dir: SortDir): number {
  const cmp =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  return dir === 'asc' ? cmp : -cmp;
}

function SortTh<K extends string>({
  col,
  label,
  sortKey,
  sortDir,
  onSort,
}: {
  col: K;
  label: string;
  sortKey: K;
  sortDir: SortDir;
  onSort: (col: K) => void;
}) {
  const active = sortKey === col;
  return (
    <th aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={active ? styles.sortBtnActive : styles.sortBtn}
        onClick={() => onSort(col)}
      >
        {label}
        <span className={styles.sortMark} aria-hidden="true">
          {active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
        </span>
      </button>
    </th>
  );
}

/**
 * FR6 — the L-tier data table. Faculty (row-scoped to their own sections) get
 * the named list with flag conditional formatting; chair/admin views are
 * anonymous by construction — aggregates only, `Student #` never rendered.
 * Clicking a chart mark filters this list to the students/groups in that mark.
 * Column headers sort ascending/descending.
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
  const isFacultyList = role === 'faculty' && Boolean(data.tableRows);

  const [facultySort, setFacultySort] = useState<{ key: FacultyCol; dir: SortDir }>({
    key: 'score',
    dir: 'desc',
  });
  const [aggSort, setAggSort] = useState<{ key: AggregateCol; dir: SortDir }>({
    key: 'value',
    dir: 'desc',
  });

  const toggleFaculty = (key: FacultyCol) => {
    setFacultySort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'score' || key === 'year' || key === 'studentNum' ? 'desc' : 'asc' },
    );
  };

  const toggleAgg = (key: AggregateCol) => {
    setAggSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'label' ? 'asc' : 'desc' },
    );
  };

  const facultyRows = useMemo(() => {
    if (!data.tableRows) return [];
    const filtered = selectedKey
      ? data.tableRows.filter(({ row, flag }) =>
          studentMatchesChartKey(row, flag, selectedKey, metric, breakdown),
        )
      : data.tableRows;

    const { key, dir } = facultySort;
    return [...filtered].sort((a, b) => {
      if (key === 'flag') {
        const av = a.flag ? FLAG_RANK[a.flag] : 99;
        const bv = b.flag ? FLAG_RANK[b.flag] : 99;
        return compareValues(av, bv, dir);
      }
      const av = a.row[key as keyof StudentRow];
      const bv = b.row[key as keyof StudentRow];
      return compareValues(av as string | number, bv as string | number, dir);
    });
  }, [data.tableRows, selectedKey, metric, breakdown, facultySort]);

  const allPoints: SeriesPoint[] = useMemo(() => {
    if (data.points.length > 0) return data.points;
    if (data.slices && data.slices.length > 0) return data.slices;
    return [
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
  }, [data.points, data.slices, data.hero, data.n, data.status]);

  const aggRows = useMemo(() => {
    const filtered = selectedKey
      ? allPoints.filter((p) => p.key === selectedKey)
      : allPoints;
    const { key, dir } = aggSort;
    return [...filtered].sort((a, b) => {
      if (key === 'label') return compareValues(a.label, b.label, dir);
      if (key === 'n') return compareValues(a.n, b.n, dir);
      return compareValues(a.value ?? -Infinity, b.value ?? -Infinity, dir);
    });
  }, [allPoints, selectedKey, aggSort]);

  if (isFacultyList) {
    const flagged = facultyRows.filter((r) => r.flag);
    const selectedLabel =
      data.points.find((p) => p.key === selectedKey)?.label ??
      data.slices?.find((p) => p.key === selectedKey)?.label ??
      selectedKey;

    return (
      <div className={styles.wrap} data-expanded={expanded || undefined}>
        <p className={styles.caption}>
          {selectedKey
            ? `${facultyRows.length} students in “${selectedLabel}”`
            : `${facultyRows.length} students in scope · ${flagged.length} flagged (🔴 failing · 🟡 marginal / risk-slice)`}
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
                <SortTh col="studentNum" label="Student #" sortKey={facultySort.key} sortDir={facultySort.dir} onSort={toggleFaculty} />
                <SortTh col="course" label="Course" sortKey={facultySort.key} sortDir={facultySort.dir} onSort={toggleFaculty} />
                <SortTh col="year" label="Year" sortKey={facultySort.key} sortDir={facultySort.dir} onSort={toggleFaculty} />
                <SortTh col="session" label="Session" sortKey={facultySort.key} sortDir={facultySort.dir} onSort={toggleFaculty} />
                <SortTh col="score" label="Score" sortKey={facultySort.key} sortDir={facultySort.dir} onSort={toggleFaculty} />
                <SortTh col="grade" label="Grade" sortKey={facultySort.key} sortDir={facultySort.dir} onSort={toggleFaculty} />
                <SortTh col="flag" label="Flag" sortKey={facultySort.key} sortDir={facultySort.dir} onSort={toggleFaculty} />
              </tr>
            </thead>
            <tbody>
              {facultyRows.map(({ row, flag }) => (
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

  const selectedLabel = aggRows[0]?.label ?? selectedKey;

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
              <SortTh col="label" label="Group" sortKey={aggSort.key} sortDir={aggSort.dir} onSort={toggleAgg} />
              <SortTh col="value" label={data.metricLabel} sortKey={aggSort.key} sortDir={aggSort.dir} onSort={toggleAgg} />
              <SortTh col="n" label="Students" sortKey={aggSort.key} sortDir={aggSort.dir} onSort={toggleAgg} />
            </tr>
          </thead>
          <tbody>
            {aggRows.map((p) => (
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
