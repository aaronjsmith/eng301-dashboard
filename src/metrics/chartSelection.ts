import type { Dimension, FlagLevel, MetricId, StudentRow } from '../types';
import { gradeBandOf } from './formulas';
import { dimensionValue } from './scope';

/** Pass-rate composition keys (no breakdown). */
const PASS_COMPOSITION = new Set(['pass', 'fail', 'marginal']);

/**
 * Whether a student belongs to a clicked chart mark. Used to filter the
 * student list when drilling into a bar/slice.
 */
export function studentMatchesChartKey(
  row: StudentRow,
  flag: FlagLevel | undefined,
  key: string,
  metric: MetricId,
  breakdown: Dimension | 'none',
): boolean {
  if (metric === 'passRate' && breakdown === 'none' && PASS_COMPOSITION.has(key)) {
    if (key === 'fail') return !row.pass;
    if (key === 'marginal') return flag === 'marginal';
    return row.pass; // pass bar includes all who passed (incl. marginal)
  }

  if (metric === 'gradeDist') {
    return gradeBandOf(row) === key;
  }

  if (breakdown !== 'none') {
    return dimensionValue(row, breakdown) === key;
  }

  return true;
}

