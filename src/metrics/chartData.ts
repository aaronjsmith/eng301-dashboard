import type {
  Dimension,
  FlagLevel,
  ModuleConfig,
  Role,
  Session,
  StudentRow,
} from '../types';
import { priorTerm, SESSION_ORDER } from '../types';
import {
  dimensionValue,
  dimensionValues,
  groupBy,
  selectRows,
  SMALL_CELL,
  valueLabel,
} from './scope';
import { gradeBandShares, passRate } from './formulas';
import { flagStudents } from './flags';
import { metricDef, type MetricUnit } from './registry';
import { formatUnit, percent1 } from './format';
import { THRESHOLDS } from './thresholds';

/**
 * ModuleConfig + rows → everything a chart renders. All numbers come from the
 * metric registry's compute functions; small-cell suppression is applied here,
 * BEFORE anything reaches a chart or table (FR4).
 */

export type MarkStatus = 'ok' | 'notable' | 'critical';

export interface SeriesPoint {
  key: string;
  label: string;
  value: number | null;
  formatted: string;
  n: number;
  suppressed: boolean;
  status: MarkStatus;
}

export interface HeatCell {
  value: number | null;
  formatted: string;
  n: number;
  suppressed: boolean;
  /** 0..3 → the justification doc's bins <78 / 78–82 / 82–85 / ≥85. */
  bin: 0 | 1 | 2 | 3 | null;
}

export interface ChartData {
  metricLabel: string;
  unit: MetricUnit;
  hero: { value: number | null; formatted: string; sub: string };
  /** Breakdown series ('none' ⇒ empty). */
  points: SeriesPoint[];
  /** Composition slices (gradeDist). */
  slices?: SeriesPoint[];
  /** Stacked composition over an ordered axis (gradeDist × session). */
  stacks?: { label: string; bands: SeriesPoint[] }[];
  baseline?: { label: string; value: number; formatted: string };
  /** Gap-metric alert threshold (diverging chart's dashed ±lines). */
  threshold?: number;
  matrix?: { rowLabels: string[]; colLabels: string[]; cells: HeatCell[][] };
  status: MarkStatus;
  n: number;
  suppressedNote?: string;
  /** Faculty-only named rows for the L-tier table (FR6). */
  tableRows?: { row: StudentRow; flag?: FlagLevel }[];
}

export interface ChartDataContext {
  /** Role scope ∩ global filters — the module's outer population. */
  scopeRows: StudentRow[];
  /**
   * Role scope ∩ global filters with YEAR removed — the slice year-crossing
   * baselines (prior session across a year boundary, same term last year)
   * compute against. Still role-scoped, so nothing leaks across professors.
   */
  yearAgnosticRows: StudentRow[];
  /**
   * ALL rows, unscoped — used ONLY for comparison baselines (course average /
   * all-courses / peer-level), the one spec-sanctioned aggregate exception to
   * faculty row-scoping. Never rendered as rows.
   */
  baselineRows: StudentRow[];
  role: Role;
}

function statusFor(metricId: ModuleConfig['metric'], value: number | null): MarkStatus {
  if (value === null) return 'ok';
  const def = metricDef(metricId);
  if (def.gapThreshold !== undefined) {
    return Math.abs(value) > def.gapThreshold
      ? def.kind === 'kri'
        ? 'critical'
        : 'notable'
      : 'ok';
  }
  if (def.target) {
    const { value: target, direction } = def.target;
    const missed =
      direction === 'atLeast' ? value < target
      : direction === 'atMost' ? value > target
      : false;
    if (missed) return def.kind === 'kri' ? 'critical' : 'notable';
  }
  return 'ok';
}

function heroSub(config: ModuleConfig, population: StudentRow[]): string {
  switch (config.metric) {
    case 'passRate':
    case 'dfwRate': {
      const pr = passRate(population);
      return pr ? `${config.metric === 'passRate' ? pr.passed : pr.n - pr.passed}/${pr.n} students` : 'No students in scope';
    }
    case 'enrollment':
      return 'Students in scope';
    case 'atRisk': {
      const f = flagStudents(population);
      return `${f.counts.fail} failing · ${f.counts.marginal} marginal · ${f.counts.riskSlice} risk-slice`;
    }
    case 'gradeDist':
      return 'Share of grades in the A range';
    default:
      return `${population.length} students in scope`;
  }
}

