/** Shared types for the dashboard. FR references point at the FRD. */

/** FR4 — role-based views (FERPA simulation). */
export type Role = 'faculty' | 'chair' | 'admin';

export const ROLE_OPTIONS: { id: Role; label: string; scope: string }[] = [
  { id: 'faculty', label: 'Teacher', scope: 'Only your own classes' },
  { id: 'chair', label: 'Department chair', scope: 'Whole department' },
  { id: 'admin', label: 'Administrator', scope: 'Summary view (no student names)' },
];

export type Session = 'Spring' | 'Summer' | 'Fall' | 'Winter';

/** Chronological order used for ordered axes and prior-session baselines. */
export const SESSION_ORDER: Session[] = ['Spring', 'Summer', 'Fall', 'Winter'];

/** Rows from files without a Year column are tagged as the current year. */
export const FALLBACK_YEAR = 2026;

/** One term = an academic year + a session within it. */
export interface Term {
  year: number;
  session: Session;
}

/** The chronologically previous term (Spring rolls to the prior year's Winter). */
export function priorTerm(term: Term): Term {
  const idx = SESSION_ORDER.indexOf(term.session);
  if (idx <= 0) return { year: term.year - 1, session: 'Winter' };
  return { year: term.year, session: SESSION_ORDER[idx - 1] };
}

export type Grade =
  | 'A'
  | 'A-'
  | 'B+'
  | 'B'
  | 'B-'
  | 'C+'
  | 'C'
  | 'C-'
  | 'D'
  | 'F';

/** One student-course record, normalized from the workbook (see data/normalize.ts). */
export interface StudentRow {
  course: string;
  studentNum: number;
  residency: 'Dom' | 'Inter';
  gender: 'F' | 'M';
  intensity: 'Full' | 'Part';
  englishNative: 'Native' | 'Non';
  firstGen: boolean;
  pell: boolean;
  major: string;
  pass: boolean;
  age: number;
  professor: string;
  session: Session;
  score: number;
  grade: Grade;
  year: number;
}

/** Where the current rows came from (drives the status-bar chips, FR1/FR2). */
export interface SourceMeta {
  source: string;
  format: 'xlsx' | 'csv';
  lastSynced: string; // ISO timestamp
  mode: 'manual' | 'auto' | 'file';
  courses: string[];
  rowCount: number;
}

/** FR2 — sync/refresh state. */
export interface SyncStatus {
  state: 'idle' | 'syncing' | 'synced' | 'error';
  meta?: SourceMeta;
  /** Present while state === 'error'; previous data stays visible (stale-but-labeled). */
  error?: string;
}

/**
 * Filterable/breakdown dimensions (FR5). Values are the strings produced by
 * dimensionValue(). `courseLevel` is derived (100- vs 200-level) and is a
 * breakdown-only dimension — it never appears in filter popups.
 */
export type Dimension =
  | 'course'
  | 'courseLevel'
  | 'year'
  | 'session'
  | 'professor'
  | 'gender'
  | 'ageBand'
  | 'major'
  | 'intensity'
  | 'firstGen'
  | 'pell'
  | 'englishNative'
  | 'residency';

/** Absent key = no filter on that dimension (all values included). */
export type FilterState = Partial<Record<Dimension, string[]>>;

export type MetricId =
  | 'passRate'
  | 'dfwRate'
  | 'avgScore'
  | 'enrollment'
  | 'gradeDist'
  | 'genderGap'
  | 'firstGenGap'
  | 'pellGap'
  | 'midBandShare'
  | 'atRisk';

export type ChartType =
  | 'donut'
  | 'bars'
  | 'pie'
  | 'area'
  | 'heatmap'
  | 'divergingBar';

/** FR3 — size tiers are semantic zoom: S 1×1, M 2×1, L 2×2 grid spans. */
export type SizeTier = 'S' | 'M' | 'L';

export type CompareTo =
  | 'none'
  | 'priorSession'
  | 'sameTermLastYear'
  | 'courseAvg'
  | 'allCoursesAvg'
  | 'peerLevel';

/** Lagging/leading is a property of the metric (registry), rendered as a badge. */
export type IndicatorKind = 'lagging' | 'leading';

export type Severity = 'critical' | 'notable' | 'context';

export type HighlightCategory = 'equity' | 'instructor' | 'session' | 'course';

/** Root-cause mode payload — freezes a highlight's slice into a module (spec §3). */
export interface InvestigatePayload {
  highlightId: string;
  metric: MetricId;
  /** Frozen population, e.g. { course: ['ENG201'], session: ['Summer'] }. */
  slice: FilterState;
  /** Healthy complement used as the comparison baseline. */
  baseline: FilterState;
  baselineLabel: string;
}

/** A committed roster cell (top-left of the span); spans derive from size. */
export interface GridSlot {
  col: number;
  row: number;
}

/** Config for one instance of the repeatable metric module. Fully serializable. */
export interface ModuleConfig {
  id: string;
  title: string;
  metric: MetricId;
  chartType: ChartType;
  size: SizeTier;
  compareTo: CompareTo;
  breakdown: Dimension | 'none';
  /** Module-local filters; compose on top of (never widen) the global scope, FR5. */
  filters: FilterState;
  /** Desired roster cell; undefined ⇒ auto-place. Only drops/remagnetize commit it. */
  slot?: GridSlot | null;
  /** Magnetic-off free parking offset; null/undefined when snapped to the roster. */
  freeOffset?: { dx: number; dy: number } | null;
  /** FR4 — undefined means visible to every role. */
  visibleTo?: Role[];
  /** Present ⇒ module renders the Investigate dimension scan (opens at L tier). */
  investigate?: InvestigatePayload;
  /** L-tier data-table toggle. */
  showTable?: boolean;
}

/** A computed preset row (purple panel), K1–K5 / R1–R4. */
export interface PresetValue {
  id: string;
  label: string;
  kind: 'kpi' | 'kri';
  metric: MetricId;
  formatted: string;
  detail: string;
  target: string;
  /** Plain-language explanation (incl. target) — shown in the hover tooltip. */
  description: string;
  /** Raw primary number — used for trend diffing vs the prior year. */
  value?: number | null;
  breach?: { severity: Severity; formattedDelta: string };
  /** FR6 trend direction vs the prior year (single-year scopes only). */
  trend?: {
    formattedDelta: string;
    direction: 'up' | 'down' | 'flat';
    /** null when flat; colors the chip by direction × higher-is-better. */
    improving: boolean | null;
  };
  /** FR4 — undefined means visible to every role (R4 is chair/admin only). */
  roles?: Role[];
  /** K5 stays computed but off-panel; it surfaces via Highlights on breach. */
  offPanel?: boolean;
}

/** A computed highlight row (orange panel). */
export interface HighlightItem {
  id: string;
  label: string;
  evidence: string;
  severity: Severity;
  category: HighlightCategory;
  /** FR4/FR6 — which roles see this highlight. */
  roles: Role[];
  /** Models the wireframe's Highlights → Presets relation. */
  linkedPresetId?: string;
  investigate?: InvestigatePayload;
  /** Small-cell rule (n < 20): admin-only aggregate footnote rendering. */
  suppressed?: boolean;
}

/** FR6 — at-risk flag levels, derived from preset thresholds only. */
export type FlagLevel = 'fail' | 'marginal' | 'riskSlice';

export const AGE_BANDS = ['18–21', '22–26', '27+'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
