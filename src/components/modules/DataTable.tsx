import { useEffect, useMemo, useRef, useState } from 'react';
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
  thenBy?: Dimension[];
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

/** Selected values for a column; undefined = no filter (show all). */
type ColFilterMap<K extends string> = Partial<Record<K, string[]>>;

function compareValues(a: string | number, b: string | number, dir: SortDir): number {
  const cmp =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  return dir === 'asc' ? cmp : -cmp;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  );
}

function facultyCellValue(
  row: StudentRow,
  flag: FlagLevel | undefined,
  col: FacultyCol,
): string {
  if (col === 'flag') return flag ? FLAG_LABEL[flag] : '(none)';
  return String(row[col]);
}

function aggCellValue(p: SeriesPoint, col: AggregateCol): string {
  if (col === 'label') return p.label;
  if (col === 'value') return p.formatted;
  return p.suppressed ? 'Fewer than 20' : String(p.n);
}

function passesColFilters<K extends string>(
  filters: ColFilterMap<K>,
  valueOf: (col: K) => string,
): boolean {
  for (const col of Object.keys(filters) as K[]) {
    const allowed = filters[col];
    if (!allowed) continue;
    if (!allowed.includes(valueOf(col))) return false;
  }
  return true;
}

function activeFilterCount<K extends string>(filters: ColFilterMap<K>): number {
  return (Object.keys(filters) as K[]).filter((k) => filters[k] !== undefined).length;
}

/** Drop filter values that no longer exist in the current option set. */
function pruneFilters<K extends string>(
  filters: ColFilterMap<K>,
  options: Record<K, string[]>,
): ColFilterMap<K> {
  let changed = false;
  const next: ColFilterMap<K> = {};
  for (const col of Object.keys(filters) as K[]) {
    const selected = filters[col];
    if (selected === undefined) continue;
    const allowed = new Set(options[col] ?? []);
    const kept = selected.filter((v) => allowed.has(v));
    if (kept.length === (options[col] ?? []).length) {
      // Equivalent to "all" — clear the filter.
      changed = true;
      continue;
    }
    if (kept.length !== selected.length) changed = true;
    next[col] = kept;
  }
  return changed || Object.keys(next).length !== Object.keys(filters).length
    ? next
    : filters;
}

