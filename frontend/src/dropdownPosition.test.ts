import { describe, expect, it } from "vitest";
import { dropdownPosition } from "./dropdownPosition";

const viewport = { width: 1280, height: 720 };
const menu = { width: 290, height: 140 };
const button = (left: number, top = 60, width = 90, height = 32) => ({ left, right: left + width, top, bottom: top + height });

describe("dropdownPosition (#121)", () => {
  it("opens below the button, aligned left", () => {
    expect(dropdownPosition(button(400), menu, viewport)).toEqual({ top: 98, left: 400, maxHeight: 704 });
  });

  it("aligns to the button's right edge near the right window border (e.g. next to the detail panel)", () => {
    // Button at the right edge: left-aligned the menu would leave the window.
    const position = dropdownPosition(button(1150), menu, viewport);
    expect(position.left).toBe(1240 - 290);
    expect(position.left + menu.width).toBeLessThanOrEqual(viewport.width - 8);
  });

  it("stays inside a narrow window", () => {
    const position = dropdownPosition(button(100), menu, { width: 250, height: 600 });
    expect(position.left).toBe(8);
  });

  it("opens upwards when there is no room below but enough above", () => {
    const position = dropdownPosition(button(400, 620), menu, viewport);
    expect(position.top).toBe(620 - 6 - 140);
  });

  it("keeps a too tall menu inside the viewport and lets it scroll", () => {
    const position = dropdownPosition(button(400, 100), { width: 290, height: 900 }, viewport);
    expect(position.top).toBe(8);
    expect(position.maxHeight).toBe(704);
  });
});
