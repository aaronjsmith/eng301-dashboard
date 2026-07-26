import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { ModuleConfig } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useRole } from '../../context/RoleContext';
import { MetricModule } from './MetricModule';
import { AddModuleSlot } from './AddModuleSlot';
import { columnsFor, packModules } from './rosterLayout';
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
 * The roster grid (spec §4): explicit lattice, slots derived from module
 * array order by the first-fit packer. Dragging a card header previews
 * displacement live (FLIP, transform-only) and commits the reorder on drop;
 * magnetic off parks cards on free offsets instead; toggling back on
 * re-magnetizes to the nearest-slot order.
 */
export function ModuleGrid() {
  const { modules, magnetic, dispatch } = useWorkspace();
  const { role } = useRole();

  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const prevRects = useRef(new Map<string, DOMRect>());
  const [cols, setCols] = useState(4);
  const [previewIds, setPreviewIds] = useState<string[] | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [liveOffset, setLiveOffset] = useState<{ id: string; dx: number; dy: number } | null>(
    null,
  );

  const visible = useMemo(
    () => modules.filter((m) => !m.visibleTo || m.visibleTo.includes(role)),
    [modules, role],
  );

  const order = useMemo(() => {
    if (!previewIds) return visible;
    const byId = new Map(visible.map((m) => [m.id, m]));
    return previewIds
      .map((id) => byId.get(id))
      .filter((m): m is ModuleConfig => m !== undefined);
  }, [visible, previewIds]);

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

  const slots = useMemo(
    () => packModules(order, cols, { id: ADD_SLOT_ID }),
    [order, cols],
  );

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

  /** Merge a new VISIBLE order into the full list (hidden modules keep their spots). */
  const mergeOrder = (visibleIds: string[]): string[] => {
    const queue = [...visibleIds];
    const visibleSet = new Set(visible.map((m) => m.id));
    return modules.map((m) => (visibleSet.has(m.id) ? (queue.shift() ?? m.id) : m.id));
  };

  // Re-magnetize: toggle off→on snaps every parked card to its nearest slot.
  const prevMagnetic = useRef(magnetic);
  useEffect(() => {
    const was = prevMagnetic.current;
    prevMagnetic.current = magnetic;
    if (!was && magnetic && visible.some((m) => m.freeOffset)) {
      const centers = visible
        .map((m) => {
          const rect = cardRefs.current.get(m.id)?.getBoundingClientRect();
          return rect
            ? { id: m.id, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 }
            : { id: m.id, cx: Number.MAX_SAFE_INTEGER, cy: Number.MAX_SAFE_INTEGER };
        })
        .sort((a, b) => (Math.abs(a.cy - b.cy) > 40 ? a.cy - b.cy : a.cx - b.cx));
      dispatch({ type: 'remagnetize', ids: mergeOrder(centers.map((c) => c.id)) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [magnetic]);

  const insertionIndex = (pointerX: number, pointerY: number, draggedId: string): number => {
    const others = order.filter((m) => m.id !== draggedId);
    for (let i = 0; i < others.length; i += 1) {
      const el = cardRefs.current.get(others[i].id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (pointerY < rect.top - 4) return i;
      const sameRow = pointerY >= rect.top - 4 && pointerY <= rect.bottom + 4;
      if (sameRow && pointerX < rect.left + rect.width / 2) return i;
    }
    return others.length;
  };

  const startDrag = (e: ReactPointerEvent<HTMLElement>, config: ModuleConfig) => {
    if (e.button !== 0) return;
    const card = cardRefs.current.get(config.id);
    if (!card) return;
    const rect = card.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
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
        const idx = insertionIndex(e.clientX, e.clientY, drag.id);
        const nextIds = order.filter((m) => m.id !== drag.id).map((m) => m.id);
        nextIds.splice(idx, 0, drag.id);
        const currentIds = (previewIds ?? visible.map((m) => m.id)).join();
        if (nextIds.join() !== currentIds) setPreviewIds(nextIds);
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
        if (previewIds) dispatch({ type: 'reorder', ids: mergeOrder(previewIds) });
      } else if (liveOffset) {
        dispatch({
          type: 'set-free-offset',
          id: liveOffset.id,
          offset: { dx: liveOffset.dx, dy: liveOffset.dy },
        });
      }
      setDrag(null);
      setPreviewIds(null);
      setLiveOffset(null);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, magnetic, order, previewIds, liveOffset]);

  const dragged = drag ? visible.find((m) => m.id === drag.id) : undefined;
  const addSlot = slots.get(ADD_SLOT_ID);

  return (
    <div
      className={styles.grid}
      ref={gridRef}
      style={{ ['--grid-cols' as string]: cols }}
      data-magnetic={magnetic}
    >
      {order.map((config) => {
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
            ref={(el) => {
              if (el) cardRefs.current.set(config.id, el);
              else cardRefs.current.delete(config.id);
            }}
            className={styles.cell}
            data-target={drag?.id === config.id && magnetic ? true : undefined}
            data-parked={!magnetic && offset ? true : undefined}
            style={{
              gridColumn: slot ? `${slot.col + 1} / span ${slot.w}` : undefined,
              gridRow: slot ? `${slot.row + 1} / span ${slot.h}` : undefined,
              transform: offset ? `translate(${offset.dx}px, ${offset.dy}px)` : undefined,
            }}
          >
            <MetricModule
              config={config}
              onDragStart={(e) => startDrag(e, config)}
              dragging={drag?.id === config.id && magnetic}
            />
          </div>
        );
      })}

      <div
        className={styles.cell}
        style={{
          gridColumn: addSlot ? `${addSlot.col + 1} / span ${addSlot.w}` : undefined,
          gridRow: addSlot ? `${addSlot.row + 1} / span ${addSlot.h}` : undefined,
        }}
      >
        <AddModuleSlot />
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
