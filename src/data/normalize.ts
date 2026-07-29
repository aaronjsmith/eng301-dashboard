import { FALLBACK_YEAR, type Grade, type Session, type StudentRow } from '../types';
import type { RawTable } from './schema';

/** Canonical course this dashboard serves. */
export const TARGET_COURSE = 'ENG201';

/** Collapse variants like `ENG 201` / `eng201` to a comparable code. */
export function normalizeCourseCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function isTargetCourse(course: string): boolean {
  return normalizeCourseCode(course) === TARGET_COURSE;
}

/**
 * Raw validated tables → typed StudentRow[]. Keeps only ENG201 rows (sheet
 * names or CSV Course values normalized). Handles the workbook's known quirk
 * that `Pass` may be "Yes"/"No" or "Y"/"N". Derived dimensions (age band,
 * score band) live in the metrics layer so each has exactly one definition.
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
      if (!isTargetCourse(rawCourse)) {
        dropped += 1;
        continue;
      }

      const score = Number(raw['Score']);
      const pass = /^y/i.test(String(raw['Pass']).trim());
      if (pass !== score >= 70) inconsistent += 1;

      rows.push({
        course: TARGET_COURSE,
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
        professor: String(raw['Professor']).trim(),
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
    // The workbook's pass threshold is Score >= 70; a mismatch is data worth
    // knowing about but not worth rejecting an otherwise valid import over.
    console.warn(
      `normalize: ${inconsistent} row(s) where Pass contradicts Score >= 70`,
    );
  }
  if (dropped > 0 && import.meta.env?.DEV) {
    console.info(`normalize: dropped ${dropped} non-${TARGET_COURSE} row(s)`);
  }

  return rows;
}