function sessionsIn(population: StudentRow[]): Session[] {
  const present = new Set(population.map((r) => r.session));
  return SESSION_ORDER.filter((s) => present.has(s));
}

function yearsIn(population: StudentRow[]): number[] {
  return [...new Set(population.map((r) => r.year))].sort((a, b) => a - b);
}

function computeBaseline(
  config: ModuleConfig,
  population: StudentRow[],
  ctx: ChartDataContext,
): ChartData['baseline'] {
  const def = metricDef(config.metric);
  const fmt = (value: number, label: string) => ({
    label,
    value,
    formatted: formatUnit(value, def.unit),
  });

  // Population-average baselines never apply to counts (see availableCompareTos).
  if (
    def.unit === 'count' &&
    (config.compareTo === 'courseAvg' ||
      config.compareTo === 'allCoursesAvg' ||
      config.compareTo === 'peerLevel')
  ) {
    return undefined;
  }

  switch (config.compareTo) {
    case 'none':
      return undefined;
    case 'courseAvg': {
      const courses = new Set(population.map((r) => r.course));
      const rows = ctx.baselineRows.filter((r) => courses.has(r.course));
      const value = def.compute(rows);
      return value !== null ? fmt(value, 'Course average') : undefined;
    }
    case 'allCoursesAvg': {
      const value = def.compute(ctx.baselineRows);
      return value !== null ? fmt(value, 'All-courses average') : undefined;
    }
    case 'peerLevel': {
      const levels = new Set(population.map((r) => (Number(/(\d+)/.exec(r.course)?.[1] ?? 0) >= 200 ? '200' : '100')));
      if (levels.size !== 1) return undefined;
      const target = levels.has('200') ? '100' : '200';
      const rows = ctx.baselineRows.filter(
        (r) => (Number(/(\d+)/.exec(r.course)?.[1] ?? 0) >= 200 ? '200' : '100') === target,
      );
      const value = def.compute(rows);
      return value !== null ? fmt(value, `${target}-level peers`) : undefined;
    }
    case 'priorSession': {
      const sessions = sessionsIn(population);
      const years = yearsIn(population);
      if (sessions.length !== 1 || years.length !== 1) return undefined;
      const pt = priorTerm({ year: years[0], session: sessions[0] });
      // Same population with the term REPLACED by the prior one — Spring
      // rolls over the year boundary to the prior year's Winter.
      const rows = selectRows(
        ctx.yearAgnosticRows,
        stripDimensions(config, 'session', 'year'),
      ).filter((r) => r.session === pt.session && r.year === pt.year);
      const value = def.compute(rows);
      return value !== null
        ? fmt(value, `Prior session (${pt.session} ${pt.year})`)
        : undefined;
    }
    case 'sameTermLastYear': {
      const years = yearsIn(population);
      if (years.length !== 1) return undefined;
      const y = years[0];
      // Replace ONLY the year constraint; any session filter carries over
      // (Fall 2026 → Fall 2025; an unfiltered module degrades to 2025 overall).
      const rows = selectRows(ctx.yearAgnosticRows, stripDimensions(config, 'year')).filter(
        (r) => r.year === y - 1,
      );
      const value = def.compute(rows);
      const sessions = sessionsIn(population);
      const label =
        sessions.length === 1 ? `${sessions[0]} ${y - 1}` : `Same scope ${y - 1}`;
      return value !== null ? fmt(value, label) : undefined;
    }
  }
}

/** Module + investigate filters with dimensions removed (baseline math). */
function stripDimensions(config: ModuleConfig, ...dims: Dimension[]) {
  const merged = { ...config.investigate?.slice, ...config.filters };
  for (const dim of dims) delete merged[dim];
  return merged;
}

function suppress(unit: MetricUnit, value: number | null, n: number): Pick<SeriesPoint, 'value' | 'formatted' | 'suppressed'> {
  if (n > 0 && n < SMALL_CELL) {
    return { value: null, formatted: `n<${SMALL_CELL}`, suppressed: true };
  }
  if (value === null) return { value: null, formatted: '—', suppressed: false };
  return { value, formatted: formatUnit(value, unit), suppressed: false };
}

function binOf(value: number | null): HeatCell['bin'] {
  if (value === null) return null;
  const [b1, b2, b3] = THRESHOLDS.heatBins;
  if (value < b1) return 0;
  if (value < b2) return 1;
  if (value < b3) return 2;
  return 3;
}

