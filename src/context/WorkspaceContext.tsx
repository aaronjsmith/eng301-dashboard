import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { FilterState, ModuleConfig } from '../types';
import { BUNDLES, DEFAULT_GLOBAL_FILTERS, DEFAULT_MODULES, type ModuleBundle } from '../data/bundles';
import { METRICS } from '../metrics/registry';
import { readStored, writeStored } from '../state/storage';

/**
 * FR3/FR5 — the user's composed workspace: module instances (array order IS
 * the roster auto-placement order), the global filter bar, the magnetic
 * toggle, and the theme. Persisted whole to localStorage (versioned key,
 * silent fallback to defaults on drift).
 */

export type Theme = 'light' | 'dark';

export interface WorkspaceState {
  modules: ModuleConfig[];
  globalFilters: FilterState;
  magnetic: boolean;
  theme: Theme;
}

export type WorkspaceAction =
  | { type: 'update-module'; id: string; patch: Partial<ModuleConfig> }
  | { type: 'remove-module'; id: string }
  | { type: 'add-module'; config: ModuleConfig }
  | { type: 'add-bundle'; bundle: ModuleBundle; courses: string[] }
  | { type: 'move-module'; fromIndex: number; toIndex: number }
  | { type: 'reorder'; ids: string[] }
  | { type: 'set-free-offset'; id: string; offset: { dx: number; dy: number } | null }
  | { type: 'set-global'; filters: FilterState }
  | { type: 'set-magnetic'; value: boolean }
  | { type: 'remagnetize'; ids: string[] }
  | { type: 'set-theme'; value: Theme }
  | { type: 'reset-layout' };

function freshId(base: string): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${base}-${suffix}`;
}

function reducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'update-module':
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id === action.id ? { ...m, ...action.patch } : m,
        ),
      };
    case 'remove-module':
      return { ...state, modules: state.modules.filter((m) => m.id !== action.id) };
    case 'add-module':
      return { ...state, modules: [...state.modules, action.config] };
    case 'add-bundle': {
      const added = action.bundle.modules.map((m) => ({ ...m, id: freshId(m.id) }));
      const globalFilters =
        action.bundle.globalCourse === 'all'
          ? { ...state.globalFilters, course: action.courses }
          : state.globalFilters;
      return { ...state, modules: [...state.modules, ...added], globalFilters };
    }
    case 'move-module': {
      const modules = [...state.modules];
      const [moved] = modules.splice(action.fromIndex, 1);
      if (!moved) return state;
      modules.splice(action.toIndex, 0, moved);
      return { ...state, modules };
    }
    case 'reorder': {
      const byId = new Map(state.modules.map((m) => [m.id, m]));
      const ordered = action.ids
        .map((id) => byId.get(id))
        .filter((m): m is ModuleConfig => m !== undefined);
      const missing = state.modules.filter((m) => !action.ids.includes(m.id));
      return { ...state, modules: [...ordered, ...missing] };
    }
    case 'set-free-offset':
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id === action.id ? { ...m, freeOffset: action.offset } : m,
        ),
      };
    case 'set-global':
      return { ...state, globalFilters: action.filters };
    case 'set-magnetic':
      return { ...state, magnetic: action.value };
    case 'remagnetize': {
      // Toggle-on: ModuleGrid derives nearest-slot order from actual rects and
      // sends it here; parked offsets clear and the packer resolves collisions.
      const byId = new Map(state.modules.map((m) => [m.id, m]));
      const ordered = action.ids
        .map((id) => byId.get(id))
        .filter((m): m is ModuleConfig => m !== undefined);
      const missing = state.modules.filter((m) => !action.ids.includes(m.id));
      return {
        ...state,
        modules: [...ordered, ...missing].map((m) =>
          m.freeOffset ? { ...m, freeOffset: null } : m,
        ),
      };
    }
    case 'set-theme':
      return { ...state, theme: action.value };
    case 'reset-layout':
      return {
        ...state,
        modules: DEFAULT_MODULES,
        globalFilters: DEFAULT_GLOBAL_FILTERS,
        magnetic: true,
      };
  }
}

const DEFAULT_STATE: WorkspaceState = {
  modules: DEFAULT_MODULES,
  globalFilters: DEFAULT_GLOBAL_FILTERS,
  magnetic: true,
  theme: 'light',
};

/** Reject stored workspaces whose shape has drifted (unknown metric ids etc.). */
function sanitizeStored(raw: WorkspaceState): WorkspaceState {
  if (!raw || !Array.isArray(raw.modules)) return DEFAULT_STATE;
  const modules = raw.modules.filter(
    (m): m is ModuleConfig =>
      typeof m === 'object' &&
      m !== null &&
      typeof m.id === 'string' &&
      typeof m.metric === 'string' &&
      m.metric in METRICS,
  );
  if (modules.length === 0 && raw.modules.length > 0) return DEFAULT_STATE;
  return {
    modules,
    globalFilters:
      raw.globalFilters && typeof raw.globalFilters === 'object'
        ? raw.globalFilters
        : DEFAULT_GLOBAL_FILTERS,
    magnetic: typeof raw.magnetic === 'boolean' ? raw.magnetic : true,
    theme: raw.theme === 'dark' ? 'dark' : 'light',
  };
}

interface WorkspaceContextValue extends WorkspaceState {
  dispatch: Dispatch<WorkspaceAction>;
  bundles: ModuleBundle[];
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => sanitizeStored(readStored<WorkspaceState>('workspace', DEFAULT_STATE)),
  );

  useEffect(() => {
    writeStored('workspace', state);
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({ ...state, dispatch, bundles: BUNDLES }),
    [state],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return value;
}
