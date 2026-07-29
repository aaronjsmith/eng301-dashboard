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
function buildPresets(
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
    value: k1?.rate ?? null,
    formatted: k1 ? percent1(k1.rate) : '—',
    detail: k1 ? `${k1.passed}/${k1.n} students` : 'No data in scope',
    target: '≥ 85%',
    description:
      'KPI — share of students in the current scope who passed the course. Target ≥ 85%.',
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
    value: k2,
    formatted: k2 !== null ? score1(k2) : '—',
    detail: 'Mean of Score, letter distribution alongside',
    target: '≥ 80 (B−)',
    description:
      'KPI — mean numeric score (0–100) across students in scope. Target ≥ 80, roughly a B−.',
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
    value: k3.gap,
    formatted:
      k3.level100 && k3.level200
        ? `${percent1(k3.level100.rate)} vs ${percent1(k3.level200.rate)}`
        : '—',
    detail: 'All courses — 100-level vs 200-level',
    target: 'Within 3 pts',
    description:
      'KPI — DFW (D, F, or Withdrawal) rate of 100-level vs 200-level gateway courses. Always cross-course: it ignores the course filter. Target: levels within 3 pts.',
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
    value: scopeRows.length,
    formatted: String(scopeRows.length),
    detail: k4.map((s) => `${s.session.slice(0, 2)} ${s.n}`).join(' · '),
    target: 'Stable or growing',
    description:
      'KPI — total enrollment in the current scope, broken out by session. Target: stable or growing term over term.',
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
    value: r1Worst ? r1Worst.gap!.gap : null,
    formatted: r1Worst ? signedPoints(r1Worst.gap!.gap) : '—',
    detail: r1Worst
      ? `${r1Worst.prof}: W ${score1(r1Worst.gap!.fMean)} vs M ${score1(r1Worst.gap!.mMean)}`
      : 'Cells under n = 20 suppressed',
    target: '|gap| ≤ 5 pts',
    description:
      'KRI — the worst per-professor gap between women’s and men’s average scores (groups under 20 students excluded). Target: gap within 5 pts.',
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
    value: r2Worst ? r2Worst.mid! : null,
    formatted: r2Worst ? `${percent1(r2Worst.mid!)} mid-band` : '—',
    detail: r2Worst
      ? `${r2Worst.prof} in 70–89 band (healthy 60–75%)`
      : 'Cells under n = 20 suppressed',
    target: 'Mid-band ≥ 25% · spread ≤ 15 pts',
    description:
      'KRI — grading-shape anomaly: the professor with the fewest grades in the 70–89 band, plus the pass-rate spread across professors. Targets: mid-band ≥ 25%, spread ≤ 15 pts.',
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
    value: r3.passGap,
    formatted:
      r3.cellPass && r3.otherPass
        ? `${percent1(r3.cellPass.rate)} vs ${percent1(r3.otherPass.rate)}`
        : '—',
    detail:
      r3.cellScore !== null && r3.otherScore !== null
        ? `Scores ${score1(r3.cellScore)} vs ${score1(r3.otherScore)}`
        : 'No 18–21 Summer students in scope',
    target: 'Gap < 5 pts',
    description:
      'KRI — pass rate of 18–21-year-olds taking Summer sessions vs everyone else, a known risk cell. Target: gap under 5 pts.',
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
    value: firstGen?.gap ?? null,
    formatted: firstGen ? signedPoints(firstGen.gap) : '—',
    detail:
      firstGen && pell
        ? `1st gen ${percent1(firstGen.group.rate)} vs ${percent1(firstGen.comparison.rate)} · Pell ${signedPoints(pell.gap)}`
        : 'Insufficient data in scope',
    target: '|gap| ≤ 5 pts',
    description:
      'KRI — pass-rate gaps for first-generation and Pell-eligible (need-based aid) students vs their comparison groups. Visible to chair/admin only (FERPA small cells). Target: gaps within 5 pts.',
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
    value: k5.gap,
    formatted:
      k5.full && k5.part
        ? `${percent1(k5.full.rate)} vs ${percent1(k5.part.rate)}`
        : '—',
    detail: 'Full-time vs part-time pass rate',
    target: '|gap| ≤ 5 pts',
    description:
      'KPI — pass rate of full-time vs part-time students. Computed off-panel; surfaces as an alert on breach. Target: gap within 5 pts.',
    offPanel: true,
    breach:
      k5.gap !== null && Math.abs(k5.gap) > THRESHOLDS.equityGapMax
        ? { severity: 'critical', formattedDelta: signedPoints(k5.gap) }
        : undefined,
  });

  return presets;
}

/** Prior-year equivalents of the current scope (single-year scopes only). */
export interface PriorScope {
  scopeRows: StudentRow[];
  levelRows: StudentRow[];
}

/**
 * FR6 trend direction: which way each preset's raw value should move to count
 * as improving. `shrinkAbs` = closer to zero is better (gap metrics).
 */
const TREND_SENSE: Record<string, 'higher' | 'lower' | 'shrinkAbs'> = {
  K1: 'higher',
  K2: 'higher',
  K3: 'shrinkAbs',
  K4: 'higher',
  R1: 'shrinkAbs',
  R2: 'higher',
  R3: 'lower',
  R4: 'shrinkAbs',
  K5: 'shrinkAbs',
};

const FLAT_EPSILON = 0.05;

/**
 * Presets for the current scope, plus (when a prior-year scope is provided)
 * the ↑/↓/→ trend chip data — computed from the SAME formulas run on the
 * prior year, so a tile and its trend can never disagree.
 */
export function computePresets(
  scopeRows: StudentRow[],
  levelRows: StudentRow[],
  prior?: PriorScope,
): PresetValue[] {
  const presets = buildPresets(scopeRows, levelRows);
  if (!prior || prior.scopeRows.length === 0) return presets;

  const priorValues = new Map(
    buildPresets(prior.scopeRows, prior.levelRows).map((p) => [p.id, p.value]),
  );

  return presets.map((preset) => {
    const priorValue = priorValues.get(preset.id);
    if (
      preset.value === null ||
      preset.value === undefined ||
      priorValue === null ||
      priorValue === undefined
    ) {
      return preset;
    }
    const delta = preset.value - priorValue;
    const direction: 'up' | 'down' | 'flat' =
      Math.abs(delta) < FLAT_EPSILON ? 'flat' : delta > 0 ? 'up' : 'down';
    let improving: boolean | null = null;
    if (direction !== 'flat') {
      const sense = TREND_SENSE[preset.id];
      improving =
        sense === 'higher'
          ? delta > 0
          : sense === 'lower'
            ? delta < 0
            : Math.abs(preset.value) < Math.abs(priorValue);
    }
    const formattedDelta =
      preset.id === 'K4'
        ? `${delta >= 0 ? '+' : '−'}${Math.abs(Math.round(delta))}`
        : signedPoints(delta);
    return { ...preset, trend: { formattedDelta, direction, improving } };
  });
}
