import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarList, DonutChart, donutSegments, Heatmap, StatusBar } from "./charts";

const data = [
  { key: "a", label: "Alpha", value: 3, color: "#111111" },
  { key: "b", label: "Beta", value: 1, color: "#222222" },
  { key: "c", label: "Gamma", value: 0, color: "#333333" }
];

describe("donutSegments", () => {
  it("computes fractions and offsets and drops zero values", () => {
    const segments = donutSegments(data);
    expect(segments.map((item) => item.key)).toEqual(["a", "b"]);
    expect(segments[0].fraction).toBeCloseTo(0.75);
    expect(segments[1].offset).toBeCloseTo(0.75);
  });

  it("returns no segments for empty or all-zero data", () => {
    expect(donutSegments([])).toEqual([]);
    expect(donutSegments([{ key: "x", label: "X", value: 0, color: "#000" }])).toEqual([]);
  });
});

describe("chart components", () => {
  it("renders donut total, segments and full legend", () => {
    const html = renderToStaticMarkup(<DonutChart data={data} title="Test-Donut" centerLabel="Typen" />);
    expect(html).toContain(">4<");
    expect(html.match(/data-segment=/g)).toHaveLength(2);
    expect(html).toContain("Gamma");
  });

  it("renders bars relative to the maximum", () => {
    const html = renderToStaticMarkup(<BarList data={data} title="Test-Balken" />);
    expect(html).toContain("width:100%");
    expect(html).toContain("width:33.33");
  });

  it("does not crash on empty data", () => {
    expect(() => renderToStaticMarkup(<DonutChart data={[]} title="Leer" />)).not.toThrow();
    expect(renderToStaticMarkup(<BarList data={[]} title="Leer" emptyText="Nichts da" />)).toContain("Nichts da");
    expect(() => renderToStaticMarkup(<StatusBar data={[]} title="Leer" />)).not.toThrow();
  });

  it("renders heatmap counts per cell", () => {
    const html = renderToStaticMarkup(
      <Heatmap
        title="Matrix"
        rowHeader="Quelle"
        colHeader="Ziel"
        rows={[{ key: "r", label: "Zeile" }]}
        cols={[{ key: "x", label: "X" }, { key: "y", label: "Y" }]}
        value={(_row, col) => (col === "x" ? 5 : 0)}
        onSelect={() => {}}
      />
    );
    expect(html).toContain(">5</button>");
    expect(html).toContain(">·</span>");
  });
});
