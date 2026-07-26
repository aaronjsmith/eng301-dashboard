import type { ModuleConfig, SizeTier } from '../../types';

/**
 * The roster lattice (spec §4): a rows × columns grid of slots. Layout truth
 * is the module ARRAY ORDER — this deterministic first-fit packer derives
 * (col, row) spans from it, so there are no stored coordinates to drift.
 */

export interface Slot {
  col: number; // 0-based
  row: number;
  w: number;
  h: number;
}

export function spanOf(size: SizeTier, cols: number): { w: number; h: number } {
  const w = size === 'S' ? 1 : Math.min(2, cols);
  const h = size === 'L' ? 2 : 1;
  return { w, h };
}

/** First-fit, row-major. Nothing overlaps; wide spans wrap, never overflow. */
export function packModules(
  modules: Pick<ModuleConfig, 'id' | 'size'>[],
  cols: number,
  trailing?: { id: string },
): Map<string, Slot> {
  const occupied: boolean[][] = [];
  const ensureRow = (row: number) => {
    while (occupied.length <= row) occupied.push(new Array<boolean>(cols).fill(false));
  };
  const fits = (col: number, row: number, w: number, h: number) => {
    if (col + w > cols) return false;
    for (let r = row; r < row + h; r += 1) {
      ensureRow(r);
      for (let c = col; c < col + w; c += 1) {
        if (occupied[r][c]) return false;
      }
    }
    return true;
  };
  const claim = (col: number, row: number, w: number, h: number) => {
    for (let r = row; r < row + h; r += 1) {
      ensureRow(r);
      for (let c = col; c < col + w; c += 1) occupied[r][c] = true;
    }
  };

  const slots = new Map<string, Slot>();
  const place = (id: string, w: number, h: number) => {
    for (let row = 0; ; row += 1) {
      ensureRow(row);
      for (let col = 0; col <= cols - w; col += 1) {
        if (fits(col, row, w, h)) {
          claim(col, row, w, h);
          slots.set(id, { col, row, w, h });
          return;
        }
      }
    }
  };

  for (const m of modules) {
    const { w, h } = spanOf(m.size, cols);
    place(m.id, w, h);
  }
  if (trailing) place(trailing.id, 1, 1); // the Add-module slot packs last

  return slots;
}

/** Columns that fit the container at the 230px module minimum (min 2). */
export function columnsFor(width: number, gap = 18, min = 230): number {
  if (width <= 0) return 2;
  return Math.max(2, Math.floor((width + gap) / (min + gap)));
}
