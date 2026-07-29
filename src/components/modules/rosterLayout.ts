import type { GridSlot, SizeTier } from '../../types';

/**
 * The roster lattice (spec §4) as a coordinate grid with gravity. Each module
 * may carry a desired (col,row); resolve() turns desires into a collision-free
 * layout: the moved card wins its cells, displaced cards push straight down,
 * then everything falls upward per column until blocked (react-grid-layout
 * style vertical compaction) — so a small card CAN sit under another with
 * free space beside it. Cards without a slot auto-place first-fit row-major.
 * Pure functions only — drag targeting never reads card DOM rects.
 */

/** Grid units are HALF-columns × 141px rows so M can sit between S and L on
 * both axes. Tiers span (col units × row units): S=2×2, M=3×3, L=4×4 —
 * i.e. 1 / 1.5 / 2 card-columns wide and 300 / 459 / 618px tall
 * (k·ROW_UNIT + (k−1)·GRID_GAP). */
export const ROW_UNIT = 141;
export const GRID_GAP = 18;

export interface Slot {
  col: number; // 0-based
  row: number;
  w: number;
  h: number;
}

export interface LayoutItem {
  id: string;
  size: SizeTier;
  slot?: GridSlot | null;
}

export interface ResolveOpts {
  /** Dragged/moved card: placed FIRST at its exact cell — it wins its cells. */
  priorityId?: string;
  /** Preview only: exempt the priority card from gravity (stays at pointer cell). */
  keepPriorityInPlace?: boolean;
  /** Auto-place a trailing 2×2 (the Add slot, S-sized) into the first free cell. */
  trailingId?: string;
}

export function spanOf(size: SizeTier, cols: number): { w: number; h: number } {
  const w = size === 'S' ? 2 : Math.min(size === 'M' ? 3 : 4, cols);
  const h = size === 'S' ? 2 : size === 'M' ? 3 : 4;
  return { w, h };
}

class Occupancy {
  private rows: boolean[][] = [];
  private cols: number;

  constructor(cols: number) {
    this.cols = cols;
  }

  private ensureRow(row: number) {
    while (this.rows.length <= row) {
      this.rows.push(new Array<boolean>(this.cols).fill(false));
    }
  }

  fits(col: number, row: number, w: number, h: number): boolean {
    if (col < 0 || col + w > this.cols || row < 0) return false;
    for (let r = row; r < row + h; r += 1) {
      this.ensureRow(r);
      for (let c = col; c < col + w; c += 1) {
        if (this.rows[r][c]) return false;
      }
    }
    return true;
  }

  claim(col: number, row: number, w: number, h: number) {
    for (let r = row; r < row + h; r += 1) {
      this.ensureRow(r);
      for (let c = col; c < col + w; c += 1) this.rows[r][c] = true;
    }
  }
}

/**
 * Deterministic layout resolution. Idempotent: feeding a resolved layout back
 * in reproduces it exactly, so committed layouts render as committed. With no
 * slotted items it degenerates to the original first-fit packer (which is
 * gravity-stable by construction) — the boot overview is unchanged.
 */
