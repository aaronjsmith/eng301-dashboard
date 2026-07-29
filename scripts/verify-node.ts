/**
 * Headless verification (Phase-9): runs the real import pipeline + selftest
 * against the bundled workbook, then proves CSV parity (FR1) by exporting the
 * same rows through the 15-column CSV contract and re-importing them.
 *
 * Run: npx tsx scripts/verify-node.ts
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Papa from 'papaparse';
import { parseXlsx } from '../src/data/parseXlsx';
import { parseCsv } from '../src/data/parseCsv';
import { validateTables } from '../src/data/schema';
import { normalizeTables } from '../src/data/normalize';
import { runSelfTest } from '../src/metrics/selftest';
import { CANONICAL_COLUMNS } from '../src/data/schema';

const here = dirname(fileURLToPath(import.meta.url));
const workbookPath = join(here, '../public/data/Static Tables-2.xlsx');

// ── XLSX path ────────────────────────────────────────────────────────────
const buffer = readFileSync(workbookPath);
const arrayBuffer = buffer.buffer.slice(
  buffer.byteOffset,
  buffer.byteOffset + buffer.byteLength,
) as ArrayBuffer;

const tables = parseXlsx(arrayBuffer);
validateTables(tables);
const rows = normalizeTables(tables);
const courses = [...new Set(rows.map((r) => r.course))];
console.log(
  `XLSX import: ${rows.length} ENG201 rows from ${tables.length} sheets (kept courses: ${courses.join(', ') || 'none'})`,
);
const xlsxOk = runSelfTest(rows);

// ── CSV parity (FR1: "a CSV export of the same tables must work identically")
const csvRows = tables.flatMap((t) =>
  t.rows.map((r) => ({
    Course: t.course,
    ...Object.fromEntries([...CANONICAL_COLUMNS, 'Year'].map((c) => [c, r[c]])),
  })),
);
const csvText = Papa.unparse(csvRows);
const csvTables = parseCsv(csvText);
validateTables(csvTables);
const csvParsed = normalizeTables(csvTables);
console.log(`CSV re-import: ${csvParsed.length} rows from ${csvTables.length} course groups`);
const csvOk = runSelfTest(csvParsed);

const identical =
  JSON.stringify(rows.slice(0, 500)) === JSON.stringify(csvParsed.slice(0, 500)) &&
  rows.length === csvParsed.length;
console.log(`CSV parity (row-identical): ${identical ? 'PASS' : 'FAIL'}`);

// ── Schema rejection check ───────────────────────────────────────────────
let rejected = false;
try {
  const broken = csvText.replace('Pell grant', 'Pell');
  validateTables(parseCsv(broken));
} catch (e) {
  rejected = true;
  console.log(`Schema rejection: PASS — ${String((e as Error).message.split('\n')[1])}`);
}
if (!rejected) console.log('Schema rejection: FAIL — bad CSV was accepted');

if (!xlsxOk || !csvOk || !identical || !rejected) {
  console.error('VERIFICATION FAILED');
  process.exit(1);
}
console.log('ALL VERIFICATION CHECKS PASS');
