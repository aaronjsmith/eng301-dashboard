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
  /** True for inherently cross-course metrics (K3): the course filter is ignored. */
  ignoresCourseFilter?: boolean;
  higherIsBetter?: boolean;
}

const EVERY_DIM: (Dimension | 'none')[] = [
  'none',
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
  'course',
  'courseLevel',
];

export const METRICS: Record<MetricId, MetricDef> = {
  passRate: {
    id: 'passRate',
    label: 'Pass rate',
    kind: 'kpi',
    indicator: 'lagging',
    unit: 'percent',
    description:
      'Share of students in scope who passed the course. Lagging outcome measure; target ≥ 85%.',
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
    kind: 'kpi',
    indicator: 'lagging',
    unit: 'percent',
    description:
      'DFW = D, F, or Withdrawal — the share of students who did not complete the course successfully. Lower is better; target ≤ 15%.',
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
    kind: 'kpi',
    indicator: 'lagging',
    unit: 'score',
    description:
      'Mean numeric course score (0–100) across students in scope. Target ≥ 80, roughly a B−.',
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
      'Number of enrolled student records in the current scope. Leading indicator of demand and section capacity.',
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
      'How grades spread across the A / B / C / D–F bands. The headline number is the A-range share.',
    // Hero = A-range share; the composition itself renders as the chart.
    compute: (rows) => gradeBandShares(rows).find((b) => b.band === 'A')?.share ?? null,
    format: percent1,
    allowedBreakdowns: ['none', 'session', 'year', 'professor', 'course'],
    defaultChart: 'pie',
  },
  genderGap: {
    id: 'genderGap',
    label: 'Gender score gap (W − M)',
    kind: 'kri',
    indicator: 'lagging',
    unit: 'points',
    description:
      'Average score of women (W) minus men (M), in points. Positive = women score higher. Alert when the gap exceeds 5 pts either way.',
    compute: (rows) => genderScoreGap(rows)?.gap ?? null,
    format: signedPoints,
    gapThreshold: THRESHOLDS.equityGapMax,
    allowedBreakdowns: ['none', 'professor', 'course', 'session', 'year', 'major', 'ageBand'],
    defaultChart: 'divergingBar',
  },
  firstGenGap: {
    id: 'firstGenGap',
    label: '1st-gen pass gap',
    kind: 'kri',
    indicator: 'lagging',
    unit: 'points',
    description:
      'Pass rate of first-generation college students minus continuing-generation students, in points. Alert when the gap exceeds 5 pts either way.',
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
      'Pass rate of Pell-eligible students (need-based federal aid) minus non-Pell students, in points. Alert when the gap exceeds 5 pts either way.',
    compute: (rows) => demographicPassGap(rows, 'pell')?.gap ?? null,
    format: signedPoints,
    gapThreshold: THRESHOLDS.equityGapMax,
    allowedBreakdowns: ['none', 'course', 'session', 'year', 'professor', 'major'],
    defaultChart: 'divergingBar',
  },
  midBandShare: {
    id: 'midBandShare',
    label: 'Mid-band grade share (70–89)',
    kind: 'kri',
    indicator: 'lagging',
    unit: 'percent',
    description:
      'Share of grades landing in the 70–89 mid band. A very low share signals all-or-nothing grading; target ≥ 25%.',
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
      'Students flagged by preset thresholds: failing, marginal, or in a known risk slice. Leading warning signal — lower is better.',
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
