import type { TipContent } from '../components/ui/Tip';

/** Cross-cutting terms and abbreviations the hover tooltips reuse. */
export const GLOSSARY = {
  kpi: {
    title: 'KPI — Key Performance Indicator',
    body: 'Measures progress toward a goal (pass rate, average score, enrollment). You want KPIs to hit their targets.',
  },
  kri: {
    title: 'KRI — Key Risk Indicator',
    body: 'Early warning of an emerging problem (equity gaps, grading anomalies, at-risk counts). You want KRIs to stay quiet.',
  },
  lagging: {
    title: 'Lagging indicator',
    body: 'Reports outcomes after the fact — it confirms what already happened. A property of the metric, not something you set.',
  },
  leading: {
    title: 'Leading indicator',
    body: 'Signals likely future outcomes — it moves before final results do. A property of the metric, not something you set.',
  },
  smallCell: {
    title: 'n < 20 suppression',
    body: 'Groups smaller than 20 students are suppressed to prevent re-identification (FERPA privacy rule).',
  },
  moduleFilter: {
    title: 'Module filters',
    body: 'Narrow this card further within the global scope. They compose on top of the global filter bar and never widen it.',
  },
  globalScope: {
    title: 'Global scope',
    body: 'The population every panel computes against. Module filters narrow within it; presets and alerts read it directly.',
  },
} as const satisfies Record<string, TipContent>;
