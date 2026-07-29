import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SourceMeta, StudentRow, SyncStatus } from '../types';
import { loadDashboardData } from '../data/loadData';
import {
  canonicalizeCourse,
  displayProfessorName,
  isTargetCourse,
  TARGET_COURSES,
} from '../data/normalize';
import { isStale, readCachedData, writeCachedData } from '../data/cache';
import { runSelfTest } from '../metrics/selftest';
import { useRole } from './RoleContext';

/**
 * FR1/FR2 — owns the imported rows and the sync state machine. Raw rows stay
 * private to this file; consumers read `scopedRows` (faculty views are
 * row-scoped to their own professor BEFORE anything is computed, FR4).
 * `baselineRows` is the one sanctioned exception: aggregate comparison
 * baselines only ("my sections vs. course average") — never rendered as rows.
 */

/** Keep only in-scope courses and remap professor display names from cache. */
function scopedCoursesOnly(rows: StudentRow[]): StudentRow[] {
  return rows
    .filter((r) => isTargetCourse(r.course))
    .map((r) => {
      const course = canonicalizeCourse(r.course) ?? r.course;
      return {
        ...r,
        course,
        professor: displayProfessorName(r.professor),
      };
    });
}

function scopedMeta(meta: SourceMeta, rows: StudentRow[]): SourceMeta {
  const courses = [...new Set(rows.map((r) => r.course))].sort();
  return {
    ...meta,
    courses: courses.length > 0 ? courses : [...TARGET_COURSES],
    rowCount: rows.length,
  };
}

interface DataContextValue {
  scopedRows: StudentRow[];
  baselineRows: StudentRow[];
  meta: SourceMeta | null;
  status: SyncStatus;
  sync: () => void;
  loadFromFile: (file: File) => void;
  /** All professors present in the data (for the faculty picker). */
  professors: string[];
  /** All academic years present in the data (for the global Year chips). */
  years: string[];
  ready: boolean;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { role, facultyProfessor } = useRole();
  const [rows, setRows] = useState<StudentRow[] | null>(null);
  const [meta, setMeta] = useState<SourceMeta | null>(null);
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle' });
  const bootRan = useRef(false);
  const inFlight = useRef(false);

  const runImport = useCallback(async (mode: SourceMeta['mode'], file?: File) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus((prev) => ({ ...prev, state: 'syncing', error: undefined }));
    try {
      const result = await loadDashboardData({ file, mode });
      setRows(result.rows);
      setMeta(result.meta);
      setStatus({ state: 'synced', meta: result.meta });
      writeCachedData({ rows: result.rows, meta: result.meta });
      if (import.meta.env.DEV) runSelfTest(result.rows);
    } catch (error) {
      // Failed sync keeps the previous data visible — stale-but-labeled.
      const message = error instanceof Error ? error.message : String(error);
      setStatus((prev) => ({ ...prev, state: 'error', error: message }));
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (bootRan.current) return; // StrictMode double-invoke guard
    bootRan.current = true;

    const cached = readCachedData();
    if (cached) {
      const rows = scopedCoursesOnly(cached.rows);
      const meta = scopedMeta(cached.meta, rows);
      const cachedCourses = new Set(rows.map((r) => r.course));
      const missingCourse = TARGET_COURSES.some((c) => !cachedCourses.has(c));
      setRows(rows);
      setMeta(meta);
      setStatus({ state: 'synced', meta });
      if (import.meta.env.DEV) runSelfTest(rows);
      // Re-write cache if course scope or professor names changed.
      const remapped = rows.some(
        (r, i) =>
          r.course !== cached.rows[i]?.course ||
          r.professor !== cached.rows[i]?.professor,
      );
      if (rows.length !== cached.rows.length || remapped) {
        writeCachedData({ rows, meta });
      }
      // Older ENG201-only caches lack MAT110 — pull a fresh bundled import.
      if (missingCourse || isStale(cached.meta)) void runImport('auto');
    } else {
      void runImport('auto');
    }
  }, [runImport]);

  const sync = useCallback(() => void runImport('manual'), [runImport]);
  const loadFromFile = useCallback(
    (file: File) => void runImport('file', file),
    [runImport],
  );

  const scopedRows = useMemo(() => {
    if (!rows) return [];
    if (role === 'faculty') return rows.filter((r) => r.professor === facultyProfessor);
    return rows;
  }, [rows, role, facultyProfessor]);

  const professors = useMemo(
    () => (rows ? [...new Set(rows.map((r) => r.professor))].sort() : []),
    [rows],
  );

  const years = useMemo(
    () => (rows ? [...new Set(rows.map((r) => String(r.year)))].sort() : []),
    [rows],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      scopedRows,
      baselineRows: rows ?? [],
      meta,
      status,
      sync,
      loadFromFile,
      professors,
      years,
      ready: rows !== null,
    }),
    [scopedRows, rows, meta, status, sync, loadFromFile, professors, years],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData must be used inside <DataProvider>');
  return value;
}
