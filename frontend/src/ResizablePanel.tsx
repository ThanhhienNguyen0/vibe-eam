import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

export function clampWidth(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function readStoredWidth(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampWidth(parsed, min, max) : fallback;
  } catch {
    return fallback;
  }
}

interface ResizablePanelProps {
  /** Which edge carries the drag handle: "left" panels grow to the right, "right" panels grow to the left. */
  side: "left" | "right";
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  label: string;
  children: ReactNode;
}

/** Wraps a side panel so users can drag its inner edge to make it wider or narrower (width is remembered). */
export default function ResizablePanel({ side, storageKey, defaultWidth, minWidth, maxWidth, label, children }: ResizablePanelProps) {
  const [width, setWidth] = useState(() => readStoredWidth(storageKey, defaultWidth, minWidth, maxWidth));
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, String(width)); } catch { /* storage not available */ }
  }, [storageKey, width]);

  const update = useCallback((next: number) => setWidth(clampWidth(next, minWidth, maxWidth)), [minWidth, maxWidth]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: width };
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const delta = event.clientX - drag.current.startX;
    update(drag.current.startWidth + (side === "left" ? delta : -delta));
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 48 : 16;
    // Arrow direction = direction the panel edge moves.
    const grow = side === "left" ? "ArrowRight" : "ArrowLeft";
    const shrink = side === "left" ? "ArrowLeft" : "ArrowRight";
    if (event.key === grow) { event.preventDefault(); update(width + step); }
    if (event.key === shrink) { event.preventDefault(); update(width - step); }
    if (event.key === "Home") { event.preventDefault(); update(defaultWidth); }
  };

  return (
    <div
      className={`panel-resizable panel-resizable--${side}${dragging ? " is-dragging" : ""}`}
      style={{ "--panel-width": `${width}px` } as CSSProperties}
    >
      {children}
      <div
        className="panel-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label={`${label} in der Breite ändern`}
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        tabIndex={0}
        title="Ziehen zum Ändern der Breite, Doppelklick setzt zurück"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => update(defaultWidth)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
