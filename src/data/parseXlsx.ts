import * as XLSX from 'xlsx';
import type { RawTable } from './schema';

/**
 * XLSX → RawTable per sheet. The header is read from the sheet's actual first
 * cell row (`header: 1`), never from the embedded Excel table metadata — in
 * Static Tables-2.xlsx that metadata declares only 9 of the 14 real columns.
 * Course name = sheet name.
 */
export function parseXlsx(buffer: ArrayBuffer): RawTable[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const tables: RawTable[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
    });
    if (grid.length === 0) continue;

    const headers = (grid[0] ?? []).map((h) => String(h ?? '').trim());
    const rows: Record<string, unknown>[] = [];
    for (const cells of grid.slice(1)) {
      if (!cells || cells.every((c) => c === null || c === '')) continue;
      const row: Record<string, unknown> = {};
      headers.forEach((header, i) => {
        if (header !== '') row[header] = cells[i] ?? null;
      });
      rows.push(row);
    }
    tables.push({ course: sheetName.trim(), headers: headers.filter(Boolean), rows });
  }

  return tables;
}
