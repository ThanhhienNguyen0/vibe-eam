import { describe, expect, it } from "vitest";
import {
  buildExportScene,
  clampPngScale,
  cropScene,
  exportFileName,
  exportSize,
  legendEntries,
  renderIconMarkup,
  sceneIcons,
  MAX_PNG_PIXELS,
  renderDiagramSvg,
  sceneBounds,
  viewportArea,
  wrapText
} from "./diagramExport";
import type { ComponentInstance, ComponentType, ConnectionInstance, ConnectionType, Diagram } from "./Sidebar/sidebarTypes";

const types: ComponentType[] = [
  { id: "app", name: "Applikation", color: "#2563eb", icon: "", description: "", customPropertyKeys: [], shape: "box" },
  { id: "db", name: "Datenbank", color: "#16a34a", icon: "", description: "", customPropertyKeys: [], shape: "datastore" },
  { id: "pool", name: "Bereich", color: "#9333ea", icon: "", description: "", customPropertyKeys: [], shape: "pool" }
];
const connectionTypes: ConnectionType[] = [
  { id: "uses", name: "nutzt", color: "#dc2626", lineStyle: "dashed", allowedSourceTypeIds: [], allowedTargetTypeIds: [], description: "" }
];
const comp = (id: string, name: string, componentTypeId: string): ComponentInstance =>
  ({ id, name, componentTypeId, properties: {}, description: "" });
const components = [comp("crm", "CRM & <Vertrieb>", "app"), comp("store", "Kundendaten", "db"), comp("area", "Vertrieb", "pool")];
const connections: ConnectionInstance[] = [
  { id: "c1", name: "", connectionTypeId: "uses", sourceComponentId: "crm", targetComponentId: "store", description: "" }
];
const diagram: Diagram = {
  id: "d1",
  name: "Systemlandschaft",
  description: "",
  componentIds: ["area", "crm", "store"],
  connectionIds: ["c1"],
  positions: {
    area: { x: 0, y: 0, width: 600, height: 300 },
    crm: { x: 60, y: 100 },
    store: { x: 400, y: 100 }
  }
};

