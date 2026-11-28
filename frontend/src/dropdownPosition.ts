export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface DropdownPosition {
  top: number;
  left: number;
  maxHeight: number;
}

/**
 * #121: Position (viewport coordinates, for `position: fixed`) of a menu that opens below its button.
 * Fixed positioning lets the menu escape scrolling/clipping containers and lie above side panels.
 * - aligned with the button's left edge; right-aligned if that would leave the window
 * - opens upwards if there is no room below but enough above
 * - never leaves the viewport (margin on every side); if it is too tall, it scrolls (maxHeight)
 */
export function dropdownPosition(anchor: AnchorRect, menu: Size, viewport: Size, gap = 6, margin = 8): DropdownPosition {
  const maxLeft = Math.max(margin, viewport.width - margin - menu.width);
  let left = anchor.left;
  if (left + menu.width > viewport.width - margin) left = anchor.right - menu.width;
  left = Math.min(Math.max(left, margin), maxLeft);

  const maxHeight = Math.max(0, viewport.height - 2 * margin);
  const height = Math.min(menu.height, maxHeight);
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - height;
  let top = below;
  if (below + height > viewport.height - margin && above >= margin) top = above;
  top = Math.min(Math.max(top, margin), Math.max(margin, viewport.height - margin - height));

  return { top, left, maxHeight };
}
