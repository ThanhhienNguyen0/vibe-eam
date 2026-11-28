import { describe, expect, it } from "vitest";
import { isRectVisible, paletteAfterResize } from "./viewportFit";

describe("isRectVisible (#128)", () => {
  const size = { width: 400, height: 300 };
  it("erkennt ein vollständig sichtbares Element", () => {
    expect(isRectVisible({ x: 100, y: 100, width: 100, height: 50 }, { x: 0, y: 0, zoom: 1 }, size)).toBe(true);
  });
  it("erkennt Elemente, die rechts (hinter dem Panel) oder oben aus der Fläche ragen", () => {
    expect(isRectVisible({ x: 350, y: 100, width: 100, height: 50 }, { x: 0, y: 0, zoom: 1 }, size)).toBe(false);
    expect(isRectVisible({ x: 100, y: -20, width: 100, height: 50 }, { x: 0, y: 0, zoom: 1 }, size)).toBe(false);
  });
  it("berücksichtigt Verschiebung und Zoom", () => {
    expect(isRectVisible({ x: 100, y: 100, width: 100, height: 50 }, { x: -50, y: 0, zoom: 2 }, size)).toBe(false);
    expect(isRectVisible({ x: 100, y: 100, width: 50, height: 40 }, { x: -100, y: -100, zoom: 1.5 }, size)).toBe(true);
  });
});

describe("paletteAfterResize (#128)", () => {
  const wide = { open: true, autoCollapsed: false, narrow: false };
  it("klappt die Palette beim Schmalerwerden automatisch ein und danach wieder auf", () => {
    const narrow = paletteAfterResize(wide, 600);
    expect(narrow).toEqual({ open: false, autoCollapsed: true, narrow: true });
    expect(paletteAfterResize(narrow, 1000)).toEqual({ open: true, autoCollapsed: false, narrow: false });
  });
  it("lässt eine bewusst geöffnete Palette im schmalen Zustand offen", () => {
    const reopened = { open: true, autoCollapsed: false, narrow: true };
    expect(paletteAfterResize(reopened, 650)).toBe(reopened);
  });
  it("öffnet eine bewusst geschlossene Palette beim Breiterwerden nicht", () => {
    expect(paletteAfterResize({ open: false, autoCollapsed: false, narrow: true }, 1000)).toEqual({ open: false, autoCollapsed: false, narrow: false });
  });
});
