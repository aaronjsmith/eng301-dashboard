import type { ChartType, Dimension, ModuleConfig, Role } from '../types';
import { DIMENSION_META } from './scope';
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

const RATE_METRICS = new Set(['passRate', 'dfwRate', 'midBandShare']);

export function availableChartTypes(
  config: Pick<ModuleConfig, 'metric' | 'breakdown'>,
  info: AvailabilityInfo,
): ChartType[] {
  const def = metricDef(config.metric);
  const { breakdown } = config;

  // Gap metrics: diverging bars are the default rendering (design doc).
  if (def.gapThreshold !== undefined) return ['divergingBar', 'bars'];

  if (config.metric === 'gradeDist') {
    const types: ChartType[] = ['pie', 'bars'];
    if (breakdown === 'session') types.push('area'); // stacked bands over time
    return types;
  }

  const types: ChartType[] = [];
  if (breakdown === 'none') {
    if (RATE_METRICS.has(config.metric)) types.push('donut');
    types.push('bars');
  } else {
    types.push('bars');
    if (breakdown === 'session') types.push('area'); // ordered axis
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

/** Breakdown options a role may use for a metric (faculty never see professor). */
export function availableBreakdowns(
  metric: ModuleConfig['metric'],
  role: Role,
): (Dimension | 'none')[] {
  return metricDef(metric).allowedBreakdowns.filter((dim) => {
    if (dim === 'none') return true;
    const meta = DIMENSION_META[dim];
    return !meta.roles || meta.roles.includes(role);
  });
}

/** Dimensions offered in filter popups for a role (course is global-bar-owned). */
export function popupDimensions(role: Role): Dimension[] {
  return (Object.values(DIMENSION_META))
    .filter(
      (meta) =>
        meta.filterable &&
        meta.id !== 'course' &&
        (!meta.roles || meta.roles.includes(role)),
    )
    .map((meta) => meta.id);
}

/**
 * Render-time sanitization: a saved chair module previewed as faculty renders
 * without professor dimensions instead of corrupting the saved config.
 */
export function sanitizeConfigForRole(config: ModuleConfig, role: Role): ModuleConfig {
  let next = config;

  if (config.breakdown !== 'none') {
    const meta = DIMENSION_META[config.breakdown];
    if (meta.roles && !meta.roles.includes(role)) {
      next = { ...next, breakdown: 'none' };
    }
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

  return next;
}

/** Resolve the chart type actually rendered (falls back if no longer offered). */
export function effectiveChartType(config: ModuleConfig, info: AvailabilityInfo): ChartType {
  const types = availableChartTypes(config, info);
  return types.includes(config.chartType) ? config.chartType : types[0];
}
