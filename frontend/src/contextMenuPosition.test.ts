import { describe, expect, it } from "vitest";
import { fitMenuInViewport } from "./contextMenuPosition";

const viewport = { width: 1000, height: 800 };
const menu = { width: 200, height: 240 };

function isInside(position: { x: number; y: number }, size = menu, area = viewport) {
  return position.x >= 8 && position.y >= 8 && position.x + size.width <= area.width - 8 && position.y + size.height <= area.height - 8;
}

describe("context menu placement (#122)", () => {
  it("opens at the cursor when there is enough room", () => {
    expect(fitMenuInViewport({ x: 300, y: 200 }, menu, viewport)).toEqual({ x: 300, y: 200 });
  });

  it("opens above the cursor at the bottom edge so the last entry stays clickable", () => {
    const position = fitMenuInViewport({ x: 300, y: 760 }, menu, viewport);
    expect(position).toEqual({ x: 300, y: 520 });
    expect(isInside(position)).toBe(true);
  });

  it("opens left of the cursor at the right edge", () => {
    const position = fitMenuInViewport({ x: 950, y: 200 }, menu, viewport);
    expect(position).toEqual({ x: 750, y: 200 });
    expect(isInside(position)).toBe(true);
  });

  it("stays inside at the top and left edges", () => {
    expect(fitMenuInViewport({ x: -40, y: -15 }, menu, viewport)).toEqual({ x: 8, y: 8 });
    expect(fitMenuInViewport({ x: 2, y: 3 }, menu, viewport)).toEqual({ x: 8, y: 8 });
  });

  it("stays inside in a corner", () => {
    expect(isInside(fitMenuInViewport({ x: 995, y: 795 }, menu, viewport))).toBe(true);
  });

  it("moves to the top margin when there is room neither below nor above the cursor", () => {
    const position = fitMenuInViewport({ x: 300, y: 600 }, { width: 200, height: 700 }, viewport);
    expect(position).toEqual({ x: 300, y: 8 });
    expect(isInside(position, { width: 200, height: 700 })).toBe(true);
  });

  it("sticks to the top margin when the menu is taller than the window", () => {
    expect(fitMenuInViewport({ x: 300, y: 300 }, { width: 200, height: 900 }, viewport)).toEqual({ x: 300, y: 8 });
  });

  it("keeps an already placed menu where it is", () => {
    for (const anchor of [{ x: 300, y: 760 }, { x: 950, y: 790 }, { x: 300, y: 600 }, { x: -5, y: -5 }]) {
      for (const size of [menu, { width: 200, height: 700 }, { width: 1200, height: 900 }]) {
        const placed = fitMenuInViewport(anchor, size, viewport);
        expect(fitMenuInViewport(placed, size, viewport)).toEqual(placed);
      }
    }
  });
});
