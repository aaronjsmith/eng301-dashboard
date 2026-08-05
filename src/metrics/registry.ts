import type {
  ChartType,
  Dimension,
  IndicatorKind,
  MetricId,
  StudentRow,
} from '../types';
import {
  demographicPassGap,
  dfwRate,
  genderScoreGap,
  gradeBandShares,
  meanScore,
  midBandShare,
  passRate,
} from './formulas';
import { flagStudents } from './flags';
import { countFmt, percent1, score1, signedPoints } from './format';
import { THRESHOLDS } from './thresholds';

/**
 * FR3 — the metric registry. A module's Lag/Lead badge, unit, target, default
 * chart, and allowed breakdowns are properties of its METRIC, defined here —
 * never user-set and never re-derived by components.
 */

export type MetricUnit = 'percent' | 'points' | 'count' | 'score';

export interface MetricDef {
  id: MetricId;
  label: string;
  kind: 'kpi' | 'kri';
  indicator: IndicatorKind;
  unit: MetricUnit;
  /** What the metric measures + whether higher/lower (or closer to zero) is better. */
  description: string;
  /** Hero value for a population; null = not computable (empty/one-sided). */
  compute(rows: StudentRow[]): number | null;
  format(value: number): string;
  /** Numeric target for the target baseline + status coloring. */
  target?: { value: number; label: string; direction: 'atLeast' | 'atMost' | 'within' };
  /** Gap alert threshold (|value| >) for gap metrics. */
  gapThreshold?: number;
  allowedBreakdowns: (Dimension | 'none')[];
  defaultChart: ChartType;
  /** Unused in ENG201-only builds; kept for type/API stability. */
  ignoresCourseFilter?: boolean;
  higherIsBetter?: boolean;
}

const EVERY_DIM: (Dimension | 'none')[] = [
  'none',
  'course',
  'year',
  'professor',
  'session',
  'gender',
  'ageBand',
  'major',
  'intensity',
  'firstGen',
  'pell',
  'englishNative',
  'residency',
];

