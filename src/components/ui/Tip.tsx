import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './Tip.module.css';

/** Structured hover-info content: what the hovered thing IS, not its value. */
export interface TipContent {
  title?: string;
  body: string;
  note?: string;
}

interface TipProps {
  content: TipContent;
  /** Exactly one hoverable/focusable element; cloned, no wrapper DOM added. */
  children: ReactElement<Record<string, unknown>>;
  placement?: 'top' | 'bottom';
}

const SHOW_DELAY = 120;
const GAP = 8;
const EDGE = 8;

function chain<E extends SyntheticEvent>(
  prev: unknown,
  next: (e: E) => void,
): (e: E) => void {
  return (e) => {
    if (typeof prev === 'function') (prev as (e: E) => void)(e);
    next(e);
  };
}

/**
 * Explanatory hover box (portal, fixed-position). Distinct from the dark
 * L-tier chart value tooltip: this one explains meaning and abbreviations.
 * Hides on pointerdown so it can never sit over a drag interaction.
 */
export function Tip({ content, children, placement = 'bottom' }: TipProps) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timerRef = useRef<number | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const cancel = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const hide = () => {
    cancel();
    setAnchor(null);
    setPos(null);
  };
  const scheduleShow = (el: HTMLElement) => {
    cancel();
    timerRef.current = window.setTimeout(() => setAnchor(el), SHOW_DELAY);
  };

  useEffect(() => cancel, []);

  useEffect(() => {
    if (!anchor) return;
    const onScroll = () => hide();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  // Position after the box has rendered (its size is needed for flip/clamp).
  useLayoutEffect(() => {
    if (!anchor || !boxRef.current) return;
    const a = anchor.getBoundingClientRect();
    const b = boxRef.current.getBoundingClientRect();
    let above = placement === 'top';
    let y = above ? a.top - GAP - b.height : a.bottom + GAP;
    if (!above && y + b.height > window.innerHeight - EDGE) {
      above = true;
      y = a.top - GAP - b.height;
    }
    if (above && y < EDGE) y = a.bottom + GAP;
    const x = Math.min(
      Math.max(a.left + a.width / 2 - b.width / 2, EDGE),
      window.innerWidth - b.width - EDGE,
    );
    setPos({ x, y });
  }, [anchor, placement, content]);

  const props = children.props;
  const trigger = cloneElement(children, {
    'aria-describedby': anchor ? id : (props['aria-describedby'] as string | undefined),
    onMouseEnter: chain(props.onMouseEnter, (e: SyntheticEvent) =>
      scheduleShow(e.currentTarget as HTMLElement),
    ),
    onMouseLeave: chain(props.onMouseLeave, hide),
    onFocus: chain(props.onFocus, (e: SyntheticEvent) =>
      scheduleShow(e.currentTarget as HTMLElement),
    ),
    onBlur: chain(props.onBlur, hide),
    onPointerDown: chain(props.onPointerDown, hide),
  });

  return (
    <>
      {trigger}
      {anchor &&
        createPortal(
          <div
            ref={boxRef}
            id={id}
            role="tooltip"
            className={styles.tip}
            style={
              pos
                ? { left: pos.x, top: pos.y }
                : { left: -9999, top: -9999, visibility: 'hidden' }
            }
          >
            {content.title && <p className={styles.title}>{content.title}</p>}
            <p className={styles.body}>{content.body}</p>
            {content.note && <p className={styles.note}>{content.note}</p>}
          </div>,
          document.body,
        )}
    </>
  );
}
