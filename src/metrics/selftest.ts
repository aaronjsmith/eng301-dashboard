import type { StudentRow } from '../types';
import {
  ageSessionRisk,
  demographicPassGap,
  dfwByLevel,
  enrollmentBySession,
  genderPassGap,
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
 */

interface Check {
  name: string;
  expected: number;
  actual: number | null | undefined;
  tolerance?: number;
}

export function runSelfTest(rows: StudentRow[]): boolean {
  const eng201 = rows.filter((r) => r.course === 'ENG201');
  const eng101 = rows.filter((r) => r.course === 'ENG101');
  const profOf = (name: string) => eng201.filter((r) => r.professor === name);

  const checks: Check[] = [];
  const push = (name: string, expected: number, actual: number | null | undefined, tolerance = 0.06) =>
    checks.push({ name, expected, actual, tolerance });

  // Row counts
  push('total rows', 1698, rows.length, 0);
  push('ENG201 rows', 444, eng201.length, 0);

  // K1/K2
  const k1 = passRate(eng201);
  push('K1 ENG201 pass rate', 86.0, k1?.rate);
  push('K1 ENG201 passed', 382, k1?.passed, 0);
  push('K2 ENG201 mean score', 81.2, meanScore(eng201));

  // K3 (all courses)
  const k3 = dfwByLevel(rows);
  push('K3 100-level DFW', 21.0, k3.level100?.rate);
  push('K3 200-level DFW', 14.4, k3.level200?.rate);

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

  // R2 — Professor B bimodality
  push('R2 Prof B mid-band', 0, midBandShare(profOf('Professor B')), 0.01);
  const bFailsAll = rows.filter((r) => r.professor === 'Professor B' && !r.pass).length;
  const failsAll = rows.filter((r) => !r.pass).length;
  push('R2 Prof B fails (all courses)', 137, bFailsAll, 0);
  push('R2 total fails (all courses)', 309, failsAll, 0);
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
  const g101 = genderPassGap(eng101);
  push('ENG101 gender pass gap', 11.0, g101?.gap, 0.1);
  const nonNative = demographicPassGap(eng201, 'englishNative');
  push('non-native gap', -6.3, nonNative?.gap, 0.1);
  const bus = passRate(eng201.filter((r) => r.major === 'BUS'));
  push('BUS majors pass', 78.4, bus?.rate);
  push('BUS majors n', 51, bus?.n, 0);
  push('DT majors n (small cell)', 11, eng201.filter((r) => r.major === 'DT').length, 0);

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
