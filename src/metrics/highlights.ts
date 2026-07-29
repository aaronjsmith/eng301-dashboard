import type { HighlightItem, StudentRow } from '../types';
import {
  ageSessionRisk,
  demographicPassGap,
  genderPassGap,
  genderScoreGap,
  meanAge,
  midBandShare,
  passRate,
} from './formulas';
import { groupBy, SMALL_CELL } from './scope';
import { percent1, score1, signedPoints } from './format';
import { THRESHOLDS } from './thresholds';

/**
 * The Highlights panel (orange) — "what should you look at today". Rules are
 * declarative and evaluated against the CURRENT data every sync: severity
 * comes from the same thresholds as the presets, so a highlight that heals
 * disappears on its own and Presets/Highlights can never disagree.
 */

interface RuleContext {
  /** Role scope ∩ global filters — what most rules read. */
  scopeRows: StudentRow[];
  /** Role scope ∩ global filters with COURSE removed — cross-course rules. */
  crossCourseRows: StudentRow[];
}

interface HighlightRule {
  evaluate(ctx: RuleContext): HighlightItem | null;
}

const min20 = (n: number) => n >= SMALL_CELL;

const RULES: HighlightRule[] = [
  // ── Critical ────────────────────────────────────────────────────────────
  {
    // R3 — young summer students
    evaluate({ scopeRows }) {
      const r3 = ageSessionRisk(scopeRows);
      if (!r3.cellPass || !r3.otherPass || !min20(r3.cellPass.n)) return null;
      const breached =
        (r3.passGap !== null && r3.passGap >= THRESHOLDS.equityGapMax) ||
        (r3.scoreGap !== null && r3.scoreGap >= THRESHOLDS.equityGapMax);
      if (!breached) return null;
      return {
        id: 'hl-summer-young',
        label: 'Young Summer students are failing much more often',
        evidence: `Ages 18–21 in Summer pass ${percent1(r3.cellPass.rate)}, vs ${percent1(r3.otherPass.rate)} for everyone else (scores ${r3.cellScore !== null ? score1(r3.cellScore) : '—'} vs ${r3.otherScore !== null ? score1(r3.otherScore) : '—'}). The problem is the mix of young + Summer — not age or Summer alone.`,
        severity: 'critical',
        category: 'session',
        roles: ['faculty', 'chair', 'admin'],
        linkedPresetId: 'R3',
        investigate: {
          highlightId: 'hl-summer-young',
          metric: 'passRate',
          slice: { ageBand: ['18–21'], session: ['Summer'] },
          baseline: { session: ['Spring', 'Fall', 'Winter'] },
          baselineLabel: 'Non-summer sessions',
        },
      };
    },
  },
  {
    // R1 — per-professor hidden gender gap
    evaluate({ scopeRows }) {
      const candidates = [...groupBy(scopeRows, 'professor')]
        .map(([prof, rows]) => ({ prof, g: genderScoreGap(rows) }))
        .filter(
          (c) => c.g !== null && min20(c.g.fN) && min20(c.g.mN) &&
            Math.abs(c.g.gap) > THRESHOLDS.equityGapMax,
        );
      if (candidates.length === 0) return null;
      const worst = candidates.reduce((a, b) =>
        Math.abs(b.g!.gap) > Math.abs(a.g!.gap) ? b : a,
      );
      const courseWide = genderPassGap(scopeRows);
      return {
        id: 'hl-prof-gender-gap',
        label: `${worst.prof} has a hidden gender gap`,
        evidence: `Women average ${score1(worst.g!.fMean)} and men average ${score1(worst.g!.mMean)} (${signedPoints(worst.g!.gap)} points; warn above 5). Easy to miss because the whole-course gap is only ${courseWide ? signedPoints(courseWide.gap) : '—'} points — looking by professor shows it.`,
        severity: 'critical',
        category: 'instructor',
        roles: ['chair', 'admin'],
        linkedPresetId: 'R1',
        investigate: {
          highlightId: 'hl-prof-gender-gap',
          metric: 'genderGap',
          slice: { professor: [worst.prof] },
          baseline: {},
          baselineLabel: 'All professors in this view',
        },
      };
    },
  },
  {
    // R2 — all-or-nothing grading
    evaluate({ scopeRows, crossCourseRows }) {
      const candidates = [...groupBy(scopeRows, 'professor')]
        .map(([prof, rows]) => ({ prof, mid: midBandShare(rows), pr: passRate(rows), n: rows.length }))
        .filter((c) => c.mid !== null && min20(c.n) && c.mid < THRESHOLDS.midBandMin);
      if (candidates.length === 0) return null;
      const worst = candidates.reduce((a, b) => (b.mid! < a.mid! ? b : a));
      const allFails = crossCourseRows.filter((r) => !r.pass);
      const profFails = allFails.filter((r) => r.professor === worst.prof);
      const failShare =
        allFails.length > 0 ? Math.round((profFails.length / allFails.length) * 100) : 0;
      return {
        id: 'hl-prof-bimodal',
        label: `${worst.prof} grades with almost no middle scores`,
        evidence: `Only ${percent1(worst.mid!)} of grades are in the 70–89 middle range (healthy is often around 70%), even though the pass rate looks normal at ${worst.pr ? percent1(worst.pr.rate) : '—'}. Across all courses, ${worst.prof}'s sections account for ${profFails.length} of ${allFails.length} fails (${failShare}%).`,
        severity: 'critical',
        category: 'instructor',
        roles: ['chair', 'admin'],
        linkedPresetId: 'R2',
        investigate: {
          highlightId: 'hl-prof-bimodal',
          metric: 'midBandShare',
          slice: { professor: [worst.prof] },
          baseline: {},
          baselineLabel: 'All professors in this view',
        },
      };
    },
  },
  {
    // R4 — first-generation gap
    evaluate({ scopeRows }) {
      const gap = demographicPassGap(scopeRows, 'firstGen');
      if (!gap || !min20(gap.group.n) || Math.abs(gap.gap) <= THRESHOLDS.equityGapMax) {
        return null;
      }
      return {
        id: 'hl-first-gen',
        label: `First-generation students trail by ${Math.abs(gap.gap).toFixed(0)} points`,
        evidence: `First-gen students pass at ${percent1(gap.group.rate)} vs ${percent1(gap.comparison.rate)} for others (${signedPoints(gap.gap)} points; warn above 5).`,
        severity: 'critical',
        category: 'equity',
        roles: ['chair', 'admin'],
        linkedPresetId: 'R4',
        investigate: {
          highlightId: 'hl-first-gen',
          metric: 'passRate',
          slice: { firstGen: ['Yes'] },
          baseline: { firstGen: ['No'] },
          baselineLabel: 'Students who are not first-gen',
        },
      };
    },
  },
  // ── Notable ─────────────────────────────────────────────────────────────
  {
    // K4/R3 — session outcome spread
    evaluate({ scopeRows }) {
      const rates = [...groupBy(scopeRows, 'session')]
        .map(([session, rows]) => ({ session, pr: passRate(rows) }))
        .filter((s) => s.pr !== null && min20(s.pr.n));
      if (rates.length < 2) return null;
      const best = rates.reduce((a, b) => (b.pr!.rate > a.pr!.rate ? b : a));
      const worstS = rates.reduce((a, b) => (b.pr!.rate < a.pr!.rate ? b : a));
      const spread = best.pr!.rate - worstS.pr!.rate;
      if (spread < 10) return null;
      return {
        id: 'hl-session-spread',
        label: `Terms differ by ${spread.toFixed(0)} points`,
        evidence: `${best.session} passes at ${percent1(best.pr!.rate)} vs ${worstS.session} at ${percent1(worstS.pr!.rate)}. ${worstS.session} stays low even when you look past the youngest students.`,
        severity: 'notable',
        category: 'session',
        roles: ['faculty', 'chair', 'admin'],
        linkedPresetId: 'K4',
        investigate: {
          highlightId: 'hl-session-spread',
          metric: 'passRate',
          slice: { session: [worstS.session] },
          baseline: { session: [best.session] },
          baselineLabel: `${best.session} session`,
        },
      };
    },
  },
  {
    // R1 twin — course-level gender PASS gap in another course
    evaluate({ crossCourseRows }) {
      const candidates = [...groupBy(crossCourseRows, 'course')]
        .map(([course, rows]) => ({ course, g: genderPassGap(rows) }))
        .filter(
          (c) => c.g !== null && min20(c.g.f.n) && min20(c.g.m.n) &&
            Math.abs(c.g.gap) > THRESHOLDS.equityGapMax,
        );
      if (candidates.length === 0) return null;
      const worst = candidates.reduce((a, b) =>
        Math.abs(b.g!.gap) > Math.abs(a.g!.gap) ? b : a,
      );
      return {
        id: 'hl-course-gender-gap',
        label: `${worst.course}: women and men pass at very different rates`,
        evidence: `Women pass at ${percent1(worst.g!.f.rate)} vs men at ${percent1(worst.g!.m.rate)} (${signedPoints(worst.g!.gap)} points).`,
        severity: 'notable',
        category: 'equity',
        roles: ['chair', 'admin'],
        linkedPresetId: 'R1',
        investigate: {
          highlightId: 'hl-course-gender-gap',
          metric: 'genderGap',
          slice: { course: [worst.course] },
          baseline: {},
          baselineLabel: 'All courses',
        },
      };
    },
  },
  {
    // R4-family — non-native speakers
    evaluate({ scopeRows }) {
      const gap = demographicPassGap(scopeRows, 'englishNative');
      if (!gap || !min20(gap.group.n) || Math.abs(gap.gap) <= THRESHOLDS.equityGapMax) {
        return null;
      }
      return {
        id: 'hl-non-native',
        label: `Non-native English speakers trail by ${Math.abs(gap.gap).toFixed(1)} points`,
        evidence: `Non-native speakers pass at ${percent1(gap.group.rate)} vs native speakers at ${percent1(gap.comparison.rate)} — past the 5-point warning line.`,
        severity: 'notable',
        category: 'equity',
        roles: ['chair', 'admin'],
        linkedPresetId: 'R4',
        investigate: {
          highlightId: 'hl-non-native',
          metric: 'passRate',
          slice: { englishNative: ['Non'] },
          baseline: { englishNative: ['Native'] },
          baselineLabel: 'Native speakers',
        },
      };
    },
  },
  {
    // K1 — service-course fit (majors)
    evaluate({ scopeRows }) {
      const groups = [...groupBy(scopeRows, 'major')]
        .map(([major, rows]) => ({ major, pr: passRate(rows) }))
        .filter((g) => g.pr !== null && min20(g.pr.n));
      if (groups.length < 2) return null;
      const best = groups.reduce((a, b) => (b.pr!.rate > a.pr!.rate ? b : a));
      const worst = groups.reduce((a, b) => (b.pr!.rate < a.pr!.rate ? b : a));
      if (best.pr!.rate - worst.pr!.rate <= THRESHOLDS.equityGapMax) return null;
      return {
        id: 'hl-major-gap',
        label: `${worst.major} majors pass less often`,
        evidence: `${worst.major} majors pass at ${percent1(worst.pr!.rate)} (${worst.pr!.n} students) vs ${best.major} at ${percent1(best.pr!.rate)} (${best.pr!.n} students).`,
        severity: 'notable',
        category: 'course',
        roles: ['faculty', 'chair', 'admin'],
        linkedPresetId: 'K1',
        investigate: {
          highlightId: 'hl-major-gap',
          metric: 'passRate',
          slice: { major: [worst.major] },
          baseline: { major: [best.major] },
          baselineLabel: `${best.major} majors`,
        },
      };
    },
  },
  {
    // R3-family — failing students skew younger
    evaluate({ scopeRows }) {
      const failing = meanAge(scopeRows.filter((r) => !r.pass));
      const passing = meanAge(scopeRows.filter((r) => r.pass));
      if (failing === null || passing === null || passing - failing < 2) return null;
      return {
        id: 'hl-age-fail',
        label: 'Students who fail are often younger',
        evidence: `Average age of failing students is ${score1(failing)} vs ${score1(passing)} for students who pass — age is a risk signal beyond Summer alone.`,
        severity: 'notable',
        category: 'session',
        roles: ['faculty', 'chair', 'admin'],
        linkedPresetId: 'R3',
        investigate: {
          highlightId: 'hl-age-fail',
          metric: 'passRate',
          slice: { ageBand: ['18–21'] },
          baseline: { ageBand: ['22–26', '27+'] },
          baselineLabel: 'Students 22+',
        },
      };
    },
  },
  // ── Context ─────────────────────────────────────────────────────────────
  {
    // Healthy benchmark professor
    evaluate({ scopeRows }) {
      const healthy = [...groupBy(scopeRows, 'professor')]
        .map(([prof, rows]) => ({
          prof,
          pr: passRate(rows),
          g: genderScoreGap(rows),
          mid: midBandShare(rows),
          n: rows.length,
        }))
        .filter(
          (c) =>
            min20(c.n) &&
            c.pr !== null &&
            c.g !== null &&
            c.mid !== null &&
            Math.abs(c.g.gap) <= THRESHOLDS.equityGapMax &&
            c.mid >= 55,
        );
      if (healthy.length === 0) return null;
      const best = healthy.reduce((a, b) => (b.pr!.rate > a.pr!.rate ? b : a));
      return {
        id: 'hl-benchmark-prof',
        label: `${best.prof} looks like a healthy example`,
        evidence: `${percent1(best.pr!.rate)} pass, small gender gap (${signedPoints(best.g!.gap)}), and a normal middle-score share (${percent1(best.mid!)}). A good comparison for other professors.`,
        severity: 'context',
        category: 'instructor',
        roles: ['chair', 'admin'],
        linkedPresetId: 'R2',
      };
    },
  },
  {
    // Weakest gateway course (cross-course)
    evaluate({ crossCourseRows }) {
      const groups = [...groupBy(crossCourseRows, 'course')]
        .map(([course, rows]) => ({ course, pr: passRate(rows) }))
        .filter((g) => g.pr !== null && min20(g.pr.n));
      if (groups.length < 2) return null;
      const worst = groups.reduce((a, b) => (b.pr!.rate < a.pr!.rate ? b : a));
      return {
        id: 'hl-weakest-gateway',
        label: `${worst.course} has the lowest pass rate`,
        evidence: `${percent1(worst.pr!.rate)} pass — lowest of the ${groups.length} courses shown.`,
        severity: 'context',
        category: 'course',
        roles: ['faculty', 'chair', 'admin'],
        linkedPresetId: 'K3',
      };
    },
  },
  {
    // Small-cell suppression footnote (admin only)
    evaluate({ scopeRows }) {
      const small = [...groupBy(scopeRows, 'major')]
        .map(([major, rows]) => ({ major, pr: passRate(rows), n: rows.length }))
        .filter((g) => g.n > 0 && g.n < SMALL_CELL);
      if (small.length === 0) return null;
      const worst = small.reduce((a, b) => (b.n < a.n ? b : a));
      return {
        id: 'hl-small-cell',
        label: `${worst.major} majors: too few to show`,
        evidence: `Only ${worst.n} students (under ${SMALL_CELL}) — hidden so no one can guess who they are. Admins still see this note.`,
        severity: 'context',
        category: 'equity',
        roles: ['admin'],
        linkedPresetId: 'K1',
        suppressed: true,
      };
    },
  },
];

/** Evaluate every rule against current data; order = severity then rule order. */
export function computeHighlights(
  scopeRows: StudentRow[],
  crossCourseRows: StudentRow[],
): HighlightItem[] {
  const ctx: RuleContext = { scopeRows, crossCourseRows };
  const items = RULES.map((rule) => rule.evaluate(ctx)).filter(
    (h): h is HighlightItem => h !== null,
  );
  const order = { critical: 0, notable: 1, context: 2 } as const;
  return items.sort((a, b) => order[a.severity] - order[b.severity]);
}
