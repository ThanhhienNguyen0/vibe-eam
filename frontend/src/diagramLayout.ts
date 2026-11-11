/** Pure layout helpers for the diagram editor (BUG-02): grid, rulers and placement of new elements. */

import type { ComponentShape } from "./Sidebar/sidebarTypes";

export const GRID_SIZE = 20;

/** Default node size per shape; shared by the canvas and the image export (REQ-11). */
export const SHAPE_DEFAULTS: Record<ComponentShape, { width: number; height: number }> = {
  box: { width: 160, height: 72 },
  process: { width: 160, height: 72 },
  datastore: { width: 140, height: 80 },
  event: { width: 110, height: 110 },
  "event-start": { width: 110, height: 110 },
  "event-end": { width: 110, height: 110 },
  gateway: { width: 120, height: 100 },
  "gateway-xor": { width: 120, height: 100 },
  "gateway-and": { width: 120, height: 100 },
  "gateway-or": { width: 120, height: 100 },
  pool: { width: 480, height: 260 }
};

export function shapeDefaultSize(shape: ComponentShape) {
  return SHAPE_DEFAULTS[shape] ?? SHAPE_DEFAULTS.box;
}

export interface Rect { x: number; y: number; width: number; height: number }
export interface Point { x: number; y: number }

export function snapToGrid(value: number, enabled = true, step = GRID_SIZE): number {
  return enabled ? Math.round(value / step) * step : Math.round(value);
}

export function snapPoint(point: Point, enabled = true): Point {
  return { x: snapToGrid(point.x, enabled), y: snapToGrid(point.y, enabled) };
}

const overlaps = (a: Rect, b: Rect, gap: number): boolean =>
  a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;

/**
 * Finds a free spot for a new element: the preferred position if it is free, otherwise the nearest free
 * grid cell around it (spiral search). Never returns random values, so reloads stay stable.
 */
export function findFreePosition(
  occupied: Rect[],
  preferred: Point,
  size: { width: number; height: number },
  options: { gap?: number; snap?: boolean; maxRings?: number } = {}
): Point {
  const gap = options.gap ?? 24;
  const snap = options.snap ?? true;
  const maxRings = options.maxRings ?? 40;
  const stepX = snapToGrid(size.width + gap, true) || GRID_SIZE;
  const stepY = snapToGrid(size.height + gap, true) || GRID_SIZE;
  const origin = snapPoint(preferred, snap);
  const isFree = (candidate: Point) =>
    !occupied.some((rect) => overlaps({ ...candidate, ...size }, rect, gap));
  if (isFree(origin)) return origin;
  for (let ring = 1; ring <= maxRings; ring++) {
    const candidates: Point[] = [];
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        candidates.push({ x: origin.x + dx * stepX, y: origin.y + dy * stepY });
      }
    }
    // Prefer right/below of the preferred position, then by distance (stable order).
    candidates.sort((a, b) =>
      Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y)
      || a.y - b.y || a.x - b.x);
    const free = candidates.find(isFree);
    if (free) return free;
  }
  const bottom = occupied.reduce((max, rect) => Math.max(max, rect.y + rect.height), origin.y);
  return { x: origin.x, y: snapToGrid(bottom + gap, snap) };
}

/** Deterministic fallback grid position for elements without a stored position. */
export function fallbackPosition(index: number, columns = 4, cell = { width: 220, height: 130 }): Point {
  return { x: 80 + (index % columns) * cell.width, y: 80 + Math.floor(index / columns) * cell.height };
}

const NICE = [1, 2, 5];

/** Tick spacing (in flow units) that results in roughly `targetPx` on screen. */
export function niceStep(zoom: number, targetPx = 80): number {
  const raw = targetPx / Math.max(zoom, 0.0001);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  for (const factor of NICE) {
    if (factor * magnitude >= raw) return factor * magnitude;
  }
  return 10 * magnitude;
}

export interface Tick { value: number; screen: number }

/** Ticks for a ruler: `offset` is the viewport translation in screen px, `length` the ruler length in px. */
export function rulerTicks(offset: number, length: number, zoom: number, targetPx = 80): Tick[] {
  const step = niceStep(zoom, targetPx);
  const start = Math.floor(-offset / zoom / step) * step;
  const end = (length - offset) / zoom;
  const ticks: Tick[] = [];
  for (let value = start; value <= end && ticks.length < 400; value += step) {
    ticks.push({ value: Math.round(value * 1000) / 1000, screen: value * zoom + offset });
  }
  return ticks;
}

/** Bounding box of positioned elements, used to decide whether the view is empty. */
export function boundsOf(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
