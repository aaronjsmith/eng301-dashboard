import type { SourceMeta, StudentRow } from '../types';
import { parseCsv } from './parseCsv';
import { parseXlsx } from './parseXlsx';
import { validateTables, type RawTable } from './schema';
import { normalizeTables } from './normalize';

/**
 * FR1 — the data import seam. Everything downstream consumes the result of
 * loadDashboardData(); components never know the file format. XLSX parses via
 * SheetJS, CSV via PapaParse, both into RawTable[] → validate → normalize.
 */

/** The bundled canonical source, re-imported by the Sync pill (FR2). */
export const BUNDLED_SOURCE = {
  url: '/data/Static Tables-2.xlsx',
  name: 'Static Tables-2.xlsx',
};

export interface ImportResult {
  rows: StudentRow[];
  meta: SourceMeta;
}

export interface LoadOptions {
  /** A user-picked file (XLSX or CSV); omitted = fetch the bundled source. */
  file?: File;
  mode: SourceMeta['mode'];
}

/**
 * FR1 pre-merge seam — multi-source consolidation happens HERE, before schema
 * validation. The full FR1 shape maps each simulated source onto the workbook
 * schema (Canvas gradebook → Score/Grade/Pass; Workday enrollment →
 * demographics/Session/Full-Part), joins on Student #, and returns one
 * canonical table set, so everything downstream still sees exactly the
 * Static Tables shape. V1 imports the single workbook: identity pass-through.
 * A failed merge is a failed sync (previous data stays, chip shows the error).
 */
function mergeSources(sourceTables: RawTable[][]): RawTable[] {
  return sourceTables.flat();
}

function formatOf(name: string): 'xlsx' | 'csv' {
  return /\.csv$/i.test(name) ? 'csv' : 'xlsx';
}

async function acquireTables(options: LoadOptions): Promise<{ tables: RawTable[]; source: string; format: 'xlsx' | 'csv' }> {
  if (options.file) {
    const format = formatOf(options.file.name);
    const tables =
      format === 'csv'
        ? parseCsv(await options.file.text())
        : parseXlsx(await options.file.arrayBuffer());
    return { tables, source: options.file.name, format };
  }

  const response = await fetch(BUNDLED_SOURCE.url);
  if (!response.ok) {
    throw new Error(
      `Could not fetch the data source (${BUNDLED_SOURCE.name}): HTTP ${response.status}`,
    );
  }
  const tables = parseXlsx(await response.arrayBuffer());
  return { tables, source: BUNDLED_SOURCE.name, format: 'xlsx' };
}

/** Parse → merge → validate → normalize. Throws on any failure (all-or-nothing). */
export async function loadDashboardData(options: LoadOptions): Promise<ImportResult> {
  const { tables, source, format } = await acquireTables(options);
  const merged = mergeSources([tables]);
  validateTables(merged);
  const rows = normalizeTables(merged);

  // After normalize, only ENG201 remains — meta.courses stays truthful for
  // any caller that still reads it (filters no longer offer a Course chip).
  const courses = [...new Set(rows.map((r) => r.course))];
  const meta: SourceMeta = {
    source,
    format,
    lastSynced: new Date().toISOString(),
    mode: options.mode,
    courses,
    rowCount: rows.length,
  };
  return { rows, meta };
}
