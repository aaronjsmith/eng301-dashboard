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
  /** Role scope ∩ global filters minus year — year-crossing baselines/trends. */
  yearAgnosticRows: StudentRow[];
  /** ALL rows — aggregate comparison baselines only (faculty exception). */
  baselineRows: StudentRow[];
}

export function useDashboardScope(): DashboardScope {
  const { scopedRows, baselineRows } = useData();
  const { globalFilters } = useWorkspace();

  return useMemo(() => {
    const { year: _year, ...withoutYear } = globalFilters;
    return {
      scopeRows: selectRows(scopedRows, globalFilters),
      yearAgnosticRows: selectRows(scopedRows, withoutYear),
      // Aggregate-baseline exception stays unscoped by role/course/professor,
      // but the year cohort boundary applies — a 2026 card never compares
      // against a 2025+2026 blend.
      baselineRows: globalFilters.year
        ? selectRows(baselineRows, { year: globalFilters.year })
        : baselineRows,
    };
  }, [scopedRows, baselineRows, globalFilters]);
}

/** Presets visible to the current role, panel rows only (K5 stays off-panel). */
export function usePresets(): { panel: PresetValue[]; all: PresetValue[] } {
  const { role } = useRole();
  const { scopeRows, yearAgnosticRows } = useDashboardScope();

  return useMemo(() => {
    // FR6 trend arrows: only meaningful when the scope spans exactly one year
    // and the prior year has data in the equivalent scope.
    const years = [...new Set(scopeRows.map((r) => r.year))];
    let prior;
    if (years.length === 1) {
      const priorYear = years[0] - 1;
      const priorScope = yearAgnosticRows.filter((r) => r.year === priorYear);
      if (priorScope.length > 0) {
        prior = { scopeRows: priorScope };
      }
    }
    const all = computePresets(scopeRows, prior);
    const panel = all.filter(
      (p) => !p.offPanel && (!p.roles || p.roles.includes(role)),
    );
    return { panel, all };
  }, [scopeRows, yearAgnosticRows, role]);
}

/** Highlights the current role may see (severity/category filtering is UI state). */
export function useHighlights(): HighlightItem[] {
  const { role } = useRole();
  const { scopeRows } = useDashboardScope();

  return useMemo(
    () => computeHighlights(scopeRows).filter((h) => h.roles.includes(role)),
    [scopeRows, role],
  );
}

/** Chart-ready data for one module (config sanitized for the active role). */
export function useModuleChartData(config: ModuleConfig): {
  data: ChartData;
  sanitized: ModuleConfig;
} {
  const { role } = useRole();
  const { scopeRows, yearAgnosticRows, baselineRows } = useDashboardScope();

  return useMemo(() => {
    const sanitized = sanitizeConfigForRole(config, role, scopeRows);
    const data = buildChartData(sanitized, {
      scopeRows,
      yearAgnosticRows,
      baselineRows,
      role,
    });
    return { data, sanitized };
  }, [config, role, scopeRows, yearAgnosticRows, baselineRows]);
}

/** FR6 flag summary for the current scope. */
export function useFlagSummary(): FlagResult {
  const { scopeRows } = useDashboardScope();
  return useMemo(() => flagStudents(scopeRows), [scopeRows]);
}
