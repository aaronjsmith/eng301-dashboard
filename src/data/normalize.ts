import { FALLBACK_YEAR, type Grade, type Session, type StudentRow } from '../types';
import type { RawTable } from './schema';

/**
 * Raw validated tables → typed StudentRow[]. Handles the workbook's known
 * quirks: `Pass` is "Yes"/"No" on ENG201 but "Y"/"N" on the other sheets, and
 * MAT252's `Major` contains a stray "Bus" (uppercased here). Derived
 * dimensions (age band, course level, score band) live in the metrics layer
 * so each has exactly one definition.
 */
export function normalizeTables(tables: RawTable[]): StudentRow[] {
  const rows: StudentRow[] = [];
  let inconsistent = 0;

  for (const table of tables) {
    for (const raw of table.rows) {
      const score = Number(raw['Score']);
      const pass = /^y/i.test(String(raw['Pass']).trim());
      if (pass !== score >= 70) inconsistent += 1;

      rows.push({
        course: table.course.trim(),
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

  return rows;
}
