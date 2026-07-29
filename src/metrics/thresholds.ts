/**
 * Every target and alert threshold, in one place (spec: presets, highlights,
 * modules, and flags must never disagree — they all read from here).
 */
export const THRESHOLDS = {
  /** K1 — course pass rate target (≥). */
  passRateTarget: 85,
  /** K2 — average course grade target (≥, B−). */
  avgScoreTarget: 80,
  /** K3 — ENG201 DFW rate target (≤). */
  dfwRateMax: 15,
  /** R1/R4/K5 — equity gap alert (|gap| >). */
  equityGapMax: 5,
  /** R2 — max−min pass-rate spread across professors (>). */
  professorSpreadMax: 15,
  /** R2 — mid-band (70–89) share below this is an anomaly (<). */
  midBandMin: 25,
  /** FR6 — marginal pass band: 70 ≤ score < 75. */
  marginalMin: 70,
  marginalMax: 75,
  /** Heatmap pass-rate color bins (KPI_KRI_Justification.html). */
  heatBins: [78, 82, 85],
} as const;
