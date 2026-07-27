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
  /** Plain-English “what is this?” for module help text. */
  description: string;
  kind: 'kpi' | 'kri';
  indicator: IndicatorKind;
  unit: MetricUnit;
  /** Hero value for a population; null = not computable (empty/one-sided). */
  compute(rows: StudentRow[]): number | null;
  format(value: number): string;
  /** Numeric target for the target baseline + status coloring. */
  target?: { value: number; label: string; direction: 'atLeast' | 'atMost' | 'within' };
  /** Gap alert threshold (|value| >) for gap metrics. */
  gapThreshold?: number;
  allowedBreakdowns: (Dimension | 'none')[];
  defaultChart: ChartType;
  /** True for inherently cross-course metrics (K3): the course filter is ignored. */
  ignoresCourseFilter?: boolean;
  higherIsBetter?: boolean;
}

const EVERY_DIM: (Dimension | 'none')[] = [
  'none',
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
  'course',
  'courseLevel',
];

export const METRICS: Record<MetricId, MetricDef> = {
  passRate: {
    id: 'passRate',
    label: 'Pass rate',
    description:
      'What share of students passed. Higher is better. The goal is at least 85 out of every 100 students.',
    kind: 'kpi',
    indicator: 'lagging',
    unit: 'percent',
    compute: (rows) => passRate(rows)?.rate ?? null,
    format: percent1,
    target: { value: THRESHOLDS.passRateTarget, label: '≥ 85%', direction: 'atLeast' },
    allowedBreakdowns: EVERY_DIM,
    defaultChart: 'donut',
    higherIsBetter: true,
  },
  dfwRate: {
    id: 'dfwRate',
    label: 'DFW rate',
    description:
      'DFW means D, F, or Withdraw. This is the share of students who did not finish with a C− or better. Lower is better.',
    kind: 'kpi',
    indicator: 'lagging',
    unit: 'percent',
    compute: (rows) => dfwRate(rows)?.rate ?? null,
    format: percent1,
    target: {
      value: 100 - THRESHOLDS.passRateTarget,
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
    description:
      'The average numeric score for the students you are looking at. The goal is at least 80 (about a B−).',
    kind: 'kpi',
    indicator: 'lagging',
    unit: 'score',
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
    description:
      'How many students are in the current view. Use this to see if a group is big enough to trust the other numbers.',
    kind: 'kpi',
    indicator: 'leading',
    unit: 'count',
    compute: (rows) => rows.length,
    format: countFmt,
    allowedBreakdowns: EVERY_DIM,
    defaultChart: 'area',
    higherIsBetter: true,
  },
  gradeDist: {
    id: 'gradeDist',
    label: 'Grade distribution',
    description:
      'How grades are spread from A to F. The big number is the share of A-range grades. Use it to spot unusual grading patterns.',
    kind: 'kpi',
    indicator: 'lagging',
    unit: 'percent',
    // Hero = A-range share; the composition itself renders as the chart.
    compute: (rows) => gradeBandShares(rows).find((b) => b.band === 'A')?.share ?? null,
    format: percent1,
    allowedBreakdowns: ['none', 'session', 'professor', 'course'],
    defaultChart: 'pie',
  },
  genderGap: {
    id: 'genderGap',
    label: 'Gender score gap (W − M)',
    description:
      'Average score for women minus average score for men. A gap larger than 5 points raises a warning that one group is behind.',
    kind: 'kri',
    indicator: 'lagging',
    unit: 'points',
    compute: (rows) => genderScoreGap(rows)?.gap ?? null,
    format: signedPoints,
    gapThreshold: THRESHOLDS.equityGapMax,
    allowedBreakdowns: ['none', 'professor', 'course', 'session', 'major', 'ageBand'],
    defaultChart: 'divergingBar',
  },
  firstGenGap: {
    id: 'firstGenGap',
    label: '1st-gen pass gap',
    description:
      'How much first-generation students’ pass rate differs from everyone else. Positive means first-gen students are ahead; negative means they are behind.',
    kind: 'kri',
    indicator: 'lagging',
    unit: 'points',
    compute: (rows) => demographicPassGap(rows, 'firstGen')?.gap ?? null,
    format: signedPoints,
    gapThreshold: THRESHOLDS.equityGapMax,
    allowedBreakdowns: ['none', 'course', 'session', 'professor', 'major'],
    defaultChart: 'divergingBar',
  },
  pellGap: {
    id: 'pellGap',
    label: 'Pell pass gap',
    description:
      'How much Pell Grant students’ pass rate differs from everyone else. Gaps over 5 points mean support may be needed.',
    kind: 'kri',
    indicator: 'lagging',
    unit: 'points',
    compute: (rows) => demographicPassGap(rows, 'pell')?.gap ?? null,
    format: signedPoints,
    gapThreshold: THRESHOLDS.equityGapMax,
    allowedBreakdowns: ['none', 'course', 'session', 'professor', 'major'],
    defaultChart: 'divergingBar',
  },
  midBandShare: {
    id: 'midBandShare',
    label: 'Mid-band grade share (70–89)',
    description:
      'Share of students scoring between 70 and 89. If this is very low, grades may be piled at the extremes (lots of highs and lows).',
    kind: 'kri',
    indicator: 'lagging',
    unit: 'percent',
    compute: midBandShare,
    format: percent1,
    target: { value: THRESHOLDS.midBandMin, label: '≥ 25%', direction: 'atLeast' },
    allowedBreakdowns: ['none', 'professor', 'course', 'session'],
    defaultChart: 'bars',
    higherIsBetter: true,
  },
  atRisk: {
    id: 'atRisk',
    label: 'At-risk students',
    description:
      'How many students look like they may need help soon, based on scores and known risk patterns. Lower is better.',
    kind: 'kri',
    indicator: 'leading',
    unit: 'count',
    compute: (rows) => flagStudents(rows).counts.total,
    format: countFmt,
    allowedBreakdowns: ['none', 'session', 'professor', 'course', 'ageBand', 'major'],
    defaultChart: 'bars',
    higherIsBetter: false,
  },
};

export function metricDef(id: MetricId): MetricDef {
  return METRICS[id];
}
