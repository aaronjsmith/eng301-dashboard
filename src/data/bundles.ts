import type { FilterState, ModuleConfig } from '../types';

/**
 * Default module layout + the three ready-made bundles (the System Design
 * Document's Overview / Course Detail / Equity views), addable from the
 * new-module slot as starting layouts. Bundle module ids are templates —
 * WorkspaceContext regenerates them on add so instances stay unique.
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
  /** 'all' ⇒ adding the bundle widens the global course scope to every course. */
  globalCourse?: 'all';
  modules: ModuleConfig[];
}

export const BUNDLES: ModuleBundle[] = [
  {
    id: 'bundle-overview',
    label: 'Overview',
    description: 'Big-picture view across courses: pass rates, DFW by level, and enrollment. Sets course filter to All.',
    globalCourse: 'all',
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
        id: 'ov-pass-course',
        title: 'Pass rate by course',
        metric: 'passRate',
        chartType: 'bars',
        size: 'M',
        compareTo: 'allCoursesAvg',
        breakdown: 'course',
        filters: {},
      },
      {
        id: 'ov-dfw-level',
        title: 'DFW by course level',
        metric: 'dfwRate',
        chartType: 'bars',
        size: 'M',
        compareTo: 'none',
        breakdown: 'courseLevel',
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
    description: 'Look closer at one course: grades, terms, and students who may need help.',
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
      'Shows gaps between groups (like gender or first-gen). Warns when a gap is bigger than 5 points. Sets course filter to All.',
    globalCourse: 'all',
    modules: [
      {
        id: 'eq-gender-course',
        title: 'Gender gap by course',
        metric: 'genderGap',
        chartType: 'divergingBar',
        size: 'M',
        compareTo: 'none',
        breakdown: 'course',
        filters: {},
      },
      {
        id: 'eq-firstgen-course',
        title: 'First-gen gap by course',
        metric: 'firstGenGap',
        chartType: 'divergingBar',
        size: 'M',
        compareTo: 'none',
        breakdown: 'course',
        filters: {},
      },
      {
        id: 'eq-heatmap',
        title: 'Pass rate by course and gender',
        metric: 'passRate',
        chartType: 'heatmap',
        size: 'L',
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
 * The global scope a fresh workspace starts with: ENG201, all sessions,
 * current year (so single-year presets/highlights match the verified numbers).
 */
export const DEFAULT_GLOBAL_FILTERS: FilterState = {
  course: ['ENG201'],
  year: ['2026'],
};
