import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { GridSlot, ModuleConfig } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useRole } from '../../context/RoleContext';
import { MetricModule } from './MetricModule';
import { AddModuleSlot } from './AddModuleSlot';
import {
  ROW_UNIT,
  cellFromPointer,
  clampTargetCell,
  columnsFor,
  resolve,
  type LayoutItem,
} from './rosterLayout';
import styles from './ModuleGrid.module.css';

const ADD_SLOT_ID = '__add';

interface DragState {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  grabDX: number;
  grabDY: number;
  startX: number;
  startY: number;
  baseDX: number;
  baseDY: number;
}

/**
 * The roster grid (spec §4): a coordinate lattice with gravity, resolved by
 * rosterLayout from each module's committed cell. Dragging pins the card to
 * the cell under the pointer (pure geometry — card rects are never read, so
 * the preview cannot feed back on itself); displaced neighbors push down and
 * re-pack live (FLIP, transform-only); drop commits the resolved layout.
 * Magnetic off parks cards on free offsets; toggling back on snaps each
 * parked card to its nearest cell.
 */
export function ModuleGrid() {
  const { modules, magnetic, dispatch } = useWorkspace();
  const { role } = useRole();

  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const prevRects = useRef(new Map<string, DOMRect>());
  const [cols, setCols] = useState(8);
  const [previewCell, setPreviewCell] = useState<GridSlot | null>(null);
  // Layout snapshot taken at drag start: every card gets a pinned cell for
  // the drag's duration, so previews only push cards locally — auto-placed
  // cards must never wholesale re-pack mid-drag (reads as cards vanishing).
  const frozenRef = useRef<{ cols: number; items: LayoutItem[] } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [liveOffset, setLiveOffset] = useState<{ id: string; dx: number; dy: number } | null>(
    null,
  );

  const visible = useMemo(
    () => modules.filter((m) => !m.visibleTo || m.visibleTo.includes(role)),
    [modules, role],
  );

  const layoutItems = useMemo<LayoutItem[]>(
    () => visible.map((m) => ({ id: m.id, size: m.size, slot: m.slot })),
    [visible],
  );

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setCols(columnsFor(width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const frozenItems = (forCols: number): LayoutItem[] => {
    if (!frozenRef.current || frozenRef.current.cols !== forCols) {
      const base = resolve(layoutItems, forCols);
      frozenRef.current = {
        cols: forCols,
        items: layoutItems.map((it) => {
          const s = base.get(it.id);
          return s ? { ...it, slot: { col: s.col, row: s.row } } : it;
        }),
      };
    }
    return frozenRef.current.items;
  };

  // Layout is a pure function of (modules, cols, dragged card, target cell).
  // A lone chart card spans the full row width so focus-from-key-numbers
  // fills the page; the Add slot drops onto the next row.
  const slots = useMemo(() => {
    const dragging = magnetic && drag !== null && previewCell !== null;
    const items = dragging
      ? frozenItems(cols).map((it) =>
          it.id === drag.id ? { ...it, slot: previewCell } : it,
        )
      : layoutItems;
    const resolved = resolve(items, cols, {
      trailingId: ADD_SLOT_ID,
      ...(dragging ? { priorityId: drag.id, keepPriorityInPlace: true } : {}),
    });

    if (visible.length === 1) {
      const id = visible[0].id;
      const card = resolved.get(id);
      if (card) {
        resolved.set(id, { ...card, col: 0, w: cols });
        const add = resolved.get(ADD_SLOT_ID);
        if (add) {
          resolved.set(ADD_SLOT_ID, { ...add, col: 0, row: card.h });
        }
      }
    }

    return resolved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutItems, cols, magnetic, drag, previewCell, visible.length]);

  // FLIP: displaced neighbors animate to their would-be slots (transform only).
  useLayoutEffect(() => {
    for (const [id, el] of cardRefs.current) {
      const next = el.getBoundingClientRect();
      const prev = prevRects.current.get(id);
      if (
        prev &&
        drag?.id !== id &&
        (Math.abs(prev.left - next.left) > 1 || Math.abs(prev.top - next.top) > 1)
      ) {
        el.animate(
          [
            { transform: `translate(${prev.left - next.left}px, ${prev.top - next.top}px)` },
            { transform: 'none' },
          ],
          { duration: 160, easing: 'ease-out' },
        );
      }
      prevRects.current.set(id, next);
    }
  });

  // Re-magnetize: toggle off→on snaps every parked card to its nearest cell.
  const prevMagnetic = useRef(magnetic);
  useEffect(() => {
    const was = prevMagnetic.current;
    prevMagnetic.current = magnetic;
    const gridRect = gridRef.current?.getBoundingClientRect();
    if (!was && magnetic && gridRect && visible.some((m) => m.freeOffset)) {
      const cellSlots: Record<string, GridSlot> = {};
      for (const m of visible) {
        const rect = cardRefs.current.get(m.id)?.getBoundingClientRect();
        if (rect) {
          cellSlots[m.id] = cellFromPointer(gridRect, cols, rect.left + 1, rect.top + 1);
        }
      }
      dispatch({ type: 'remagnetize', slots: cellSlots });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [magnetic]);

  const startDrag = (e: ReactPointerEvent<HTMLElement>, config: ModuleConfig) => {
    if (e.button !== 0) return;
    const card = cardRefs.current.get(config.id);
    if (!card) return;
    const rect = card.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    frozenRef.current = null;
    if (magnetic) frozenItems(cols); // snapshot the pre-drag layout
    setDrag({
      id: config.id,
      x: rect.left,
      y: rect.top,
      w: rect.width,
      h: rect.height,
      grabDX: e.clientX - rect.left,
      grabDY: e.clientY - rect.top,
      startX: e.clientX,
      startY: e.clientY,
      baseDX: config.freeOffset?.dx ?? 0,
      baseDY: config.freeOffset?.dy ?? 0,
    });
  };

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      if (magnetic) {
        setDrag((prev) =>
          prev ? { ...prev, x: e.clientX - prev.grabDX, y: e.clientY - prev.grabDY } : prev,
        );
        const gridRect = gridRef.current?.getBoundingClientRect();
        if (!gridRect) return;
        const raw = cellFromPointer(gridRect, cols, e.clientX, e.clientY);
        // Hysteresis: only switch cells once the pointer is ≥8px inside the
        // new cell, so boundary jitter can't flap the layout back and forth.
        const M = 8;
        const settled =
          cellFromPointer(gridRect, cols, e.clientX - M, e.clientY).col === raw.col &&
          cellFromPointer(gridRect, cols, e.clientX + M, e.clientY).col === raw.col &&
          cellFromPointer(gridRect, cols, e.clientX, e.clientY - M).row === raw.row &&
          cellFromPointer(gridRect, cols, e.clientX, e.clientY + M).row === raw.row;
        const cell = clampTargetCell(frozenItems(cols), cols, drag.id, raw);
        setPreviewCell((p) => {
          if (p && p.col === cell.col && p.row === cell.row) return p;
          if (p && !settled) return p;
          return cell;
        });
      } else {
        setLiveOffset({
          id: drag.id,
          dx: drag.baseDX + (e.clientX - drag.startX),
          dy: drag.baseDY + (e.clientY - drag.startY),
        });
      }
    };

    const onUp = () => {
      if (magnetic) {
        if (previewCell) {
          // Commit the fully-compacted layout (gravity applies to the dragged
          // card too) so stored state equals the next render — no post-drop hop.
          const items = frozenItems(cols).map((it) =>
            it.id === drag.id ? { ...it, slot: previewCell } : it,
          );
          const final = resolve(items, cols, { priorityId: drag.id });
          dispatch({
            type: 'set-layout',
            slots: Object.fromEntries(
              [...final].map(([id, s]) => [id, { col: s.col, row: s.row }]),
            ),
          });
        }
      } else if (liveOffset) {
        dispatch({
          type: 'set-free-offset',
          id: liveOffset.id,
          offset: { dx: liveOffset.dx, dy: liveOffset.dy },
        });
      }
      setDrag(null);
      setPreviewCell(null);
      setLiveOffset(null);
      frozenRef.current = null;
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, magnetic, cols, layoutItems, previewCell, liveOffset]);

  const dragged = drag ? visible.find((m) => m.id === drag.id) : undefined;
  const addSlot = slots.get(ADD_SLOT_ID);
  const solo = visible.length === 1;

  return (
    <div
      className={styles.grid}
      ref={gridRef}
      style={{ ['--grid-cols' as string]: cols, ['--row-unit' as string]: `${ROW_UNIT}px` }}
      data-magnetic={magnetic}
      data-solo={solo || undefined}
    >
      {visible.map((config) => {
        const slot = slots.get(config.id);
        const offset =
          liveOffset?.id === config.id
            ? liveOffset
            : config.freeOffset
              ? { dx: config.freeOffset.dx, dy: config.freeOffset.dy }
              : null;
        return (
          <div
            key={config.id}
            id={`module-${config.id}`}
            ref={(el) => {
              if (el) cardRefs.current.set(config.id, el);
              else cardRefs.current.delete(config.id);
            }}
            className={styles.cell}
            data-target={drag?.id === config.id && magnetic ? true : undefined}
            data-parked={!magnetic && offset ? true : undefined}
            data-solo-card={solo || undefined}
            style={{
              gridColumn: solo
                ? '1 / -1'
                : slot
                  ? `${slot.col + 1} / span ${slot.w}`
                  : undefined,
              gridRow: solo ? '1' : slot ? `${slot.row + 1} / span ${slot.h}` : undefined,
              transform: offset ? `translate(${offset.dx}px, ${offset.dy}px)` : undefined,
            }}
          >
            <MetricModule
              config={config}
              solo={solo}
              onDragStart={(e) => startDrag(e, config)}
              dragging={drag?.id === config.id && magnetic}
            />
          </div>
        );
      })}

      <div
        className={styles.cell}
        style={{
          gridColumn: solo
            ? '1 / span 2'
            : addSlot
              ? `${addSlot.col + 1} / span ${addSlot.w}`
              : undefined,
          gridRow: solo ? '2' : addSlot ? `${addSlot.row + 1} / span ${addSlot.h}` : undefined,
        }}
      >
        <AddModuleSlot solo={solo} />
      </div>

      {drag && magnetic && dragged && (
        <div
          className={styles.ghost}
          style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }}
          aria-hidden="true"
        >
          <MetricModule config={dragged} />
        </div>
      )}
    </div>
  );
}
