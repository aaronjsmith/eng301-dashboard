import type { SourceMeta, StudentRow } from '../types';
import { readStored, writeStored } from '../state/storage';

/**
 * FR2 — cached snapshot of the last successful import. Boot renders from this
 * instantly; if it is older than STALE_AFTER_MS the app re-runs the same
 * sync pipeline ("Auto-refreshed on load"). ~1,700 rows ≈ 300 KB JSON, well
 * under localStorage quota.
 */

export interface CachedData {
  rows: StudentRow[];
  meta: SourceMeta;
}

export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function readCachedData(): CachedData | null {
  const cached = readStored<CachedData | null>('data', null);
  if (!cached || !Array.isArray(cached.rows) || !cached.meta?.lastSynced) {
    return null;
  }
  return cached;
}

export function writeCachedData(data: CachedData): void {
  writeStored('data', data);
}

export function isStale(meta: SourceMeta, now: Date = new Date()): boolean {
  const synced = Date.parse(meta.lastSynced);
  if (Number.isNaN(synced)) return true;
  return now.getTime() - synced > STALE_AFTER_MS;
}
