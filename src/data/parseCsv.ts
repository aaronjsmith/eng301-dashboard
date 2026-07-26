import Papa from 'papaparse';
import { CSV_COURSE_COLUMN, SchemaError, type RawTable } from './schema';

/**
 * CSV contract (FR1 parity with the workbook): ONE file, 15 columns — the 14
 * workbook columns plus `Course`, one row per student. The Course column is
 * exactly what the XLSX path derives from sheet names, so both formats
 * normalize to identical StudentRow[].
 */
export function parseCsv(text: string): RawTable[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors.slice(0, 5).map((e) => {
      const where = typeof e.row === 'number' ? ` (row ${e.row + 2})` : '';
      return `CSV parse: ${e.message}${where}`;
    });
    throw new SchemaError(first);
  }

  const headers = parsed.meta.fields ?? [];
  if (!headers.includes(CSV_COURSE_COLUMN)) {
    throw new SchemaError([
      `CSV must include a '${CSV_COURSE_COLUMN}' column naming each row's course ` +
        `(per-sheet course inference only exists for XLSX imports).`,
    ]);
  }

  const byCourse = new Map<string, Record<string, unknown>[]>();
  for (const row of parsed.data) {
    const course = String(row[CSV_COURSE_COLUMN] ?? '').trim();
    if (course === '') {
      throw new SchemaError([`CSV has a row with an empty '${CSV_COURSE_COLUMN}' value.`]);
    }
    const bucket = byCourse.get(course) ?? [];
    bucket.push(row);
    byCourse.set(course, bucket);
  }

  const tableHeaders = headers.filter((h) => h !== CSV_COURSE_COLUMN);
  return [...byCourse.entries()].map(([course, rows]) => ({
    course,
    headers: tableHeaders,
    rows,
  }));
}
