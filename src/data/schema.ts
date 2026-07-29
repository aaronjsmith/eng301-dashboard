/**
 * FR1 — schema validation. Runs on the merged result of every import, before
 * normalization. All-or-nothing: any error rejects the whole import with one
 * readable message listing every problem; the previous data stays on screen.
 */

/** One parsed table (one workbook sheet, or one Course group of a CSV). */
export interface RawTable {
  course: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

/**
 * The canonical workbook columns, in workbook order. The importer reads the
 * actual header row — never the embedded Excel table metadata, which in
 * Static Tables-2.xlsx declares only 9 of these 14 columns.
 */
export const CANONICAL_COLUMNS = [
  'Student #',
  'Dom/Inter',
  'F/M',
  'Full/Part',
  'English Native/Non',
  '1st Gen',
  'Pell grant',
  'Major',
  'Pass',
  'Age',
  'Professor',
  'Session',
  'Score',
  'Grade',
] as const;

/** CSV files carry an extra Course column in place of sheet names. */
export const CSV_COURSE_COLUMN = 'Course';

/**
 * Optional columns: validated when present, tolerated when absent. Files
 * without `Year` get every row tagged FALLBACK_YEAR downstream (normalize.ts),
 * so pre-multi-year exports keep working unchanged.
 */
export const OPTIONAL_COLUMNS = ['Year'] as const;

const VALUE_DOMAINS: Record<string, readonly string[]> = {
  'Dom/Inter': ['Dom', 'Inter'],
  'F/M': ['F', 'M'],
  'Full/Part': ['Full', 'Part'],
  'English Native/Non': ['Native', 'Non'],
  '1st Gen': ['Y', 'N'],
  'Pell grant': ['Y', 'N'],
  Pass: ['Y', 'N', 'Yes', 'No'],
  Session: ['Spring', 'Summer', 'Fall', 'Winter'],
  Grade: ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'],
};

const INT_COLUMNS = ['Student #', 'Age', 'Score'] as const;

export class SchemaError extends Error {
  problems: string[];

  constructor(problems: string[]) {
    super(
      `Import rejected — the file does not match the expected table schema:\n` +
        problems.map((p) => `• ${p}`).join('\n'),
    );
    this.name = 'SchemaError';
    this.problems = problems;
  }
}

const MAX_ROW_PROBLEMS = 8;

function asInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

/** Throws SchemaError listing every missing/renamed column and bad value. */
export function validateTables(tables: RawTable[]): void {
  const problems: string[] = [];

  if (tables.length === 0) {
    throw new SchemaError(['The file contains no course tables.']);
  }

  for (const table of tables) {
    const headers = table.headers.map((h) => h.trim());
    const missing = CANONICAL_COLUMNS.filter((c) => !headers.includes(c));
    const unknown = headers.filter(
      (h) =>
        h !== '' &&
        h !== CSV_COURSE_COLUMN &&
        !(OPTIONAL_COLUMNS as readonly string[]).includes(h) &&
        !(CANONICAL_COLUMNS as readonly string[]).includes(h),
    );
    if (missing.length > 0) {
      problems.push(`${table.course}: missing column${missing.length > 1 ? 's' : ''} ${missing.map((c) => `'${c}'`).join(', ')}`);
    }
    if (unknown.length > 0) {
      problems.push(`${table.course}: unknown column${unknown.length > 1 ? 's' : ''} ${unknown.map((c) => `'${c}'`).join(', ')}`);
    }
    if (missing.length > 0) continue; // value checks need the columns present

    if (table.rows.length === 0) {
      problems.push(`${table.course}: table has a header but no data rows`);
      continue;
    }

    let rowProblems = 0;
    let skipped = 0;
    table.rows.forEach((row, i) => {
      const report = (msg: string) => {
        if (rowProblems < MAX_ROW_PROBLEMS) {
          problems.push(`${table.course} row ${i + 2}: ${msg}`);
        } else {
          skipped += 1;
        }
        rowProblems += 1;
      };

      for (const col of INT_COLUMNS) {
        const n = asInt(row[col]);
        if (n === null) {
          report(`'${col}' is '${String(row[col])}' — expected a whole number`);
        } else if (col === 'Score' && (n < 0 || n > 100)) {
          report(`'Score' is ${n} — expected 0–100`);
        }
      }
      if (headers.includes('Year')) {
        const y = asInt(row['Year']);
        if (y === null || y < 1990 || y > 2100) {
          report(`'Year' is '${String(row['Year'])}' — expected a year 1990–2100`);
        }
      }
      for (const [col, domain] of Object.entries(VALUE_DOMAINS)) {
        const value = String(row[col] ?? '').trim();
        const ok =
          col === 'Pass'
            ? domain.some((d) => d.toLowerCase() === value.toLowerCase())
            : domain.includes(value);
        if (!ok) {
          report(`'${col}' is '${value}' — expected one of ${domain.join(', ')}`);
        }
      }
      const major = String(row['Major'] ?? '').trim();
      if (major === '') report(`'Major' is empty`);
    });
    if (skipped > 0) {
      problems.push(`${table.course}: …and ${skipped} more value problem${skipped > 1 ? 's' : ''}`);
    }
  }

  if (problems.length > 0) throw new SchemaError(problems);
}
