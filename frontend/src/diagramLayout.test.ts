import { describe, expect, it } from "vitest";
import { boundsOf, fallbackPosition, findFreePosition, niceStep, rulerTicks, snapPoint, snapToGrid } from "./diagramLayout";

const size = { width: 160, height: 80 };

describe("diagram layout helpers", () => {
  it("snaps to the grid or rounds when snapping is off", () => {
    expect(snapToGrid(33)).toBe(40);
    expect(snapToGrid(33, false)).toBe(33);
    expect(snapPoint({ x: 9, y: 11 })).toEqual({ x: 0, y: 20 });
  });

  it("keeps the preferred position when it is free", () => {
    expect(findFreePosition([], { x: 100, y: 100 }, size)).toEqual({ x: 100, y: 100 });
  });

  it("moves to a free neighbouring cell instead of overlapping", () => {
    const occupied = [{ x: 100, y: 100, ...size }];
    const spot = findFreePosition(occupied, { x: 100, y: 100 }, size);
    expect(spot).not.toEqual({ x: 100, y: 100 });
    const overlapping = spot.x < 260 + 24 && spot.x + 160 + 24 > 100 && spot.y < 180 + 24 && spot.y + 80 + 24 > 100;
    expect(overlapping).toBe(false);
  });

  it("is deterministic and never overlaps many elements", () => {
    const placed: Array<{ x: number; y: number; width: number; height: number }> = [];
    for (let index = 0; index < 12; index++) {
      const spot = findFreePosition(placed, { x: 0, y: 0 }, size);
      expect(findFreePosition(placed, { x: 0, y: 0 }, size)).toEqual(spot);
      placed.push({ ...spot, ...size });
    }
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        expect(apart, `${i} vs ${j}`).toBe(true);
      }
    }
  });

  it("provides stable fallback positions", () => {
    expect(fallbackPosition(0)).toEqual(fallbackPosition(0));
    expect(fallbackPosition(5)).toEqual({ x: 300, y: 210 });
  });

  it("chooses readable ruler steps", () => {
    expect(niceStep(1)).toBe(100);
    expect(niceStep(0.5)).toBe(200);
    expect(niceStep(2)).toBe(50);
  });

  it("creates ruler ticks that cover the visible range including the origin", () => {
    const ticks = rulerTicks(100, 800, 1);
    expect(ticks.some((tick) => tick.value === 0 && tick.screen === 100)).toBe(true);
    expect(Math.min(...ticks.map((tick) => tick.screen))).toBeLessThanOrEqual(0);
    expect(Math.max(...ticks.map((tick) => tick.screen))).toBeGreaterThanOrEqual(700);
  });

  it("computes bounds", () => {
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([{ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 30, width: 10, height: 10 }])).toEqual({ x: 0, y: 0, width: 30, height: 40 });
  });
});
