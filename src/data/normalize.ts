import { FALLBACK_YEAR, type Grade, type Session, type StudentRow } from '../types';
import type { RawTable } from './schema';

/** Courses this dashboard serves (others are dropped on import). */
export const TARGET_COURSES = ['ENG201', 'MAT110'] as const;
export type TargetCourse = (typeof TARGET_COURSES)[number];

/** @deprecated Prefer TARGET_COURSES — kept as the default course filter. */
export const TARGET_COURSE: TargetCourse = 'ENG201';

/** Demo display names for the three instructors in the sample workbook. */
export const PROFESSOR_DISPLAY_NAMES: Record<string, string> = {
  'Professor A': 'Professor John Keating',
  'Professor B': 'Professor Henry Jones',
  'Professor C': 'Professor Ron Clark',
};

export const DEFAULT_FACULTY_PROFESSOR = 'Professor John Keating';

/** Map workbook labels (and already-mapped names) to the display roster. */
export function displayProfessorName(raw: string): string {
  const trimmed = raw.trim();
  return PROFESSOR_DISPLAY_NAMES[trimmed] ?? trimmed;
}

/** Collapse variants like `ENG 201` / `eng201` to a comparable code. */
export function normalizeCourseCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

/** Return the canonical course code if it is in scope, else null. */
export function canonicalizeCourse(raw: string): TargetCourse | null {
  const code = normalizeCourseCode(raw);
  return (TARGET_COURSES as readonly string[]).includes(code)
    ? (code as TargetCourse)
    : null;
}

export function isTargetCourse(course: string): boolean {
  return canonicalizeCourse(course) !== null;
}

/**
 * Raw validated tables → typed StudentRow[]. Keeps only ENG201 and MAT110
 * rows. Handles the workbook's known quirk that `Pass` may be "Yes"/"No" or
 * "Y"/"N". Derived dimensions live in the metrics layer.
 */
export function normalizeTables(tables: RawTable[]): StudentRow[] {
  const rows: StudentRow[] = [];
  let inconsistent = 0;
  let dropped = 0;

  for (const table of tables) {
    for (const raw of table.rows) {
      // CSV carries a Course column; XLSX uses the sheet name on the table.
      const rawCourse =
        raw['Course'] !== undefined && raw['Course'] !== null && String(raw['Course']).trim() !== ''
          ? String(raw['Course']).trim()
          : table.course.trim();
      const course = canonicalizeCourse(rawCourse);
      if (!course) {
        dropped += 1;
        continue;
      }

      const score = Number(raw['Score']);
      const pass = /^y/i.test(String(raw['Pass']).trim());
      if (pass !== score >= 70) inconsistent += 1;

      rows.push({
        course,
        studentNum: Number(raw['Student #']),
        residency: String(raw['Dom/Inter']).trim() as StudentRow['residency'],
        gender: String(raw['F/M']).trim() as StudentRow['gender'],
        intensity: String(raw['Full/Part']).trim() as StudentRow['intensity'],
        englishNative: String(raw['English Native/Non']).trim() as StudentRow['englishNative'],
        firstGen: /^y/i.test(String(raw['1st Gen']).trim()),
        pell: /^y/i.test(String(raw['Pell grant']).trim()),
        major: String(raw['Major']).trim().toUpperCase(),
        pass,
        age: Number(raw['Age']),
        professor: displayProfessorName(String(raw['Professor'])),
        session: String(raw['Session']).trim() as Session,
        score,
        grade: String(raw['Grade']).trim() as Grade,
        year:
          raw['Year'] !== undefined && raw['Year'] !== null && String(raw['Year']).trim() !== ''
            ? Number(raw['Year'])
            : FALLBACK_YEAR,
      });
    }
  }

  if (inconsistent > 0 && import.meta.env?.DEV) {
    console.warn(
      `normalize: ${inconsistent} row(s) where Pass contradicts Score >= 70`,
    );
  }
  if (dropped > 0 && import.meta.env?.DEV) {
    console.info(
      `normalize: dropped ${dropped} row(s) outside ${TARGET_COURSES.join(' / ')}`,
    );
  }

  return rows;
}