function ColumnMenu<K extends string>({
  col,
  label,
  sortKey,
  sortDir,
  onSort,
  options,
  selected,
  onChange,
}: {
  col: K;
  label: string;
  sortKey: K;
  sortDir: SortDir;
  onSort: (col: K) => void;
  options: string[];
  selected: string[] | undefined;
  onChange: (col: K, next: string[] | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLTableCellElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const sortedActive = sortKey === col;
  const filterActive = selected !== undefined;

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 200;
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setMenuPos({ top: rect.bottom + 4, left: Math.max(8, left) });
    };
    place();
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        const menu = document.getElementById(`col-filter-${String(col)}`);
        if (menu && menu.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, col]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const visible = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const checked = (value: string) => selected === undefined || selected.includes(value);

  const toggle = (value: string) => {
    const current = selected ?? [...options];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    if (next.length === options.length) onChange(col, undefined);
    else onChange(col, next);
  };

  return (
    <th
      ref={wrapRef}
      className={styles.th}
      aria-sort={sortedActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <div className={styles.thInner}>
        <button
          type="button"
          className={sortedActive ? styles.sortBtnActive : styles.sortBtn}
          onClick={() => onSort(col)}
        >
          {label}
          <span className={styles.sortMark} aria-hidden="true">
            {sortedActive ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
          </span>
        </button>
        <button
          ref={btnRef}
          type="button"
          className={filterActive ? styles.filterBtnActive : styles.filterBtn}
          aria-expanded={open}
          aria-label={`Filter ${label}`}
          title={`Filter ${label}`}
          onClick={() => {
            if (open) {
              setOpen(false);
              return;
            }
            const rect = btnRef.current?.getBoundingClientRect();
            if (rect) {
              const width = 200;
              const left = Math.min(rect.left, window.innerWidth - width - 8);
              setMenuPos({ top: rect.bottom + 4, left: Math.max(8, left) });
            }
            setOpen(true);
          }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M1.5 2h9L7 6.6V10l-2-1V6.6L1.5 2Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {open && menuPos && (
        <div
          id={`col-filter-${String(col)}`}
          className={styles.filterMenu}
          role="dialog"
          aria-label={`Filter ${label}`}
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {options.length > 8 && (
            <input
              className={styles.filterSearch}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              aria-label={`Search ${label} values`}
            />
          )}
          <div className={styles.filterActions}>
            <button
              type="button"
              onClick={() => onChange(col, undefined)}
              disabled={selected === undefined}
            >
              All
            </button>
            <button type="button" onClick={() => onChange(col, [])}>
              None
            </button>
          </div>
          <div className={styles.filterList}>
            {visible.length === 0 ? (
              <p className={styles.filterEmpty}>No matches</p>
            ) : (
              visible.map((value) => (
                <label key={value} className={styles.filterOption}>
                  <input
                    type="checkbox"
                    checked={checked(value)}
                    onChange={() => toggle(value)}
                  />
                  <span>{value}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </th>
  );
}

/**
 * FR6 — the L-tier data table. Faculty (row-scoped to their own sections) get
 * the named list with flag conditional formatting; chair/admin views are
 * anonymous by construction — aggregates only, `Student #` never rendered.
 * Clicking a chart mark filters this list to the students/groups in that mark.
 * Column headers sort and filter independently of the module Filter control.
 */
export function DataTable({
  data,
  expanded,
  selectedKey = null,
  metric = 'passRate',
  breakdown = 'none',
  thenBy = [],
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
  const [facultyFilters, setFacultyFilters] = useState<ColFilterMap<FacultyCol>>({});
  const [aggFilters, setAggFilters] = useState<ColFilterMap<AggregateCol>>({});

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

  const setFacultyFilter = (col: FacultyCol, next: string[] | undefined) => {
    setFacultyFilters((prev) => {
      const copy = { ...prev };
      if (next === undefined) delete copy[col];
      else copy[col] = next;
      return copy;
    });
  };

  const setAggFilter = (col: AggregateCol, next: string[] | undefined) => {
    setAggFilters((prev) => {
      const copy = { ...prev };
      if (next === undefined) delete copy[col];
      else copy[col] = next;
      return copy;
    });
  };

  // Chart-mark selection first — column filter options come from that slice.
  const facultyBase = useMemo(() => {
    if (!data.tableRows) return [];
    return selectedKey
      ? data.tableRows.filter(({ row, flag }) =>
          studentMatchesChartKey(row, flag, selectedKey, metric, breakdown, thenBy),
        )
      : data.tableRows;
  }, [data.tableRows, selectedKey, metric, breakdown, thenBy]);

  const facultyOptions = useMemo(() => {
    const cols: FacultyCol[] = [
      'studentNum',
      'course',
      'year',
      'session',
      'score',
      'grade',
      'flag',
    ];
    const map = {} as Record<FacultyCol, string[]>;
    for (const col of cols) {
      map[col] = uniqueSorted(
        facultyBase.map(({ row, flag }) => facultyCellValue(row, flag, col)),
      );
    }
    return map;
  }, [facultyBase]);

  useEffect(() => {
    setFacultyFilters((prev) => pruneFilters(prev, facultyOptions));
  }, [facultyOptions]);

  const facultyRows = useMemo(() => {
    const filtered = facultyBase.filter(({ row, flag }) =>
      passesColFilters(facultyFilters, (col) => facultyCellValue(row, flag, col)),
    );

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
  }, [facultyBase, facultyFilters, facultySort]);

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

  const aggBase = useMemo(() => {
    return selectedKey ? allPoints.filter((p) => p.key === selectedKey) : allPoints;
  }, [allPoints, selectedKey]);

  const aggOptions = useMemo(() => {
    const cols: AggregateCol[] = ['label', 'value', 'n'];
    const map = {} as Record<AggregateCol, string[]>;
    for (const col of cols) {
      map[col] = uniqueSorted(aggBase.map((p) => aggCellValue(p, col)));
    }
    return map;
  }, [aggBase]);

  useEffect(() => {
    setAggFilters((prev) => pruneFilters(prev, aggOptions));
  }, [aggOptions]);

  const aggRows = useMemo(() => {
    const filtered = aggBase.filter((p) =>
      passesColFilters(aggFilters, (col) => aggCellValue(p, col)),
    );
    const { key, dir } = aggSort;
    return [...filtered].sort((a, b) => {
      if (key === 'label') return compareValues(a.label, b.label, dir);
      if (key === 'n') return compareValues(a.n, b.n, dir);
      return compareValues(a.value ?? -Infinity, b.value ?? -Infinity, dir);
    });
  }, [aggBase, aggFilters, aggSort]);

  if (isFacultyList) {
    const flagged = facultyRows.filter((r) => r.flag);
    const selectedLabel =
      data.points.find((p) => p.key === selectedKey)?.label ??
      data.slices?.find((p) => p.key === selectedKey)?.label ??
      selectedKey;
    const colFilterN = activeFilterCount(facultyFilters);

    return (
      <div className={styles.wrap} data-expanded={expanded || undefined}>
        <p className={styles.caption}>
          {selectedKey
            ? `${facultyRows.length} students in “${selectedLabel}”`
            : `${facultyRows.length} students in scope · ${flagged.length} flagged (🔴 failing · 🟡 marginal / risk-slice)`}
          {colFilterN > 0 && (
            <>
              {' · '}
              <button
                type="button"
                className={styles.clear}
                onClick={() => setFacultyFilters({})}
              >
                Clear column filters ({colFilterN})
              </button>
            </>
          )}
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
                {(
                  [
                    ['studentNum', 'Student #'],
                    ['course', 'Course'],
                    ['year', 'Year'],
                    ['session', 'Session'],
                    ['score', 'Score'],
                    ['grade', 'Grade'],
                    ['flag', 'Flag'],
                  ] as const
                ).map(([col, label]) => (
                  <ColumnMenu
                    key={col}
                    col={col}
                    label={label}
                    sortKey={facultySort.key}
                    sortDir={facultySort.dir}
                    onSort={toggleFaculty}
                    options={facultyOptions[col]}
                    selected={facultyFilters[col]}
                    onChange={setFacultyFilter}
                  />
                ))}
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
  const colFilterN = activeFilterCount(aggFilters);

  return (
    <div className={styles.wrap} data-expanded={expanded || undefined}>
      <p className={styles.caption}>
        {selectedKey
          ? `Showing “${selectedLabel}” only — student identifiers are removed at this access level`
          : 'Aggregates only — student identifiers are removed at this access level'}
        {colFilterN > 0 && (
          <>
            {' · '}
            <button type="button" className={styles.clear} onClick={() => setAggFilters({})}>
              Clear column filters ({colFilterN})
            </button>
          </>
        )}
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
              <ColumnMenu
                col="label"
                label="Group"
                sortKey={aggSort.key}
                sortDir={aggSort.dir}
                onSort={toggleAgg}
                options={aggOptions.label}
                selected={aggFilters.label}
                onChange={setAggFilter}
              />
              <ColumnMenu
                col="value"
                label={data.metricLabel}
                sortKey={aggSort.key}
                sortDir={aggSort.dir}
                onSort={toggleAgg}
                options={aggOptions.value}
                selected={aggFilters.value}
                onChange={setAggFilter}
              />
              <ColumnMenu
                col="n"
                label="Students"
                sortKey={aggSort.key}
                sortDir={aggSort.dir}
                onSort={toggleAgg}
                options={aggOptions.n}
                selected={aggFilters.n}
                onChange={setAggFilter}
              />
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
