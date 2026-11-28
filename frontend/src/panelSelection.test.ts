import { describe, expect, it } from "vitest";
import { selectionAfterContextChange } from "./panelSelection";

const diagram = { id: "d1", componentIds: ["c1"], connectionIds: ["r1"] };
const empty = { id: "d2", componentIds: [], connectionIds: [] };

describe("selectionAfterContextChange (#114)", () => {
  it("behält Komponenten und Verbindungen, die im neuen Diagramm liegen", () => {
    expect(selectionAfterContextChange({ kind: "component", id: "c1" }, { kind: "diagram", diagram })).toEqual({ kind: "component", id: "c1" });
    expect(selectionAfterContextChange({ kind: "connection", id: "r1" }, { kind: "diagram", diagram })).toEqual({ kind: "connection", id: "r1" });
  });

  it("leert das Panel beim Wechsel in ein leeres Diagramm", () => {
    expect(selectionAfterContextChange({ kind: "component", id: "c1" }, { kind: "diagram", diagram: empty })).toBeNull();
    expect(selectionAfterContextChange({ kind: "connection", id: "r1" }, { kind: "diagram", diagram: empty })).toBeNull();
  });

  it("zeigt kein anderes Diagramm mehr an, behält aber das geöffnete", () => {
    expect(selectionAfterContextChange({ kind: "diagram", id: "d1" }, { kind: "diagram", diagram })).toEqual({ kind: "diagram", id: "d1" });
    expect(selectionAfterContextChange({ kind: "diagram", id: "d1" }, { kind: "diagram", diagram: empty })).toBeNull();
  });

  it("leert das Panel bei unbekanntem Diagramm und bei Bereichswechsel", () => {
    expect(selectionAfterContextChange({ kind: "component", id: "c1" }, { kind: "diagram", diagram: undefined })).toBeNull();
    expect(selectionAfterContextChange({ kind: "component", id: "c1" }, { kind: "area" })).toBeNull();
    expect(selectionAfterContextChange({ kind: "viewpoint", id: "v1" }, { kind: "area" })).toBeNull();
    expect(selectionAfterContextChange(null, { kind: "diagram", diagram })).toBeNull();
  });
});
