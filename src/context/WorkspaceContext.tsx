import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { FilterState, GridSlot, ModuleConfig } from '../types';
import { BUNDLES, DEFAULT_GLOBAL_FILTERS, DEFAULT_MODULES, type ModuleBundle } from '../data/bundles';
import { freshId } from '../state/ids';
import { clearStored, readStored, writeStored } from '../state/storage';

/**
 * FR3/FR5 — the user's composed workspace: module instances (array order =
 * insertion order; layout lives in each module's grid `slot`, resolved by
 * rosterLayout), the global filter bar, the magnetic toggle, and the theme.
 * Every launch boots the curated overview (modules and global filters are
 * session-local); only prefs (theme, magnetic) persist.
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
  | { type: 'add-bundle'; bundle: ModuleBundle }
  | { type: 'set-layout'; slots: Record<string, GridSlot> }
  | { type: 'set-free-offset'; id: string; offset: { dx: number; dy: number } | null }
  | { type: 'set-global'; filters: FilterState }
  | { type: 'set-magnetic'; value: boolean }
  | { type: 'remagnetize'; slots: Record<string, GridSlot> }
  | { type: 'set-theme'; value: Theme }
  | { type: 'reset-layout' };

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
      return { ...state, modules: [...state.modules, ...added] };
    }
    case 'set-layout':
      // Map-patch: only listed ids move — role-hidden modules keep their slots.
      return {
        ...state,
        modules: state.modules.map((m) =>
          action.slots[m.id] ? { ...m, slot: action.slots[m.id] } : m,
        ),
      };
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
    case 'remagnetize':
      // Toggle-on: ModuleGrid maps parked card rects to their nearest cells;
      // offsets clear and render-time resolve() sorts out any collisions.
      return {
        ...state,
        modules: state.modules.map((m) => ({
          ...m,
          ...(action.slots[m.id] ? { slot: action.slots[m.id] } : {}),
          ...(m.freeOffset ? { freeOffset: null } : {}),
        })),
      };
    case 'set-theme':
      return { ...state, theme: action.value };
    case 'reset-layout':
      return {
        ...state,
        modules: DEFAULT_MODULES,
        globalFilters: DEFAULT_GLOBAL_FILTERS,
        magnetic: true,
      };
    default:
      // Unknown action (e.g. stale HMR dispatching a removed type) must never
      // collapse the state to undefined.
      return state;
  }
}

/** The slice that survives a reload — layout and filters reset to overview. */
interface PersistedPrefs {
  magnetic: boolean;
  theme: Theme;
}

interface WorkspaceContextValue extends WorkspaceState {
  dispatch: Dispatch<WorkspaceAction>;
  bundles: ModuleBundle[];
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, (): WorkspaceState => {
    const prefs = readStored<Partial<PersistedPrefs>>('prefs', {});
    clearStored('workspace'); // orphaned pre-overview-reset blob
    return {
      modules: DEFAULT_MODULES,
      globalFilters: DEFAULT_GLOBAL_FILTERS,
      magnetic: typeof prefs.magnetic === 'boolean' ? prefs.magnetic : true,
      theme: prefs.theme === 'dark' ? 'dark' : 'light',
    };
  });

  useEffect(() => {
    writeStored<PersistedPrefs>('prefs', { magnetic: state.magnetic, theme: state.theme });
  }, [state.magnetic, state.theme]);

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