export function resolve(
  items: LayoutItem[],
  cols: number,
  opts: ResolveOpts = {},
): Map<string, Slot> {
  const placed = new Map<string, Slot>();
  const occ = new Occupancy(cols);

  const firstFit = (id: string, w: number, h: number) => {
    for (let row = 0; ; row += 1) {
      for (let col = 0; col <= cols - w; col += 1) {
        if (occ.fits(col, row, w, h)) {
          occ.claim(col, row, w, h);
          placed.set(id, { col, row, w, h });
          return;
        }
      }
    }
  };

  // Phase 0 — normalize desires.
  const normalized = items.map((item, index) => {
    const { w, h } = spanOf(item.size, cols);
    const slot = item.slot
      ? {
          col: Math.max(0, Math.min(item.slot.col, cols - w)),
          row: Math.max(0, item.slot.row),
        }
      : null;
    return { id: item.id, w, h, slot, index };
  });

  // Phase 1 — placement; the priority card wins, collisions push straight down.
  const pushDown = (id: string, col: number, row: number, w: number, h: number) => {
    let r = row;
    while (!occ.fits(col, r, w, h)) r += 1;
    occ.claim(col, r, w, h);
    placed.set(id, { col, row: r, w, h });
  };

  const priority = opts.priorityId
    ? normalized.find((n) => n.id === opts.priorityId && n.slot)
    : undefined;
  if (priority && priority.slot) {
    occ.claim(priority.slot.col, priority.slot.row, priority.w, priority.h);
    placed.set(priority.id, { ...priority.slot, w: priority.w, h: priority.h });
  }

  const slotted = normalized
    .filter((n) => n.slot && n !== priority)
    .sort((a, b) => a.slot!.row - b.slot!.row || a.slot!.col - b.slot!.col || a.index - b.index);
  for (const n of slotted) pushDown(n.id, n.slot!.col, n.slot!.row, n.w, n.h);

  for (const n of normalized) {
    if (!n.slot) firstFit(n.id, n.w, n.h);
  }

  // Phase 2 — per-column upward gravity. Blockers finalize before fallers
  // (reading order), so a single pass suffices.
  const final = new Map<string, Slot>();
  const gravOcc = new Occupancy(cols);
  if (priority && opts.keepPriorityInPlace) {
    const s = placed.get(priority.id)!;
    gravOcc.claim(s.col, s.row, s.w, s.h);
    final.set(priority.id, s);
  }
  const fallers = [...placed.entries()]
    .filter(([id]) => !final.has(id))
    .sort((a, b) => a[1].row - b[1].row || a[1].col - b[1].col);
  for (const [id, s] of fallers) {
    let r = s.row;
    while (r > 0 && gravOcc.fits(s.col, r - 1, s.w, s.h)) r -= 1;
    gravOcc.claim(s.col, r, s.w, s.h);
    final.set(id, { ...s, row: r });
  }

  // Phase 3 — the Add slot packs into the first free cell.
  if (opts.trailingId) {
    for (let row = 0; ; row += 1) {
      let done = false;
      for (let col = 0; col < cols; col += 1) {
        if (gravOcc.fits(col, row, 2, 2)) {
          gravOcc.claim(col, row, 2, 2);
          final.set(opts.trailingId, { col, row, w: 2, h: 2 });
          done = true;
          break;
        }
      }
      if (done) break;
    }
  }

  return final;
}

/** Geometry-only pointer→cell mapping — never reads card DOM rects. */
export function cellFromPointer(
  grid: { left: number; top: number; width: number },
  cols: number,
  x: number,
  y: number,
  gap = GRID_GAP,
  rowH = ROW_UNIT,
): GridSlot {
  const colW = (grid.width - gap * (cols - 1)) / cols;
  const col = Math.max(0, Math.min(cols - 1, Math.floor((x - grid.left) / (colW + gap))));
  const row = Math.max(0, Math.floor((y - grid.top) / (rowH + gap)));
  return { col, row };
}

/**
 * Clamp a drag target so the span fits and dropping below everything appends.
 * The row extent reads the given slots AS-IS — re-compacting here would let
 * cards rise into the dragged card's vacated cell and shrink the extent,
 * clamping a drop-below-neighbor onto the neighbor instead.
 */
export function clampTargetCell(
  items: LayoutItem[],
  cols: number,
  draggedId: string,
  cell: GridSlot,
): GridSlot {
  const dragged = items.find((i) => i.id === draggedId);
  const { w } = dragged ? spanOf(dragged.size, cols) : { w: 2 };
  let extent = 0;
  let hasUnslotted = false;
  for (const item of items) {
    if (item.id === draggedId) continue;
    if (item.slot) {
      extent = Math.max(extent, item.slot.row + spanOf(item.size, cols).h);
    } else {
      hasUnslotted = true;
    }
  }
  if (hasUnslotted) {
    const others = resolve(items.filter((i) => i.id !== draggedId), cols);
    for (const s of others.values()) extent = Math.max(extent, s.row + s.h);
  }
  return {
    col: Math.max(0, Math.min(cell.col, cols - w)),
    row: Math.min(cell.row, extent),
  };
}

/** Grid column UNITS (half-columns) that fit the container at the 230px
 * module minimum — always even, min 4 (two card-columns). */
export function columnsFor(width: number, gap = 18, min = 230): number {
  if (width <= 0) return 4;
  return 2 * Math.max(2, Math.floor((width + gap) / (min + gap)));
}
