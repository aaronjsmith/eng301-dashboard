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
import { formatUnit, percent1, tooFewStudentsLabel } from './format';
import { THRESHOLDS } from './thresholds';
import { breakdownChain } from './availability';
import { encodeChartKey } from './chartSelection';

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
  /** Which group is ahead on the left (negative) vs right (positive) of zero. */
  gapPoles?: { negative: string; positive: string };
  matrix?: { rowLabels: string[]; colLabels: string[]; cells: HeatCell[][] };
  status: MarkStatus;
  n: number;
  suppressedNote?: string;
  /** Faculty-only named rows for the L-tier table (FR6). */
  tableRows?: { row: StudentRow; flag?: FlagLevel }[];
  /** FR6 flag totals — pass-rate modules show failing/marginal with list colors. */
  flagCounts?: { fail: number; marginal: number };
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

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function computeBaseline(
  config: ModuleConfig,
  population: StudentRow[],
  ctx: ChartDataContext,
  series: SeriesPoint[] = [],
): ChartData['baseline'] {
  const def = metricDef(config.metric);
  const fmt = (value: number, label: string) => ({
    label,
    value,
    formatted: formatUnit(value, def.unit),
  });

  // Population-average baselines never apply to counts (see availableCompareTos).
  if (def.unit === 'count' && config.compareTo === 'courseAvg') {
    return undefined;
  }

  switch (config.compareTo) {
    case 'none':
      return undefined;
    case 'median': {
      const fromSeries = series
        .filter((p) => !p.suppressed && p.value !== null)
        .map((p) => p.value as number);
      if (fromSeries.length >= 2) {
        const m = medianOf(fromSeries);
        return m !== null ? fmt(m, 'Median value') : undefined;
      }
      if (def.unit === 'score') {
        const m = medianOf(population.map((r) => r.score));
        return m !== null ? fmt(m, 'Median value') : undefined;
      }
      // Single aggregate mark — overall metric is the only reference available.
      const value = def.compute(population);
      return value !== null ? fmt(value, 'Median value') : undefined;
    }
    case 'courseAvg': {
      const courses = new Set(population.map((r) => r.course));
      const rows = ctx.baselineRows.filter((r) => courses.has(r.course));
      const value = def.compute(rows);
      return value !== null ? fmt(value, 'Course average') : undefined;
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
    return { value: null, formatted: tooFewStudentsLabel(SMALL_CELL), suppressed: true };
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
      ? tooFewStudentsLabel(SMALL_CELL)
      : heroValue !== null
        ? formatUnit(heroValue, def.unit)
        : '—',
    sub: heroSuppressed
      ? 'Too few students to show (privacy)'
      : heroSub(config, population),
  };

  // Breakdown series (primary × optional then-by nest)
  let points: SeriesPoint[] = [];
  const dims = breakdownChain(config);
  if (dims.length > 0) {
    const walk = (rows: StudentRow[], depth: number, keyParts: string[], labelParts: string[]) => {
      if (depth >= dims.length) {
        const value = def.compute(rows);
        const s = suppress(def.unit, value, rows.length);
        points.push({
          key: encodeChartKey(keyParts),
          label: labelParts.join(' · '),
          ...s,
          n: rows.length,
          status: s.suppressed ? 'ok' : statusFor(config.metric, s.value),
        });
        return;
      }
      const dim = dims[depth];
      for (const [key, group] of groupBy(rows, dim)) {
        walk(group, depth + 1, [...keyParts, key], [
          ...labelParts,
          valueLabel(dim, key),
        ]);
      }
    };
    walk(population, 0, [], []);
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
    // Stacked bands only for a single session split (nested splits use bars).
    if (dims.length === 1 && dims[0] === 'session') {
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

  // Heatmap matrix: course rows × breakdown columns (pass rate only).
  // Nested splits stay on bars — heatmaps need a single column dimension.
  let matrix: ChartData['matrix'];
  if (
    config.chartType === 'heatmap' &&
    config.metric === 'passRate' &&
    dims.length === 1 &&
    dims[0] !== 'course'
  ) {
    const dim = dims[0];
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

  let flagCounts: ChartData['flagCounts'];
  if (config.metric === 'passRate') {
    const flags = flagStudents(population);
    const f = flags.counts;
    flagCounts = { fail: f.fail, marginal: f.marginal };

    // No breakdown: show pass / failing / marginal as peer bars so the
    // footer colors also appear in the chart (counts → % of cohort).
    if (dims.length === 0 && population.length > 0 && !heroSuppressed) {
      const n = population.length;
      const passPct = heroValue;
      const failPct = (f.fail / n) * 100;
      const margPct = (f.marginal / n) * 100;
      const passed = passRate(population)?.passed ?? 0;
      points = [
        {
          key: 'pass',
          label: 'Pass rate',
          value: passPct,
          formatted: passPct !== null ? percent1(passPct) : '—',
          n: passed,
          suppressed: false,
          status: 'ok',
        },
        {
          key: 'fail',
          label: 'Failing',
          value: failPct,
          formatted: percent1(failPct),
          n: f.fail,
          suppressed: false,
          status: 'critical',
        },
        {
          key: 'marginal',
          label: 'Marginal',
          value: margPct,
          formatted: percent1(margPct),
          n: f.marginal,
          suppressed: false,
          status: 'notable',
        },
      ];
    }
  }

  const suppressedCells = points.filter((p) => p.suppressed).length;
  return {
    metricLabel: def.label,
    unit: def.unit,
    hero,
    points,
    slices,
    stacks,
    baseline: computeBaseline(config, population, ctx, points),
    threshold: def.gapThreshold,
    gapPoles: def.gapPoles,
    matrix,
    status: heroSuppressed ? 'ok' : statusFor(config.metric, heroValue),
    n: population.length,
    suppressedNote:
      suppressedCells > 0
        ? `${suppressedCells} group${suppressedCells > 1 ? 's' : ''} with ${tooFewStudentsLabel(SMALL_CELL).toLowerCase()} hidden`
        : heroSuppressed
          ? `${tooFewStudentsLabel(SMALL_CELL)} — totals only`
          : undefined,
    tableRows,
    flagCounts,
  };
}
