import type { StudentRow } from '../types';
import {
  ageSessionRisk,
  demographicPassGap,
  dfwRate,
  enrollmentBySession,
  genderScoreGap,
  intensityGap,
  meanScore,
  midBandShare,
  passRate,
} from './formulas';
import { flagStudents } from './flags';
import { groupBy } from './scope';

/**
 * Dev-only self-test (spec Phase-2 verification): asserts the engine against
 * the workbook numbers verified during planning. Runs on every dev load after
 * a successful import; a red row here means a formula regressed.
 * Expects ENG201-only rows (normalize drops every other course).
 */

interface Check {
  name: string;
  expected: number;
  actual: number | null | undefined;
  tolerance?: number;
}

export function runSelfTest(rows: StudentRow[]): boolean {
  // The original ENG201 spec numbers hold on the CURRENT-YEAR subset; the
  // 2025 cohort has its own structural checks below.
  const cur = rows.filter((r) => r.year === 2026);
  const prior = rows.filter((r) => r.year === 2025);
  const eng201 = cur.filter((r) => r.course === 'ENG201');
  const profOf = (name: string) => eng201.filter((r) => r.professor === name);

  const checks: Check[] = [];
  const push = (name: string, expected: number, actual: number | null | undefined, tolerance = 0.06) =>
    checks.push({ name, expected, actual, tolerance });

  // Row counts (ENG201-only import)
  push('total rows (2026)', 444, cur.length, 0);
  push('ENG201 rows', 444, eng201.length, 0);
  push('only ENG201 courses', 1, new Set(rows.map((r) => r.course)).size, 0);

  // K1/K2
  const k1 = passRate(eng201);
  push('K1 ENG201 pass rate', 86.0, k1?.rate);
  push('K1 ENG201 passed', 382, k1?.passed, 0);
  push('K2 ENG201 mean score', 81.2, meanScore(eng201));

  // K3 — DFW rate (ENG201)
  push('K3 ENG201 DFW', 14.0, dfwRate(eng201)?.rate);

  // K4
  const k4 = enrollmentBySession(eng201);
  push('K4 Fall', 145, k4.find((s) => s.session === 'Fall')?.n, 0);
  push('K4 Spring', 129, k4.find((s) => s.session === 'Spring')?.n, 0);
  push('K4 Summer', 86, k4.find((s) => s.session === 'Summer')?.n, 0);
  push('K4 Winter', 84, k4.find((s) => s.session === 'Winter')?.n, 0);

  // K5
  const k5 = intensityGap(eng201);
  push('K5 full-time pass', 83.8, k5.full?.rate);
  push('K5 part-time pass', 87.6, k5.part?.rate);

  // R1 — Professor A gender score gap (ENG201)
  const r1a = genderScoreGap(profOf('Professor A'));
  push('R1 Prof A gap (W−M)', 9.0, r1a?.gap, 0.1);
  push('R1 Prof A women mean', 84.6, r1a?.fMean);
  push('R1 Prof A men mean', 75.6, r1a?.mMean);
  const r1c = genderScoreGap(profOf('Professor C'));
  push('R1 Prof C gap ≈ 0', -0.9, r1c?.gap, 0.5);

  // R2 — Professor B bimodality (ENG201-scoped)
  push('R2 Prof B mid-band', 0, midBandShare(profOf('Professor B')), 0.01);
  push('R2 total fails (ENG201)', 62, eng201.filter((r) => !r.pass).length, 0);
  push('R2 Prof B ENG201 pass rate', 81.4, passRate(profOf('Professor B'))?.rate);

  // R3 — 18–21 × Summer (ENG201)
  const r3 = ageSessionRisk(eng201);
  push('R3 cell pass', 59.1, r3.cellPass?.rate);
  push('R3 others pass', 89.0, r3.otherPass?.rate);
  push('R3 cell score', 71.7, r3.cellScore);
  push('R3 others score', 82.3, r3.otherScore);

  // R4 — first-gen / Pell (ENG201)
  const firstGen = demographicPassGap(eng201, 'firstGen');
  push('R4 1st-gen pass', 77.1, firstGen?.group.rate);
  push('R4 continuing pass', 89.3, firstGen?.comparison.rate);
  push('R4 1st-gen gap', -12.2, firstGen?.gap, 0.1);
  const pell = demographicPassGap(eng201, 'pell');
  push('R4 Pell gap', -1.3, pell?.gap, 0.1);

  // FR6 flags (ENG201)
  const flags = flagStudents(eng201);
  push('flags failing', 62, flags.counts.fail, 0);
  push('flags marginal (70–74)', 50, flags.counts.marginal, 0);

  // Notable highlights
  const sessions = new Map(
    [...groupBy(eng201, 'session')].map(([s, g]) => [s, passRate(g)?.rate]),
  );
  push('session Fall pass', 91.7, sessions.get('Fall'));
  push('session Spring pass', 84.5, sessions.get('Spring'));
  push('session Summer pass', 73.3, sessions.get('Summer'));
  const nonNative = demographicPassGap(eng201, 'englishNative');
  push('non-native gap', -6.3, nonNative?.gap, 0.1);
  const bus = passRate(eng201.filter((r) => r.major === 'BUS'));
  push('BUS majors pass', 78.4, bus?.rate);
  push('BUS majors n', 51, bus?.n, 0);
  push('DT majors n (small cell)', 11, eng201.filter((r) => r.major === 'DT').length, 0);

  // ── 2025 cohort (ENG201 only) ───────────────────────────────────────────
  if (prior.length > 0) {
    const p201 = prior.filter((r) => r.course === 'ENG201');
    push('2025 rows total', 400, prior.length, 0);
    push('2025 ENG201 rows', 400, p201.length, 0);
    push('2025 ENG201 pass rate', 86.8, passRate(p201)?.rate, 0.1);
    // Persistent pattern: first-gen gap breached in 2025 too.
    push('2025 ENG201 1st-gen gap', -16.0, demographicPassGap(p201, 'firstGen')?.gap, 0.1);
    // Scenarios absent in 2025: Prof A gap small, Prof B mid-band healthy,
    // no 18–21×Summer effect (structural, tolerance = the alert threshold).
    push(
      '2025 Prof A gender gap ≈ 0',
      0,
      genderScoreGap(p201.filter((r) => r.professor === 'Professor A'))?.gap,
      5,
    );
    push(
      '2025 Prof B mid-band healthy',
      76.4,
      midBandShare(p201.filter((r) => r.professor === 'Professor B')),
      0.1,
    );
    const r3p = ageSessionRisk(p201);
    push('2025 summer-age pass gap ≈ 0', 0, r3p.passGap, 5);
    push('2025 summer-age score gap ≈ 0', 0, r3p.scoreGap, 5);
  }

  const results = checks.map((c) => {
    const pass =
      c.actual !== null &&
      c.actual !== undefined &&
      Math.abs(c.actual - c.expected) <= (c.tolerance ?? 0.06);
    return {
      check: c.name,
      expected: c.expected,
      actual: c.actual ?? NaN,
      pass: pass ? '✓' : '✗ FAIL',
    };
  });

  const failures = results.filter((r) => r.pass !== '✓');
  console.groupCollapsed(
    `[selftest] ${results.length - failures.length}/${results.length} checks pass${failures.length > 0 ? ` — ${failures.length} FAILING` : ''}`,
  );
  console.table(results);
  console.groupEnd();
  if (failures.length > 0) {
    console.error('[selftest] failing checks:', failures);
  }
  return failures.length === 0;
}
