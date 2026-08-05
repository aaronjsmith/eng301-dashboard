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
  config: Pick<ModuleConfig, 'metric' | 'breakdown'>,
  info: AvailabilityInfo,
): ChartType[] {
  const def = metricDef(config.metric);
  const { breakdown } = config;

  // Gap metrics: diverging bars only — the one form whose zero axis renders
  // negative gaps honestly (a plain bar would clamp them to a stub).
  if (def.gapThreshold !== undefined) return ['divergingBar'];

  if (config.metric === 'gradeDist') {
    const types: ChartType[] = ['pie', 'bars'];
    if (breakdown === 'session') types.push('area'); // stacked bands over time
    return types;
  }

  const types: ChartType[] = ['bars'];
  if (breakdown !== 'none') {
    if (breakdown === 'session' || breakdown === 'year') types.push('area'); // ordered axis
    if (
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

  if (
    config.breakdown !== 'none' &&
    !availableBreakdowns(config.metric, role, scopeRows).includes(config.breakdown)
  ) {
    next = { ...next, breakdown: 'none' };
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
