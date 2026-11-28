/** #128: Hilfsfunktionen, damit Fläche und Auswahl auch bei kleinen Fenstern sichtbar bleiben. */

export type FlowRect = { x: number; y: number; width: number; height: number };
export type FlowViewport = { x: number; y: number; zoom: number };

/** Ab dieser Editorbreite klappt die Palette automatisch ein (1280×720 mit offenem Detail-Panel). */
export const PALETTE_AUTO_COLLAPSE_WIDTH = 760;

/** Liegt das Rechteck (Diagrammkoordinaten) vollständig im sichtbaren Bereich der Fläche? */
export function isRectVisible(rect: FlowRect, viewport: FlowViewport, size: { width: number; height: number }, margin = 16): boolean {
  const left = rect.x * viewport.zoom + viewport.x;
  const top = rect.y * viewport.zoom + viewport.y;
  const right = left + rect.width * viewport.zoom;
  const bottom = top + rect.height * viewport.zoom;
  return left >= margin && top >= margin && right <= size.width - margin && bottom <= size.height - margin;
}

/**
 * Soll die Palette wegen der Breite automatisch zu- oder wieder aufgehen?
 * Nur beim Überschreiten der Schwelle – eine bewusste Entscheidung der Nutzerin bleibt sonst bestehen.
 */
export function paletteAfterResize(
  state: { open: boolean; autoCollapsed: boolean; narrow: boolean },
  width: number
): { open: boolean; autoCollapsed: boolean; narrow: boolean } {
  const narrow = width < PALETTE_AUTO_COLLAPSE_WIDTH;
  if (narrow === state.narrow) return state;
  if (narrow && state.open) return { open: false, autoCollapsed: true, narrow };
  if (!narrow && state.autoCollapsed) return { open: true, autoCollapsed: false, narrow };
  return { ...state, narrow };
}
