import type { FilterState, ModuleConfig } from '../types';

/**
 * Default module layout + the three ready-made bundles (Overview / Course
 * Detail / Equity), addable from the new-module slot as starting layouts.
 * Bundle module ids are templates — WorkspaceContext regenerates them on add
 * so instances stay unique. All bundles are ENG201-scoped.
 */

export const DEFAULT_MODULES: ModuleConfig[] = [
  {
    id: 'mod-pass-rate',
    title: 'Pass rate',
    metric: 'passRate',
    chartType: 'donut',
    size: 'S',
    compareTo: 'none',
    breakdown: 'none',
    filters: {},
  },
  {
    id: 'mod-avg-score',
    title: 'Average score by session',
    metric: 'avgScore',
    chartType: 'bars',
    size: 'M',
    compareTo: 'courseAvg',
    breakdown: 'session',
    filters: {},
  },
  {
    id: 'mod-enrollment',
    title: 'Enrollment trend',
    metric: 'enrollment',
    chartType: 'area',
    size: 'M',
    compareTo: 'none',
    breakdown: 'session',
    filters: {},
  },
  {
    id: 'mod-grade-dist',
    title: 'Grade distribution',
    metric: 'gradeDist',
    chartType: 'pie',
    size: 'S',
    compareTo: 'none',
    breakdown: 'none',
    filters: {},
    visibleTo: ['chair', 'admin'],
  },
  {
    id: 'mod-at-risk',
    title: 'At-risk students',
    metric: 'atRisk',
    chartType: 'bars',
    size: 'S',
    compareTo: 'none',
    breakdown: 'none',
    filters: {},
  },
];

export interface ModuleBundle {
  id: string;
  label: string;
  description: string;
  modules: ModuleConfig[];
}

export const BUNDLES: ModuleBundle[] = [
  {
    id: 'bundle-overview',
    label: 'Overview',
    description: 'Big-picture ENG201 view: pass rate, DFW, scores by term, and enrollment.',
    modules: [
      {
        id: 'ov-pass',
        title: 'Overall pass rate',
        metric: 'passRate',
        chartType: 'donut',
        size: 'S',
        compareTo: 'none',
        breakdown: 'none',
        filters: {},
      },
      {
        id: 'ov-dfw',
        title: 'DFW rate by session',
        metric: 'dfwRate',
        chartType: 'bars',
        size: 'M',
        compareTo: 'none',
        breakdown: 'session',
        filters: {},
      },
      {
        id: 'ov-score-session',
        title: 'Average score by session',
        metric: 'avgScore',
        chartType: 'bars',
        size: 'M',
        compareTo: 'courseAvg',
        breakdown: 'session',
        filters: {},
      },
      {
        id: 'ov-enrollment',
        title: 'Enrollment by session',
        metric: 'enrollment',
        chartType: 'area',
        size: 'M',
        compareTo: 'none',
        breakdown: 'session',
        filters: {},
      },
    ],
  },
  {
    id: 'bundle-course-detail',
    label: 'Course detail',
    description: 'Look closer at ENG201: grades, terms, and students who may need help.',
    modules: [
      {
        id: 'cd-pass',
        title: 'Course pass rate',
        metric: 'passRate',
        chartType: 'donut',
        size: 'S',
        compareTo: 'none',
        breakdown: 'none',
        filters: {},
      },
      {
        id: 'cd-grades',
        title: 'Grade distribution',
        metric: 'gradeDist',
        chartType: 'pie',
        size: 'M',
        compareTo: 'none',
        breakdown: 'none',
        filters: {},
      },
      {
        id: 'cd-score-session',
        title: 'Average score by session',
        metric: 'avgScore',
        chartType: 'bars',
        size: 'M',
        compareTo: 'courseAvg',
        breakdown: 'session',
        filters: {},
      },
      {
        id: 'cd-risk-session',
        title: 'At-risk by session',
        metric: 'atRisk',
        chartType: 'bars',
        size: 'M',
        compareTo: 'none',
        breakdown: 'session',
        filters: {},
      },
      {
        id: 'cd-midband-prof',
        title: 'Middle-grade share by professor',
        metric: 'midBandShare',
        chartType: 'bars',
        size: 'M',
        compareTo: 'none',
        breakdown: 'professor',
        filters: {},
        visibleTo: ['chair', 'admin'],
      },
    ],
  },
  {
    id: 'bundle-equity',
    label: 'Fairness gaps',
    description:
      'Shows ENG201 gaps between groups (like gender or first-gen). Warns when a gap is bigger than 5 points.',
    modules: [
      {
        id: 'eq-gender-session',
        title: 'Gender gap by session',
        metric: 'genderGap',
        chartType: 'divergingBar',
        size: 'M',
        compareTo: 'none',
        breakdown: 'session',
        filters: {},
      },
      {
        id: 'eq-firstgen-session',
        title: 'First-gen gap by session',
        metric: 'firstGenGap',
        chartType: 'divergingBar',
        size: 'M',
        compareTo: 'none',
        breakdown: 'session',
        filters: {},
      },
      {
        id: 'eq-pass-gender',
        title: 'Pass rate by gender',
        metric: 'passRate',
        chartType: 'bars',
        size: 'M',
        compareTo: 'none',
        breakdown: 'gender',
        filters: {},
      },
      {
        id: 'eq-gender-prof',
        title: 'Gender gap by professor',
        metric: 'genderGap',
        chartType: 'divergingBar',
        size: 'M',
        compareTo: 'none',
        breakdown: 'professor',
        filters: {},
        visibleTo: ['chair', 'admin'],
      },
    ],
  },
];

/**
 * The global scope a fresh workspace starts with: ENG201, current year (so
 * single-year presets/highlights match the verified numbers). Course is
 * locked in the filter bar; this keeps selectRows honest if anything widens.
 */
export const DEFAULT_GLOBAL_FILTERS: FilterState = {
  course: ['ENG201'],
  year: ['2026'],
};