export const METRICS: Record<MetricId, MetricDef> = {
  passRate: {
    id: 'passRate',
    label: 'Pass rate',
    kind: 'kpi',
    indicator: 'lagging',
    unit: 'percent',
    description:
      'Pass rate measures what share of students finished the course with a C− or better. A higher pass rate means more students completed successfully. Higher is better. Goal: at least 85%.',
    compute: (rows) => passRate(rows)?.rate ?? null,
    format: percent1,
    target: { value: THRESHOLDS.passRateTarget, label: '≥ 85%', direction: 'atLeast' },
    allowedBreakdowns: EVERY_DIM,
    defaultChart: 'bars',
    higherIsBetter: true,
  },
  dfwRate: {
    id: 'dfwRate',
    label: 'D/F/Withdraw rate',
    kind: 'kpi',
    indicator: 'lagging',
    unit: 'percent',
    description:
      'D/F/Withdraw rate measures what share of students earned a D, F, or withdrew — they did not finish with a C− or better. A lower rate means fewer unsuccessful outcomes. Lower is better. Goal: 15% or less.',
    compute: (rows) => dfwRate(rows)?.rate ?? null,
    format: percent1,
    target: {
      value: THRESHOLDS.dfwRateMax,
      label: '≤ 15%',
      direction: 'atMost',
    },
    allowedBreakdowns: EVERY_DIM,
    defaultChart: 'bars',
    higherIsBetter: false,
  },
  avgScore: {
    id: 'avgScore',
    label: 'Average score',
    kind: 'kpi',
    indicator: 'lagging',
    unit: 'score',
    description:
      'Average score is the mean numeric grade (0–100) for students in this view. A higher average means stronger overall performance. Higher is better. Goal: at least 80 (about a B−).',
    compute: meanScore,
    format: score1,
    target: { value: THRESHOLDS.avgScoreTarget, label: '≥ 80 (B−)', direction: 'atLeast' },
    allowedBreakdowns: EVERY_DIM,
    defaultChart: 'bars',
    higherIsBetter: true,
  },
  enrollment: {
    id: 'enrollment',
    label: 'Enrollment',
    kind: 'kpi',
    indicator: 'leading',
    unit: 'count',
    description:
      'Enrollment counts how many students are in the current view. Use it to see demand and whether a group is large enough to trust other stats. Steady or growing enrollment is usually better.',
    compute: (rows) => rows.length,
    format: countFmt,
    allowedBreakdowns: EVERY_DIM,
    defaultChart: 'area',
    higherIsBetter: true,
  },
  gradeDist: {
    id: 'gradeDist',
    label: 'Grade distribution',
    kind: 'kpi',
    indicator: 'lagging',
    unit: 'percent',
    description:
      'Grade distribution shows how final grades spread across A, B, C, and D/F. The big number is the share of A-range grades. A healthier mix usually has plenty of middle grades, not only highs and lows. A higher A-share can be good, but extreme piles at either end are a warning.',
    // Hero = A-range share; the composition itself renders as the chart.
    compute: (rows) => gradeBandShares(rows).find((b) => b.band === 'A')?.share ?? null,
    format: percent1,
    allowedBreakdowns: ['none', 'session', 'year', 'professor', 'course'],
    defaultChart: 'pie',
  },
  genderGap: {
    id: 'genderGap',
    label: 'Gender score gap (women − men)',
    kind: 'kri',
    indicator: 'lagging',
    unit: 'points',
    description:
      'Gender score gap is women’s average score minus men’s average score. It shows whether one group is behind the other. A gap near zero means outcomes are more even. Closer to zero is better. Warn above 5 points either way.',
    compute: (rows) => genderScoreGap(rows)?.gap ?? null,
    format: signedPoints,
    gapThreshold: THRESHOLDS.equityGapMax,
    allowedBreakdowns: ['none', 'professor', 'course', 'session', 'year', 'major', 'ageBand'],
    defaultChart: 'divergingBar',
  },
  firstGenGap: {
    id: 'firstGenGap',
    label: 'First-gen pass gap',
    kind: 'kri',
    indicator: 'lagging',
    unit: 'points',
    description:
      'First-gen pass gap compares pass rates for first-generation students vs everyone else. It flags whether first-gen students are finishing at a different rate. A gap near zero means more equal outcomes. Closer to zero is better. Warn above 5 points.',
    compute: (rows) => demographicPassGap(rows, 'firstGen')?.gap ?? null,
    format: signedPoints,
    gapThreshold: THRESHOLDS.equityGapMax,
    allowedBreakdowns: ['none', 'course', 'session', 'year', 'professor', 'major'],
    defaultChart: 'divergingBar',
  },
  pellGap: {
    id: 'pellGap',
    label: 'Pell pass gap',
    kind: 'kri',
    indicator: 'lagging',
    unit: 'points',
    description:
      'Pell pass gap compares pass rates for Pell Grant students vs everyone else. It shows whether students with financial need finish at a different rate. A gap near zero means more equal outcomes. Closer to zero is better. Warn above 5 points.',
    compute: (rows) => demographicPassGap(rows, 'pell')?.gap ?? null,
    format: signedPoints,
    gapThreshold: THRESHOLDS.equityGapMax,
    allowedBreakdowns: ['none', 'course', 'session', 'year', 'professor', 'major'],
    defaultChart: 'divergingBar',
  },
  midBandShare: {
    id: 'midBandShare',
    label: 'Middle-grade share (70–89)',
    kind: 'kri',
    indicator: 'lagging',
    unit: 'percent',
    description:
      'Middle-grade share measures what percent of students scored between 70 and 89. A healthy pattern usually has a solid middle band instead of grades piled only at the extremes. Higher is better within reason. Goal: at least 25%.',
    compute: midBandShare,
    format: percent1,
    target: { value: THRESHOLDS.midBandMin, label: '≥ 25%', direction: 'atLeast' },
    allowedBreakdowns: ['none', 'professor', 'course', 'session', 'year'],
    defaultChart: 'bars',
    higherIsBetter: true,
  },
  atRisk: {
    id: 'atRisk',
    label: 'At-risk students',
    kind: 'kri',
    indicator: 'leading',
    unit: 'count',
    description:
      'At-risk students counts how many people look like they may need help soon, based on failing or marginal scores and known risk patterns. A lower count means fewer students currently flagged. Lower is better.',
    compute: (rows) => flagStudents(rows).counts.total,
    format: countFmt,
    allowedBreakdowns: ['none', 'session', 'year', 'professor', 'course', 'ageBand', 'major'],
    defaultChart: 'bars',
    higherIsBetter: false,
  },
};

export function metricDef(id: MetricId): MetricDef {
  return METRICS[id];
}
