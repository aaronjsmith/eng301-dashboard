import type { Dimension, InvestigatePayload, Role, StudentRow } from '../types';
import { availableBreakdowns } from './availability';
import { metricDef } from './registry';
import { formatUnit } from './format';
import { groupBy, selectRows, SMALL_CELL, valueLabel, DIMENSION_META } from './scope';

/**
 * Root-cause mode (spec §3): freeze the highlight's slice, then scan — the
 * metric split by EVERY dimension the role may see, ranked by gap size.
 * Nothing is precomputed per highlight; the same procedure works for any
 * future breach the thresholds produce.
 */

export interface ScanGroup {
  label: string;
  value: number;
  formatted: string;
  n: number;
}

export interface ScanRow {
  dim: Dimension;
  dimLabel: string;
  gap: number;
  formattedGap: string;
  lowest: ScanGroup;
  highest: ScanGroup;
  groupCount: number;
}

export interface ScanResult {
  sliceN: number;
  sliceValue: number | null;
  sliceFormatted: string;
  baselineValue: number | null;
  baselineFormatted: string;
  rows: ScanRow[];
}

export function dimensionScan(
  scopeRows: StudentRow[],
  payload: InvestigatePayload,
  role: Role,
): ScanResult {
  const def = metricDef(payload.metric);
  const sliceRows = selectRows(scopeRows, payload.slice);
  const baselineRows = selectRows(scopeRows, payload.baseline);

  const sliceValue = def.compute(sliceRows);
  const baselineValue = def.compute(baselineRows);

  const frozenDims = new Set(Object.keys(payload.slice) as Dimension[]);
  const candidates = availableBreakdowns(payload.metric, role).filter(
    (d): d is Dimension => d !== 'none' && !frozenDims.has(d),
  );

  const rows: ScanRow[] = [];
  for (const dim of candidates) {
    const groups: ScanGroup[] = [];
    for (const [key, rowsInGroup] of groupBy(sliceRows, dim)) {
      // Small-cell rule applies to the scan too (faculty see own students).
      if (role !== 'faculty' && rowsInGroup.length < SMALL_CELL) continue;
      if (rowsInGroup.length === 0) continue;
      const value = def.compute(rowsInGroup);
      if (value === null) continue;
      groups.push({
        label: valueLabel(dim, key),
        value,
        formatted: formatUnit(value, def.unit),
        n: rowsInGroup.length,
      });
    }
    if (groups.length < 2) continue;
    const lowest = groups.reduce((a, b) => (b.value < a.value ? b : a));
    const highest = groups.reduce((a, b) => (b.value > a.value ? b : a));
    const gap = highest.value - lowest.value;
    rows.push({
      dim,
      dimLabel: DIMENSION_META[dim].label,
      gap,
      formattedGap: `${gap.toFixed(1)} pts`,
      lowest,
      highest,
      groupCount: groups.length,
    });
  }

  rows.sort((a, b) => b.gap - a.gap);

  return {
    sliceN: sliceRows.length,
    sliceValue,
    sliceFormatted: sliceValue !== null ? formatUnit(sliceValue, def.unit) : '—',
    baselineValue,
    baselineFormatted:
      baselineValue !== null ? formatUnit(baselineValue, def.unit) : '—',
    rows,
  };
}
