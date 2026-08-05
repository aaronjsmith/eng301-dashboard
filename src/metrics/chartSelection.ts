import type { Dimension, FlagLevel, MetricId, StudentRow } from '../types';
import { gradeBandOf } from './formulas';
import { dimensionValue } from './scope';

/** Pass-rate composition keys (no breakdown). */
const PASS_COMPOSITION = new Set(['pass', 'fail', 'marginal']);

/** Unit separator — unlikely in dimension value strings. */
const KEY_SEP = '\u001f';

export function encodeChartKey(parts: string[]): string {
  return parts.join(KEY_SEP);
}

export function decodeChartKey(key: string): string[] {
  return key.split(KEY_SEP);
}

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
  thenBy: Dimension[] = [],
): boolean {
  if (metric === 'passRate' && breakdown === 'none' && PASS_COMPOSITION.has(key)) {
    if (key === 'fail') return !row.pass;
    if (key === 'marginal') return flag === 'marginal';
    return row.pass; // pass bar includes all who passed (incl. marginal)
  }

  if (metric === 'gradeDist') {
    return gradeBandOf(row) === key;
  }

  const dims: Dimension[] =
    breakdown === 'none' ? [] : [breakdown, ...thenBy.filter((d) => d !== breakdown)];
  if (dims.length > 0) {
    const parts = decodeChartKey(key);
    if (parts.length === dims.length) {
      return dims.every((d, i) => dimensionValue(row, d) === parts[i]);
    }
    // Legacy single-dimension keys (or mismatched nest depth).
    return dimensionValue(row, breakdown as Dimension) === key;
  }

  return true;
}
