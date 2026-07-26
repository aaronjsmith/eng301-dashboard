import type { FlagLevel, StudentRow } from '../types';
import { ageBandOf } from './scope';
import { ageSessionRisk, demographicPassGap } from './formulas';
import { THRESHOLDS } from './thresholds';

/**
 * FR6 — at-risk student flags. Rules are DERIVED from the preset thresholds,
 * never defined independently, so a student flag and its KRI can't disagree:
 * risk-slice membership only exists while the matching KRI is breached on the
 * same population.
 */

export interface FlagResult {
  byStudent: Map<StudentRow, FlagLevel>;
  counts: { fail: number; marginal: number; riskSlice: number; total: number };
  /** Which KRI slices are currently active, for UI captions. */
  activeSlices: string[];
}

export function flagStudents(rows: StudentRow[]): FlagResult {
  const byStudent = new Map<StudentRow, FlagLevel>();

  const r3 = ageSessionRisk(rows);
  const r3Breached =
    (r3.passGap !== null && r3.passGap >= THRESHOLDS.equityGapMax) ||
    (r3.scoreGap !== null && r3.scoreGap >= THRESHOLDS.equityGapMax);
  const firstGen = demographicPassGap(rows, 'firstGen');
  const firstGenBreached =
    firstGen !== null && Math.abs(firstGen.gap) > THRESHOLDS.equityGapMax;
  const pell = demographicPassGap(rows, 'pell');
  const pellBreached = pell !== null && Math.abs(pell.gap) > THRESHOLDS.equityGapMax;

  const activeSlices: string[] = [];
  if (r3Breached) activeSlices.push('18–21 × Summer (R3)');
  if (firstGenBreached) activeSlices.push('1st generation (R4)');
  if (pellBreached) activeSlices.push('Pell recipients (R4)');

  const inRiskSlice = (r: StudentRow) =>
    (r3Breached && ageBandOf(r.age) === '18–21' && r.session === 'Summer') ||
    (firstGenBreached && r.firstGen) ||
    (pellBreached && r.pell);

  let fail = 0;
  let marginal = 0;
  let riskSlice = 0;
  for (const row of rows) {
    if (!row.pass) {
      byStudent.set(row, 'fail');
      fail += 1;
    } else if (row.score >= THRESHOLDS.marginalMin && row.score < THRESHOLDS.marginalMax) {
      byStudent.set(row, 'marginal');
      marginal += 1;
    } else if (inRiskSlice(row)) {
      byStudent.set(row, 'riskSlice');
      riskSlice += 1;
    }
  }

  return {
    byStudent,
    counts: { fail, marginal, riskSlice, total: fail + marginal + riskSlice },
    activeSlices,
  };
}
