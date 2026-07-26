import { useMemo } from 'react';
import type { HighlightItem, ModuleConfig, PresetValue, StudentRow } from '../types';
import { useData } from '../context/DataContext';
import { useRole } from '../context/RoleContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { selectRows } from '../metrics/scope';
import { computePresets } from '../metrics/presets';
import { computeHighlights } from '../metrics/highlights';
import { buildChartData, type ChartData } from '../metrics/chartData';
import { flagStudents, type FlagResult } from '../metrics/flags';
import { sanitizeConfigForRole } from '../metrics/availability';

/**
 * Memoized bindings from the pure metrics engine into React. Components call
 * these — never the engine directly and never their own arithmetic — so every
 * panel shows the same numbers for the same scope.
 */

export interface DashboardScope {
  /** Role scope ∩ global filters — what presets/highlights/modules read. */
  scopeRows: StudentRow[];
  /** Role scope ∩ global filters minus course — cross-course rules (K3 etc.). */
  crossCourseRows: StudentRow[];
  /** ALL rows — aggregate comparison baselines only (faculty exception). */
  baselineRows: StudentRow[];
}

export function useDashboardScope(): DashboardScope {
  const { scopedRows, baselineRows } = useData();
  const { globalFilters } = useWorkspace();

  return useMemo(() => {
    const { course: _course, ...withoutCourse } = globalFilters;
    return {
      scopeRows: selectRows(scopedRows, globalFilters),
      crossCourseRows: selectRows(scopedRows, withoutCourse),
      baselineRows,
    };
  }, [scopedRows, baselineRows, globalFilters]);
}

/** Presets visible to the current role, panel rows only (K5 stays off-panel). */
export function usePresets(): { panel: PresetValue[]; all: PresetValue[] } {
  const { role } = useRole();
  const { scopeRows, crossCourseRows } = useDashboardScope();

  return useMemo(() => {
    const all = computePresets(scopeRows, crossCourseRows);
    const panel = all.filter(
      (p) => !p.offPanel && (!p.roles || p.roles.includes(role)),
    );
    return { panel, all };
  }, [scopeRows, crossCourseRows, role]);
}

/** Highlights the current role may see (severity/category filtering is UI state). */
export function useHighlights(): HighlightItem[] {
  const { role } = useRole();
  const { scopeRows, crossCourseRows } = useDashboardScope();

  return useMemo(
    () =>
      computeHighlights(scopeRows, crossCourseRows).filter((h) =>
        h.roles.includes(role),
      ),
    [scopeRows, crossCourseRows, role],
  );
}

/** Chart-ready data for one module (config sanitized for the active role). */
export function useModuleChartData(config: ModuleConfig): {
  data: ChartData;
  sanitized: ModuleConfig;
} {
  const { role } = useRole();
  const { scopeRows, baselineRows } = useDashboardScope();

  return useMemo(() => {
    const sanitized = sanitizeConfigForRole(config, role);
    const data = buildChartData(sanitized, { scopeRows, baselineRows, role });
    return { data, sanitized };
  }, [config, role, scopeRows, baselineRows]);
}

/** FR6 flag summary for the current scope. */
export function useFlagSummary(): FlagResult {
  const { scopeRows } = useDashboardScope();
  return useMemo(() => flagStudents(scopeRows), [scopeRows]);
}