describe("REQ-11 diagram export", () => {
  it("builds the scene from the (filtered) diagram with canvas default sizes", () => {
    const scene = buildExportScene(diagram, components, types, connections, connectionTypes);
    expect(scene.nodes.map((n) => n.id)).toEqual(["area", "crm", "store"]);
    expect(scene.nodes.find((n) => n.id === "crm")).toMatchObject({ width: 160, height: 72, color: "#2563eb" });
    expect(scene.edges).toEqual([expect.objectContaining({ id: "c1", label: "nutzt", color: "#dc2626", dash: "6 3" })]);
  });

  it("respects an active view filter: hidden components and their connections are not exported", () => {
    const filtered: Diagram = { ...diagram, componentIds: ["area", "crm"], connectionIds: ["c1"] };
    const scene = buildExportScene(filtered, components, types, connections, connectionTypes);
    expect(scene.nodes.map((n) => n.id)).toEqual(["area", "crm"]);
    expect(scene.edges).toHaveLength(0);
  });

  it("writes labels as real, escaped SVG text so they stay searchable", () => {
    const scene = buildExportScene(diagram, components, types, connections, connectionTypes);
    const { svg } = renderDiagramSvg(scene, sceneBounds(scene)!, "Systemlandschaft");
    expect(svg).toContain("<svg xmlns=\"http://www.w3.org/2000/svg\"");
    expect(svg).not.toContain("foreignObject");
    // Long name wraps into two <tspan> lines, both escaped.
    expect(svg).toMatch(/<text[^>]*><tspan[^>]*>CRM &amp;<\/tspan><tspan[^>]*>&lt;Vertrieb&gt;<\/tspan><\/text>/);
    expect(svg).toMatch(/<text[^>]*>.*Kundendaten/);
    expect(svg).toMatch(/<text[^>]*>.*nutzt/);
    expect(svg).toContain("<title>Systemlandschaft</title>");
    // Pools are drawn first so they stay behind the other elements.
    expect(svg.indexOf('data-id="area"')).toBeLessThan(svg.indexOf('data-id="crm"'));
  });

  it("exports the whole diagram with padding, or only the visible viewport", () => {
    const scene = buildExportScene(diagram, components, types, connections, connectionTypes);
    expect(sceneBounds(scene)).toEqual({ x: -40, y: -40, width: 680, height: 380 });
    expect(sceneBounds({ nodes: [], edges: [] })).toBeNull();

    const area = viewportArea({ x: -700, y: 0, zoom: 2 }, { width: 400, height: 400 });
    expect(area).toEqual({ x: 350, y: 0, width: 200, height: 200 });
    const cropped = cropScene(scene, area);
    expect(cropped.nodes.map((n) => n.id).sort()).toEqual(["area", "store"]);
    // CRM is outside: its edge is kept as a cut line, but its name is not in the export.
    const { svg } = renderDiagramSvg(cropped, area, "Systemlandschaft");
    expect(svg).toContain('data-id="c1"');
    expect(svg).not.toContain("CRM");
  });

  it("draws the same type icons as the canvas (badge on boxes, white in pool bands)", async () => {
    const scene = buildExportScene(diagram, components, types, connections, connectionTypes);
    const icons = await renderIconMarkup(sceneIcons(scene));
    // "Applikation" → AppWindow, "Datenbank" (datastore) → Database, like resolveComponentIcon in the canvas.
    expect(Object.keys(icons)).toEqual(expect.arrayContaining(["AppWindow", "Database"]));
    const { svg } = renderDiagramSvg(scene, sceneBounds(scene)!, "Systemlandschaft", { icons });
    expect(svg).toContain('stroke="#2563eb" stroke-width="2" stroke-linecap="round"');
    expect(svg).toContain('stroke="#ffffff" stroke-width="2" stroke-linecap="round"');
    expect(svg).not.toContain("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\"");
  });

  it("adds a legend below the diagram with only the types that appear in the export", async () => {
    const scene = buildExportScene(diagram, components, types, connections, connectionTypes);
    const area = sceneBounds(scene)!;
    const icons = await renderIconMarkup(sceneIcons(scene));
    const withLegend = renderDiagramSvg(scene, area, "Systemlandschaft", { icons, legend: true });
    expect(withLegend.width).toBe(area.width);
    expect(withLegend.height).toBeGreaterThan(area.height);
    expect(withLegend).toMatchObject(exportSize(scene, area, true));
    expect(withLegend.svg).toContain('data-legend="true"');
    expect(withLegend.svg).toMatch(/>Legende</);
    const legendPart = withLegend.svg.slice(withLegend.svg.indexOf('data-legend="true"'));
    expect(legendPart).toMatch(/>Applikation</);
    // Relation types are not explained: their name is already written on every line.
    expect(legendPart).not.toMatch(/>nutzt</);

    const withoutLegend = renderDiagramSvg(scene, area, "Systemlandschaft", { icons });
    expect(withoutLegend.height).toBe(area.height);
    expect(withoutLegend.svg).not.toContain("data-legend");

    // Only the visible part: no CRM → no "Applikation" type.
    const cropped = cropScene(scene, { x: 350, y: 0, width: 200, height: 200 });
    expect(legendEntries(cropped).map((n) => n.typeName)).toEqual(["Bereich", "Datenbank"]);
  });

  it("names the file after the diagram and the local date", () => {
    const date = new Date(2026, 10, 11, 23, 30);
    expect(exportFileName("Systemlandschaft", "png", date)).toBe("Systemlandschaft_2026-11-11.png");
    expect(exportFileName("Ist / Soll: Q4?", "svg", date)).toBe("Ist_Soll_Q4_2026-11-11.svg");
    expect(exportFileName("Übersicht Vertrieb", "png", date)).toBe("Übersicht_Vertrieb_2026-11-11.png");
    expect(exportFileName("  ***  ", "png", date)).toBe("Diagramm_2026-11-11.png");
    // Name changed in the dialog: used as is (cleaned), extension follows the format.
    expect(exportFileName("Systemlandschaft", "svg", date, "Folie 3: Vertrieb")).toBe("Folie_3_Vertrieb.svg");
    expect(exportFileName("Systemlandschaft", "png", date, "Entwurf.png")).toBe("Entwurf.png");
    expect(exportFileName("Systemlandschaft", "png", date, "   ")).toBe("Systemlandschaft_2026-11-11.png");
  });

  it("reduces the PNG resolution for huge diagrams instead of producing an empty image", () => {
    expect(clampPngScale({ width: 1000, height: 800 }, 2)).toEqual({ scale: 2, reduced: false });
    const huge = clampPngScale({ width: 10_000, height: 8_000 }, 4);
    expect(huge.reduced).toBe(true);
    expect(10_000 * 8_000 * huge.scale ** 2).toBeLessThanOrEqual(MAX_PNG_PIXELS);
  });

  it("wraps long names and ends cut-off text with an ellipsis", () => {
    expect(wrapText("Kurz", 100, 13, 2)).toEqual(["Kurz"]);
    const lines = wrapText("Sehr langer Komponentenname der nicht in die Box passt", 100, 13, 2, true);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    // Breite 80 px bei 11 px fett ≈ 12 Zeichen pro Zeile.
    expect(wrapText("Element event-start", 80, 11, 3, true)).toEqual(["Element", "event-start"]);
    expect(wrapText("Element event-start", 60, 11, 3, true)).toEqual(["Element", "event-", "start"]);
    expect(wrapText("CRM-Systemlandschaft", 80, 11, 3, true)).toEqual(["CRM-", "Systemlandsc", "haft"]);
    expect(wrapText("Ist - Soll", 200, 11, 1)).toEqual(["Ist - Soll"]);
  });
});
