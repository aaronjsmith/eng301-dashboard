import {
  AGE_BANDS,
  SESSION_ORDER,
  type AgeBand,
  type Dimension,
  type FilterState,
  type Role,
  type StudentRow,
} from '../types';

/**
 * Scope model (FR4/FR5). Rows reach the UI role-scoped (DataContext); this
 * module composes the remaining layers as a strict intersection — a local
 * (module) filter can only narrow the global population, never widen it.
 */

/** FERPA small-cell rule: groups under this n are suppressed (spec). */
export const SMALL_CELL = 20;

export function ageBandOf(age: number): AgeBand {
  if (age <= 21) return AGE_BANDS[0];
  if (age <= 26) return AGE_BANDS[1];
  return AGE_BANDS[2];
}

export function courseLevelOf(course: string): '100-level' | '200-level' {
  const num = Number(/(\d+)/.exec(course)?.[1] ?? '0');
  return num >= 200 ? '200-level' : '100-level';
}

/** The canonical value of one dimension for one row (filter + grouping key). */
export function dimensionValue(row: StudentRow, dim: Dimension): string {
  switch (dim) {
    case 'course':
      return row.course;
    case 'courseLevel':
      return courseLevelOf(row.course);
    case 'year':
      return String(row.year);
    case 'session':
      return row.session;
    case 'professor':
      return row.professor;
    case 'gender':
      return row.gender;
    case 'ageBand':
      return ageBandOf(row.age);
    case 'major':
      return row.major;
    case 'intensity':
      return row.intensity;
    case 'firstGen':
      return row.firstGen ? 'Yes' : 'No';
    case 'pell':
      return row.pell ? 'Yes' : 'No';
    case 'englishNative':
      return row.englishNative;
    case 'residency':
      return row.residency;
  }
}

export interface DimensionMeta {
  id: Dimension;
  label: string;
  /** Fixed value order where one exists; undefined = derive from data. */
  values?: string[];
  /** Appears in filter popups (courseLevel is breakdown-only). */
  filterable: boolean;
  /** FR4 — roles that may use this dimension at all. */
  roles?: Role[];
  valueLabel?: (value: string) => string;
}

export const DIMENSION_META: Record<Dimension, DimensionMeta> = {
  course: { id: 'course', label: 'Course', filterable: true },
  courseLevel: {
    id: 'courseLevel',
    label: 'Course level',
    values: ['100-level', '200-level'],
    filterable: false,
  },
  // Global-bar-owned like `course` (excluded from module popups in
  // availability.ts); string sort orders years chronologically.
  year: { id: 'year', label: 'Year', filterable: true },
  session: {
    id: 'session',
    label: 'Session',
    values: [...SESSION_ORDER],
    filterable: true,
  },
  professor: {
    id: 'professor',
    label: 'Professor',
    filterable: true,
    roles: ['chair', 'admin'],
  },
  gender: {
    id: 'gender',
    label: 'Gender',
    values: ['F', 'M'],
    filterable: true,
    valueLabel: (v) => (v === 'F' ? 'Women' : 'Men'),
  },
  ageBand: {
    id: 'ageBand',
    label: 'Age band',
    values: [...AGE_BANDS],
    filterable: true,
  },
  major: { id: 'major', label: 'Major', filterable: true },
  intensity: {
    id: 'intensity',
    label: 'Enrollment intensity',
    values: ['Full', 'Part'],
    filterable: true,
    valueLabel: (v) => (v === 'Full' ? 'Full-time' : 'Part-time'),
  },
  firstGen: {
    id: 'firstGen',
    label: 'First generation',
    values: ['Yes', 'No'],
    filterable: true,
    valueLabel: (v) => (v === 'Yes' ? '1st gen' : 'Continuing'),
  },
  pell: {
    id: 'pell',
    label: 'Pell grant',
    values: ['Yes', 'No'],
    filterable: true,
    valueLabel: (v) => (v === 'Yes' ? 'Pell' : 'No Pell'),
  },
  englishNative: {
    id: 'englishNative',
    label: 'English background',
    values: ['Native', 'Non'],
    filterable: true,
    valueLabel: (v) => (v === 'Native' ? 'Native' : 'Non-native'),
  },
  residency: {
    id: 'residency',
    label: 'Residency',
    values: ['Dom', 'Inter'],
    filterable: true,
    valueLabel: (v) => (v === 'Dom' ? 'Domestic' : 'International'),
  },
};

export function valueLabel(dim: Dimension, value: string): string {
  return DIMENSION_META[dim].valueLabel?.(value) ?? value;
}

/** Distinct values of a dimension present in a row set, in canonical order. */
export function dimensionValues(rows: StudentRow[], dim: Dimension): string[] {
  const meta = DIMENSION_META[dim];
  const present = new Set(rows.map((r) => dimensionValue(r, dim)));
  if (meta.values) return meta.values.filter((v) => present.has(v));
  return [...present].sort();
}

/**
 * Does a row pass a FilterState? Absent key = no constraint; an empty array
 * matches nothing (an emptied checklist is honestly an empty population).
 */
export function matchesFilter(row: StudentRow, filters: FilterState): boolean {
  for (const [dim, allowed] of Object.entries(filters) as [Dimension, string[]][]) {
    if (!allowed) continue;
    if (!allowed.includes(dimensionValue(row, dim))) return false;
  }
  return true;
}

/** Strict-intersection row selection: every filter layer only narrows. */
export function selectRows(rows: StudentRow[], ...layers: (FilterState | undefined)[]): StudentRow[] {
  return rows.filter((row) =>
    layers.every((layer) => !layer || matchesFilter(row, layer)),
  );
}

/** Group rows by a dimension, preserving canonical value order. */
export function groupBy(rows: StudentRow[], dim: Dimension): Map<string, StudentRow[]> {
  const groups = new Map<string, StudentRow[]>();
  for (const value of dimensionValues(rows, dim)) groups.set(value, []);
  for (const row of rows) {
    groups.get(dimensionValue(row, dim))?.push(row);
  }
  return groups;
}

/** Count of active (non-absent) dimensions in a filter state. */
export function activeFilterCount(filters: FilterState): number {
  return Object.values(filters).filter((v) => v !== undefined).length;
}