export function buildChartData(config: ModuleConfig, ctx: ChartDataContext): ChartData {
  const def = metricDef(config.metric);
  const population = selectRows(ctx.scopeRows, config.filters, config.investigate?.slice);

  const heroValue = def.compute(population);
  const heroSuppressed =
    ctx.role !== 'faculty' && population.length > 0 && population.length < SMALL_CELL;
  const hero = {
    value: heroSuppressed ? null : heroValue,
    formatted: heroSuppressed
      ? `n<${SMALL_CELL}`
      : heroValue !== null
        ? formatUnit(heroValue, def.unit)
        : '—',
    sub: heroSuppressed
      ? 'Cell too small to report (FERPA)'
      : heroSub(config, population),
  };

  // Breakdown series
  let points: SeriesPoint[] = [];
  if (config.breakdown !== 'none') {
    points = [...groupBy(population, config.breakdown)].map(([key, rows]) => {
      const value = def.compute(rows);
      const s = suppress(def.unit, value, rows.length);
      return {
        key,
        label: valueLabel(config.breakdown as Dimension, key),
        ...s,
        n: rows.length,
        status: s.suppressed ? 'ok' : statusFor(config.metric, s.value),
      };
    });
    if (def.gapThreshold !== undefined) {
      // Gap metrics render ranked (design doc's Equity view).
      points.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
    }
  }

  // Composition (gradeDist)
  let slices: SeriesPoint[] | undefined;
  let stacks: ChartData['stacks'];
  if (config.metric === 'gradeDist') {
    slices = gradeBandShares(population).map((b) => ({
      key: b.band,
      label: b.band,
      value: b.share,
      formatted: percent1(b.share),
      n: b.n,
      suppressed: false,
      status: 'ok' as const,
    }));
    if (config.breakdown === 'session') {
      stacks = [...groupBy(population, 'session')].map(([session, rows]) => ({
        label: session,
        bands: gradeBandShares(rows).map((b) => ({
          key: b.band,
          label: b.band,
          value: b.share,
          formatted: percent1(b.share),
          n: b.n,
          suppressed: false,
          status: 'ok' as const,
        })),
      }));
    }
  }

  // Heatmap matrix: course rows × breakdown columns (pass rate only)
  let matrix: ChartData['matrix'];
  if (
    config.chartType === 'heatmap' &&
    config.metric === 'passRate' &&
    config.breakdown !== 'none' &&
    config.breakdown !== 'course'
  ) {
    const dim = config.breakdown;
    const courses = dimensionValues(population, 'course');
    const cols = dimensionValues(population, dim);
    if (courses.length >= 2 && cols.length >= 1) {
      matrix = {
        rowLabels: courses,
        colLabels: cols.map((c) => valueLabel(dim, c)),
        cells: courses.map((course) =>
          cols.map((col) => {
            const rows = population.filter(
              (r) => r.course === course && dimensionValue(r, dim) === col,
            );
            const value = def.compute(rows);
            const s = suppress(def.unit, value, rows.length);
            return {
              value: s.value,
              formatted: s.formatted,
              n: rows.length,
              suppressed: s.suppressed,
              bin: s.suppressed ? null : binOf(s.value),
            };
          }),
        ),
      };
    }
  }

  // Faculty-only named table rows (FR6); chair/admin tables aggregate `points`.
  let tableRows: ChartData['tableRows'];
  if (ctx.role === 'faculty') {
    const flags = flagStudents(population).byStudent;
    tableRows = population.map((row) => ({ row, flag: flags.get(row) }));
  }

  const suppressedCells = points.filter((p) => p.suppressed).length;
  return {
    metricLabel: def.label,
    unit: def.unit,
    hero,
    points,
    slices,
    stacks,
    baseline: computeBaseline(config, population, ctx),
    threshold: def.gapThreshold,
    matrix,
    status: heroSuppressed ? 'ok' : statusFor(config.metric, heroValue),
    n: population.length,
    suppressedNote:
      suppressedCells > 0
        ? `${suppressedCells} group${suppressedCells > 1 ? 's' : ''} under n=${SMALL_CELL} suppressed`
        : heroSuppressed
          ? `Population under n=${SMALL_CELL} — aggregate only`
          : undefined,
    tableRows,
  };
}
