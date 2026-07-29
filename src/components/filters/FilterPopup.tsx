import { useEffect, useRef, useState } from 'react';
import type { Dimension, FilterState, StudentRow } from '../../types';
import { useRole } from '../../context/RoleContext';
import { popupDimensions } from '../../metrics/availability';
import {
  DIMENSION_META,
  dimensionValues,
  groupBy,
  SMALL_CELL,
  valueLabel,
} from '../../metrics/scope';
import { tooFewStudentsLabel } from '../../metrics/format';
import styles from './FilterPopup.module.css';

interface FilterPopupProps {
  /** The module's outer population (role ∩ global) — drives counts. */
  scopeRows: StudentRow[];
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  onClose: () => void;
}

/**
 * FR5 — the module filter: one checklist group per dimension, per-group
 * all/none, Apply + Reset. NOTHING recomputes until Apply (draft state), so
 * half-configured filters never flash wrong numbers. Role gating strips
 * dimensions before render; values that would create a small cell (n < 20)
 * are disabled — "aggregate only".
 */
export function FilterPopup({ scopeRows, filters, onApply, onClose }: FilterPopupProps) {
  const { role } = useRole();
  const rootRef = useRef<HTMLDivElement>(null);

  const dims = popupDimensions(role);
  const [draft, setDraft] = useState<FilterState>(() => ({ ...filters }));

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      // The wrapper (popup + its opener button) counts as inside — otherwise
      // clicking the Filter button closes on pointerdown and re-opens on click.
      const inside = (rootRef.current?.parentElement ?? rootRef.current)?.contains(
        e.target as Node,
      );
      if (!inside) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const isChecked = (dim: Dimension, value: string) => {
    const selected = draft[dim];
    return selected === undefined || selected.includes(value);
  };

  const toggle = (dim: Dimension, value: string, all: string[]) => {
    setDraft((prev) => {
      const current = prev[dim] ?? all;
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      const copy = { ...prev };
      if (next.length === all.length) delete copy[dim];
      else copy[dim] = next;
      return copy;
    });
  };

  const setAll = (dim: Dimension, on: boolean) => {
    setDraft((prev) => {
      const copy = { ...prev };
      if (on) delete copy[dim];
      else copy[dim] = [];
      return copy;
    });
  };

  return (
    <div className={styles.popup} ref={rootRef} role="dialog" aria-label="Module filters">
      <div className={styles.groups}>
        {dims.map((dim) => {
          const values = dimensionValues(scopeRows, dim);
          if (values.length < 2) return null;
          const counts = new Map(
            [...groupBy(scopeRows, dim)].map(([v, rows]) => [v, rows.length]),
          );
          const allSmall = values.every((v) => (counts.get(v) ?? 0) < SMALL_CELL);
          return (
            <fieldset key={dim} className={styles.group}>
              <legend className={styles.legend}>
                {DIMENSION_META[dim].label}
                <span className={styles.groupActions}>
                  <button type="button" onClick={() => setAll(dim, true)}>
                    all
                  </button>
                  <button type="button" onClick={() => setAll(dim, false)}>
                    none
                  </button>
                </span>
              </legend>
              {allSmall ? (
                <p className={styles.aggregateOnly}>
                  Too few students to show — every group is under {SMALL_CELL}
                </p>
              ) : (
                values.map((value) => {
                  const n = counts.get(value) ?? 0;
                  const tooSmall = role !== 'faculty' && n < SMALL_CELL;
                  return (
                    <label
                      key={value}
                      className={tooSmall ? styles.valueDisabled : styles.value}
                    >
                      <input
                        type="checkbox"
                        checked={!tooSmall && isChecked(dim, value)}
                        disabled={tooSmall}
                        onChange={() => toggle(dim, value, values)}
                      />
                      <span>{valueLabel(dim, value)}</span>
                      <span className={styles.count}>
                        {tooSmall ? tooFewStudentsLabel(SMALL_CELL) : n}
                      </span>
                    </label>
                  );
                })
              )}
            </fieldset>
          );
        })}
      </div>
      <div className={styles.footer}>
        <button type="button" className={styles.reset} onClick={() => setDraft({})}>
          Clear filters
        </button>
        <button
          type="button"
          className={styles.apply}
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
