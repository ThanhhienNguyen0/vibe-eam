/** #122: keeps right-click menus inside the browser window so every entry stays clickable. */

export interface MenuPoint { x: number; y: number }
export interface MenuSize { width: number; height: number }

export const MENU_VIEWPORT_MARGIN = 8;

/**
 * Where a menu opened at `anchor` (the cursor) has to go so it is fully visible.
 * Near the right or bottom edge it opens to the left of or above the cursor, like native menus;
 * then it is pushed inside the window. A menu larger than the window sticks to the top/left margin
 * (CSS limits its height and makes it scrollable). Placing an already placed menu again changes nothing.
 */
export function fitMenuInViewport(anchor: MenuPoint, menu: MenuSize, viewport: MenuSize, margin = MENU_VIEWPORT_MARGIN): MenuPoint {
  return {
    x: fitAxis(anchor.x, menu.width, viewport.width, margin),
    y: fitAxis(anchor.y, menu.height, viewport.height, margin)
  };
}

function fitAxis(start: number, size: number, available: number, margin: number): number {
  const opened = start + size > available - margin ? start - size : start;
  return Math.max(margin, Math.min(opened, available - size - margin));
}
