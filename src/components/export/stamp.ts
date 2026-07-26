import type { FilterState, Role, SourceMeta } from '../../types';
import { ROLE_OPTIONS, type Dimension } from '../../types';
import { DIMENSION_META } from '../../metrics/scope';

/**
 * FR7 — the footer stamp every export carries: role, last-sync timestamp +
 * mode, active global filters, and generation date, so a printed page can't
 * be mistaken for another role's view or fresher data.
 */
export function stampText(
  role: Role,
  facultyProfessor: string,
  meta: SourceMeta | null,
  globalFilters: FilterState,
): string {
  const roleLabel = ROLE_OPTIONS.find((r) => r.id === role)!.label;
  const who = role === 'faculty' ? `${roleLabel} (${facultyProfessor})` : roleLabel;

  const filters = (Object.entries(globalFilters) as [Dimension, string[]][])
    .filter(([, v]) => v && v.length > 0)
    .map(([dim, v]) => `${DIMENSION_META[dim].label}: ${v.join('/')}`)
    .join(' · ');

  const synced = meta
    ? `synced ${new Date(meta.lastSynced).toLocaleString([], {
        dateStyle: 'short',
        timeStyle: 'short',
      })} (${meta.mode})`
    : 'no sync recorded';

  const generated = new Date().toLocaleString([], {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return `View: ${who} · Data: ${meta?.source ?? '—'} ${synced} · Scope: ${
    filters || 'all data'
  } · Exported ${generated}`;
}
