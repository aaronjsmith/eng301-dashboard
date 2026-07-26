import type { PresetValue, StudentRow } from '../types';
import {
  ageSessionRisk,
  demographicPassGap,
  dfwByLevel,
  enrollmentBySession,
  genderScoreGap,
  intensityGap,
  meanScore,
  midBandShare,
  passRate,
  passRateSpread,
} from './formulas';
import { groupBy, SMALL_CELL } from './scope';
import { percent1, score1, signedPoints } from './format';
import { THRESHOLDS } from './thresholds';

/**
 * The preset panel (FR3) — the non-configurable metrics every viewer gets,
 * computed the same way every time. Panel order K1–K4 then R1–R4 per the
 * spec's mapping table; K5 is computed but off-panel (Highlights surfaces it
 * on breach). KRI breaches are 'critical'; KPI target misses are 'notable'.
 */

/**
 * @param scopeRows rows after role scope ∩ global filters — what presets read.
 * @param levelRows rows after role scope with the COURSE filter ignored —
 *   K3 is inherently cross-course (spec: gateway DFW by course level).
 */
export function computePresets(
  scopeRows: StudentRow[],
  levelRows: StudentRow[],
): PresetValue[] {
  const presets: PresetValue[] = [];

  // K1 — course pass rate
  const k1 = passRate(scopeRows);
  presets.push({
    id: 'K1',
    label: 'Course pass rate',
    kind: 'kpi',
    metric: 'passRate',
    formatted: k1 ? percent1(k1.rate) : '—',
    detail: k1 ? `${k1.passed}/${k1.n} students` : 'No data in scope',
    target: '≥ 85%',
    breach:
      k1 && k1.rate < THRESHOLDS.passRateTarget
        ? { severity: 'notable', formattedDelta: signedPoints(k1.rate - THRESHOLDS.passRateTarget) }
        : undefined,
  });

  // K2 — average course grade
  const k2 = meanScore(scopeRows);
  presets.push({
    id: 'K2',
    label: 'Average course grade',
    kind: 'kpi',
    metric: 'avgScore',
    formatted: k2 !== null ? score1(k2) : '—',
    detail: 'Mean of Score, letter distribution alongside',
    target: '≥ 80 (B−)',
    breach:
      k2 !== null && k2 < THRESHOLDS.avgScoreTarget
        ? { severity: 'notable', formattedDelta: signedPoints(k2 - THRESHOLDS.avgScoreTarget) }
        : undefined,
  });

  // K3 — gateway DFW by course level (ignores the course filter)
  const k3 = dfwByLevel(levelRows);
  presets.push({
    id: 'K3',
    label: 'Gateway DFW (100 vs 200 level)',
    kind: 'kpi',
    metric: 'dfwRate',
    formatted:
      k3.level100 && k3.level200
        ? `${percent1(k3.level100.rate)} vs ${percent1(k3.level200.rate)}`
        : '—',
    detail: 'All courses — 100-level vs 200-level',
    target: 'Within 3 pts',
    breach:
      k3.gap !== null && k3.gap > THRESHOLDS.levelGapMax
        ? { severity: 'notable', formattedDelta: signedPoints(k3.gap) }
        : undefined,
  });

  // K4 — enrollment by session
  const k4 = enrollmentBySession(scopeRows);
  presets.push({
    id: 'K4',
    label: 'Enrollment by session',
    kind: 'kpi',
    metric: 'enrollment',
    formatted: String(scopeRows.length),
    detail: k4.map((s) => `${s.session.slice(0, 2)} ${s.n}`).join(' · '),
    target: 'Stable or growing',
  });

  // R1 — gender performance gap, per professor (worst |gap| in scope)
  const r1Groups = [...groupBy(scopeRows, 'professor')]
    .map(([prof, rows]) => ({ prof, gap: genderScoreGap(rows) }))
    .filter((g) => g.gap !== null && g.gap.fN >= SMALL_CELL && g.gap.mN >= SMALL_CELL);
  const r1Worst =
    r1Groups.length > 0
      ? r1Groups.reduce((a, b) => (Math.abs(b.gap!.gap) > Math.abs(a.gap!.gap) ? b : a))
      : null;
  presets.push({
    id: 'R1',
    label: 'Gender performance gap',
    kind: 'kri',
    metric: 'genderGap',
    formatted: r1Worst ? signedPoints(r1Worst.gap!.gap) : '—',
    detail: r1Worst
      ? `${r1Worst.prof}: W ${score1(r1Worst.gap!.fMean)} vs M ${score1(r1Worst.gap!.mMean)}`
      : 'Cells under n = 20 suppressed',
    target: '|gap| ≤ 5 pts',
    breach:
      r1Worst && Math.abs(r1Worst.gap!.gap) > THRESHOLDS.equityGapMax
        ? { severity: 'critical', formattedDelta: signedPoints(r1Worst.gap!.gap) }
        : undefined,
  });

  // R2 — grade-distribution anomaly: min mid-band share + professor spread
  const r2Groups = [...groupBy(scopeRows, 'professor')]
    .map(([prof, rows]) => ({ prof, mid: midBandShare(rows), n: rows.length }))
    .filter((g) => g.mid !== null && g.n >= SMALL_CELL);
  const r2Worst =
    r2Groups.length > 0
      ? r2Groups.reduce((a, b) => (b.mid! < a.mid! ? b : a))
      : null;
  const r2Spread = passRateSpread(scopeRows, 'professor');
  const r2MidBreach = r2Worst !== null && r2Worst.mid! < THRESHOLDS.midBandMin;
  const r2SpreadBreach =
    r2Spread !== null && r2Spread.spread > THRESHOLDS.professorSpreadMax;
  presets.push({
    id: 'R2',
    label: 'Grade-distribution anomaly',
    kind: 'kri',
    metric: 'midBandShare',
    formatted: r2Worst ? `${percent1(r2Worst.mid!)} mid-band` : '—',
    detail: r2Worst
      ? `${r2Worst.prof} in 70–89 band (healthy 60–75%)`
      : 'Cells under n = 20 suppressed',
    target: 'Mid-band ≥ 25% · spread ≤ 15 pts',
    breach:
      r2MidBreach || r2SpreadBreach
        ? {
            severity: 'critical',
            formattedDelta: r2MidBreach
              ? signedPoints(r2Worst!.mid! - THRESHOLDS.midBandMin)
              : signedPoints(r2Spread!.spread),
          }
        : undefined,
  });

  // R3 — age-band × session risk (18–21 × Summer)
  const r3 = ageSessionRisk(scopeRows);
  const r3Breached =
    (r3.passGap !== null && r3.passGap >= THRESHOLDS.equityGapMax) ||
    (r3.scoreGap !== null && r3.scoreGap >= THRESHOLDS.equityGapMax);
  presets.push({
    id: 'R3',
    label: 'Age × session risk (18–21 Summer)',
    kind: 'kri',
    metric: 'passRate',
    formatted:
      r3.cellPass && r3.otherPass
        ? `${percent1(r3.cellPass.rate)} vs ${percent1(r3.otherPass.rate)}`
        : '—',
    detail:
      r3.cellScore !== null && r3.otherScore !== null
        ? `Scores ${score1(r3.cellScore)} vs ${score1(r3.otherScore)}`
        : 'No 18–21 Summer students in scope',
    target: 'Gap < 5 pts',
    breach: r3Breached
      ? { severity: 'critical', formattedDelta: signedPoints(-(r3.passGap ?? 0)) }
      : undefined,
  });

  // R4 — first-gen / Pell pass gap (chair/admin only — FERPA small cells)
  const firstGen = demographicPassGap(scopeRows, 'firstGen');
  const pell = demographicPassGap(scopeRows, 'pell');
  const r4Breached =
    (firstGen !== null && Math.abs(firstGen.gap) > THRESHOLDS.equityGapMax) ||
    (pell !== null && Math.abs(pell.gap) > THRESHOLDS.equityGapMax);
  presets.push({
    id: 'R4',
    label: '1st-gen / Pell pass gap',
    kind: 'kri',
    metric: 'firstGenGap',
    formatted: firstGen ? signedPoints(firstGen.gap) : '—',
    detail:
      firstGen && pell
        ? `1st gen ${percent1(firstGen.group.rate)} vs ${percent1(firstGen.comparison.rate)} · Pell ${signedPoints(pell.gap)}`
        : 'Insufficient data in scope',
    target: '|gap| ≤ 5 pts',
    roles: ['chair', 'admin'],
    breach: r4Breached
      ? {
          severity: 'critical',
          formattedDelta: signedPoints(
            firstGen && Math.abs(firstGen.gap) > THRESHOLDS.equityGapMax
              ? firstGen.gap
              : (pell?.gap ?? 0),
          ),
        }
      : undefined,
  });

  // K5 — completion by enrollment intensity (off-panel; Highlights on breach)
  const k5 = intensityGap(scopeRows);
  presets.push({
    id: 'K5',
    label: 'Completion by intensity',
    kind: 'kpi',
    metric: 'passRate',
    formatted:
      k5.full && k5.part
        ? `${percent1(k5.full.rate)} vs ${percent1(k5.part.rate)}`
        : '—',
    detail: 'Full-time vs part-time pass rate',
    target: '|gap| ≤ 5 pts',
    offPanel: true,
    breach:
      k5.gap !== null && Math.abs(k5.gap) > THRESHOLDS.equityGapMax
        ? { severity: 'critical', formattedDelta: signedPoints(k5.gap) }
        : undefined,
  });

  return presets;
}
