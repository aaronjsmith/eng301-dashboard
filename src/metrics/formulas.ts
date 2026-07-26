import type { Dimension, Session, StudentRow } from '../types';
import { SESSION_ORDER } from '../types';
import { ageBandOf, courseLevelOf, groupBy } from './scope';

/**
 * Pure KPI/KRI formulas (FR3). Every number on screen traces to one of these;
 * components never compute values themselves. Rates are 0–100 percentages.
 */

export interface RateResult {
  rate: number;
  passed: number;
  n: number;
}

export function passRate(rows: StudentRow[]): RateResult | null {
  if (rows.length === 0) return null;
  const passed = rows.filter((r) => r.pass).length;
  return { rate: (passed / rows.length) * 100, passed, n: rows.length };
}

export function dfwRate(rows: StudentRow[]): RateResult | null {
  const pr = passRate(rows);
  if (!pr) return null;
  return { rate: 100 - pr.rate, passed: pr.n - pr.passed, n: pr.n };
}

export function meanScore(rows: StudentRow[]): number | null {
  if (rows.length === 0) return null;
  return rows.reduce((sum, r) => sum + r.score, 0) / rows.length;
}

export function meanAge(rows: StudentRow[]): number | null {
  if (rows.length === 0) return null;
  return rows.reduce((sum, r) => sum + r.age, 0) / rows.length;
}

/** K3 — gateway DFW by course level (inherently cross-course). */
export function dfwByLevel(rows: StudentRow[]): {
  level100: RateResult | null;
  level200: RateResult | null;
  gap: number | null;
} {
  const l100 = dfwRate(rows.filter((r) => courseLevelOf(r.course) === '100-level'));
  const l200 = dfwRate(rows.filter((r) => courseLevelOf(r.course) === '200-level'));
  return {
    level100: l100,
    level200: l200,
    gap: l100 && l200 ? l100.rate - l200.rate : null,
  };
}

/** K4 — enrollment counts in session order. */
export function enrollmentBySession(rows: StudentRow[]): { session: Session; n: number }[] {
  return SESSION_ORDER.map((session) => ({
    session,
    n: rows.filter((r) => r.session === session).length,
  }));
}

/** K5 — completion (pass-rate) gap Full − Part. */
export function intensityGap(rows: StudentRow[]): {
  full: RateResult | null;
  part: RateResult | null;
  gap: number | null;
} {
  const full = passRate(rows.filter((r) => r.intensity === 'Full'));
  const part = passRate(rows.filter((r) => r.intensity === 'Part'));
  return { full, part, gap: full && part ? full.rate - part.rate : null };
}

/** R1 — mean-score gap, women − men. */
export function genderScoreGap(rows: StudentRow[]): {
  gap: number;
  fMean: number;
  mMean: number;
  fN: number;
  mN: number;
} | null {
  const f = rows.filter((r) => r.gender === 'F');
  const m = rows.filter((r) => r.gender === 'M');
  const fMean = meanScore(f);
  const mMean = meanScore(m);
  if (fMean === null || mMean === null) return null;
  return { gap: fMean - mMean, fMean, mMean, fN: f.length, mN: m.length };
}

/** Pass-rate gap, women − men (course-level highlight variant of R1). */
export function genderPassGap(rows: StudentRow[]): {
  gap: number;
  f: RateResult;
  m: RateResult;
} | null {
  const f = passRate(rows.filter((r) => r.gender === 'F'));
  const m = passRate(rows.filter((r) => r.gender === 'M'));
  if (!f || !m) return null;
  return { gap: f.rate - m.rate, f, m };
}

/** R2 (sharper formula) — share of ALL grades landing in the 70–89 mid-band. */
export function midBandShare(rows: StudentRow[]): number | null {
  if (rows.length === 0) return null;
  const mid = rows.filter((r) => r.score >= 70 && r.score < 90).length;
  return (mid / rows.length) * 100;
}

/** R2 (second formula) — max−min pass-rate spread across a grouping. */
export function passRateSpread(rows: StudentRow[], dim: Dimension): {
  spread: number;
  min: { value: string; rate: number };
  max: { value: string; rate: number };
} | null {
  const rates: { value: string; rate: number }[] = [];
  for (const [value, group] of groupBy(rows, dim)) {
    const pr = passRate(group);
    if (pr) rates.push({ value, rate: pr.rate });
  }
  if (rates.length < 2) return null;
  const min = rates.reduce((a, b) => (b.rate < a.rate ? b : a));
  const max = rates.reduce((a, b) => (b.rate > a.rate ? b : a));
  return { spread: max.rate - min.rate, min, max };
}

/** R3 — the 18–21 × Summer cell against everyone else. */
export function ageSessionRisk(rows: StudentRow[]): {
  cellPass: RateResult | null;
  otherPass: RateResult | null;
  cellScore: number | null;
  otherScore: number | null;
  passGap: number | null;
  scoreGap: number | null;
} {
  const inCell = (r: StudentRow) => ageBandOf(r.age) === '18–21' && r.session === 'Summer';
  const cell = rows.filter(inCell);
  const rest = rows.filter((r) => !inCell(r));
  const cellPass = passRate(cell);
  const otherPass = passRate(rest);
  const cellScore = meanScore(cell);
  const otherScore = meanScore(rest);
  return {
    cellPass,
    otherPass,
    cellScore,
    otherScore,
    passGap: cellPass && otherPass ? otherPass.rate - cellPass.rate : null,
    scoreGap: cellScore !== null && otherScore !== null ? otherScore - cellScore : null,
  };
}

/**
 * R4-family — pass-rate gap of a special population vs its complement:
 * first-gen − continuing, Pell − non-Pell, non-native − native.
 */
export function demographicPassGap(
  rows: StudentRow[],
  key: 'firstGen' | 'pell' | 'englishNative',
): { gap: number; group: RateResult; comparison: RateResult } | null {
  const inGroup = (r: StudentRow) =>
    key === 'englishNative' ? r.englishNative === 'Non' : r[key];
  const group = passRate(rows.filter(inGroup));
  const comparison = passRate(rows.filter((r) => !inGroup(r)));
  if (!group || !comparison) return null;
  return { gap: group.rate - comparison.rate, group, comparison };
}

/** Grade letters folded to the four display bands. */
export function gradeBandOf(row: StudentRow): 'A' | 'B' | 'C' | 'D/F' {
  const g = row.grade;
  if (g === 'A' || g === 'A-') return 'A';
  if (g === 'B+' || g === 'B' || g === 'B-') return 'B';
  if (g === 'C+' || g === 'C' || g === 'C-') return 'C';
  return 'D/F';
}

export const GRADE_BANDS = ['A', 'B', 'C', 'D/F'] as const;

export function gradeBandShares(rows: StudentRow[]): { band: string; share: number; n: number }[] {
  if (rows.length === 0) return [];
  return GRADE_BANDS.map((band) => {
    const n = rows.filter((r) => gradeBandOf(r) === band).length;
    return { band, share: (n / rows.length) * 100, n };
  });
}
