import type {
  ChartType,
  CompareTo,
  Dimension,
  MetricId,
  ModuleConfig,
  Role,
  StudentRow,
} from '../types';
import { DIMENSION_META, dimensionValue } from './scope';
import { metricDef } from './registry';

/**
 * Contextual availability (spec: "restyle but not misrepresent"). Chart types
 * and dimensions are offered only where they fit the metric + breakdown;
 * role gating strips dimensions BEFORE render — absent, not disabled (FR4).
 */

export interface AvailabilityInfo {
  /** Distinct courses in the module's population. */
  courseCount: number;
}

export function availableChartTypes(
  config: Pick<ModuleConfig, 'metric' | 'breakdown' | 'thenBy'>,
  info: AvailabilityInfo,
): ChartType[] {
  const def = metricDef(config.metric);
  const dims = breakdownChain(config);
  const breakdown = dims[0] ?? 'none';

  // Gap metrics: diverging bars only — the one form whose zero axis renders
  // negative gaps honestly (a plain bar would clamp them to a stub).
  if (def.gapThreshold !== undefined) return ['divergingBar'];

  if (config.metric === 'gradeDist') {
    const types: ChartType[] = ['pie', 'bars'];
    if (dims.length === 1 && breakdown === 'session') types.push('area'); // stacked bands over time
    return types;
  }

  const types: ChartType[] = ['bars'];
  if (dims.length > 0) {
    if (dims.length === 1 && (breakdown === 'session' || breakdown === 'year')) {
      types.push('area'); // ordered axis
    }
    if (
      dims.length === 1 &&
      config.metric === 'passRate' &&
      breakdown !== 'course' &&
      info.courseCount >= 2
    ) {
      types.push('heatmap'); // course × dimension surface
    }
  }
  return types;
}

/**
 * Comparison baselines that make sense for a metric. Population-average
 * baselines are meaningless for counts — a scoped count vs a bigger
 * population's count is a size difference, not a comparison; only
 * like-for-like trend windows compare honestly. Median is always offered
 * (series median when split; otherwise population median / overall).
 */
export function availableCompareTos(metric: MetricId): CompareTo[] {
  if (metricDef(metric).unit === 'count') {
    return ['median', 'none', 'priorSession', 'sameTermLastYear'];
  }
  return ['median', 'none', 'priorSession', 'sameTermLastYear', 'courseAvg'];
}

/** True when a dimension splits the population into at least two groups. */
function splitsPopulation(rows: StudentRow[], dim: Dimension): boolean {
  const seen = new Set<string>();
  for (const row of rows) {
    seen.add(dimensionValue(row, dim));
    if (seen.size >= 2) return true;
  }
  return false;
}

/**
 * Breakdown options a role may use for a metric (faculty never see professor).
 * With `scopeRows`, dimensions the current scope pins to a single group are
 * dropped too — e.g. breaking down a single selected course by course is a
 * no-op and is omitted until the scope widens to All courses.
 */
export function availableBreakdowns(
  metric: ModuleConfig['metric'],
  role: Role,
  scopeRows?: StudentRow[],
): (Dimension | 'none')[] {
  return metricDef(metric).allowedBreakdowns.filter((dim) => {
    if (dim === 'none') return true;
    const meta = DIMENSION_META[dim];
    if (meta.roles && !meta.roles.includes(role)) return false;
    if (scopeRows && !splitsPopulation(scopeRows, dim)) return false;
    return true;
  });
}

/** Dimensions offered in filter popups (course + year are global-bar-owned). */
export function popupDimensions(role: Role): Dimension[] {
  return (Object.values(DIMENSION_META))
    .filter(
      (meta) =>
        meta.filterable &&
        meta.id !== 'course' &&
        meta.id !== 'year' &&
        (!meta.roles || meta.roles.includes(role)),
    )
    .map((meta) => meta.id);
}

/** Max nested split dimensions (primary + then-bys). */
export const MAX_BREAKDOWN_DEPTH = 3;

/** Active split chain: primary breakdown followed by thenBy dims. */
export function breakdownChain(config: Pick<ModuleConfig, 'breakdown' | 'thenBy'>): Dimension[] {
  if (config.breakdown === 'none') return [];
  const extra = (config.thenBy ?? []).filter((d, i, arr) => arr.indexOf(d) === i && d !== config.breakdown);
  return [config.breakdown, ...extra].slice(0, MAX_BREAKDOWN_DEPTH);
}

/**
 * Render-time sanitization: a saved chair module previewed as faculty renders
 * without professor dimensions instead of corrupting the saved config. With
 * `scopeRows`, a breakdown the scope pins to one group renders as 'none' —
 * the config keeps it, so widening the scope brings the breakdown back.
 */
export function sanitizeConfigForRole(
  config: ModuleConfig,
  role: Role,
  scopeRows?: StudentRow[],
): ModuleConfig {
  let next = config;
  const allowed = availableBreakdowns(config.metric, role, scopeRows);

  if (config.breakdown !== 'none' && !allowed.includes(config.breakdown)) {
    next = { ...next, breakdown: 'none', thenBy: undefined };
  }

  if (next.breakdown === 'none') {
    if (next.thenBy?.length) next = { ...next, thenBy: undefined };
  } else if (next.thenBy?.length) {
    const used = new Set<Dimension>([next.breakdown]);
    const cleaned: Dimension[] = [];
    for (const dim of next.thenBy) {
      if (used.has(dim)) continue;
      if (!allowed.includes(dim)) continue;
      used.add(dim);
      cleaned.push(dim);
      if (cleaned.length >= MAX_BREAKDOWN_DEPTH - 1) break;
    }
    next = {
      ...next,
      thenBy: cleaned.length > 0 ? cleaned : undefined,
    };
  }

  const blockedDims = (Object.keys(next.filters) as Dimension[]).filter((dim) => {
    const meta = DIMENSION_META[dim];
    return meta.roles && !meta.roles.includes(role);
  });
  if (blockedDims.length > 0) {
    const filters = { ...next.filters };
    for (const dim of blockedDims) delete filters[dim];
    next = { ...next, filters };
  }

  // A baseline the metric no longer offers (count metrics dropped the
  // population averages) self-heals instead of rendering a bogus scale.
  if (!availableCompareTos(next.metric).includes(next.compareTo)) {
    const opts = availableCompareTos(next.metric);
    next = { ...next, compareTo: opts.includes('median') ? 'median' : opts[0] };
  }

  return next;
}

/** Resolve the chart type actually rendered (falls back if no longer offered). */
export function effectiveChartType(config: ModuleConfig, info: AvailabilityInfo): ChartType {
  const types = availableChartTypes(config, info);
  return types.includes(config.chartType) ? config.chartType : types[0];
}
