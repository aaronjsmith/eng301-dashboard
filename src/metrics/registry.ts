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
  /** Plain-language explanation (incl. abbreviations) — shown in hover tooltips. */
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
      'What share of students passed. Higher is better. Goal: at least 85 out of every 100.',
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
      'Share of students who earned a D, F, or Withdraw — did not finish with a C− or better. Lower is better. Goal: 15% or less.',
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
      'The average numeric score (0–100) for the students you are looking at. Goal: at least 80 (about a B−).',
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
      'How many students are in the current view. Use this to check if a group is big enough to trust the other numbers.',
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
      'How grades spread from A to F. The big number is the share of A-range grades.',
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
      'Average score for women minus average score for men. A gap bigger than 5 points means one group is behind.',
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
      'How much first-generation students’ pass rate differs from everyone else. Gaps over 5 points mean support may be needed.',
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
      'How much Pell Grant students’ pass rate differs from everyone else. Gaps over 5 points mean support may be needed.',
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
      'Share of students scoring between 70 and 89. If this is very low, grades may be piled at the extremes (lots of highs and lows). Goal: at least 25%.',
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
      'How many students look like they may need help soon, based on scores and known risk patterns. Lower is better.',
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
