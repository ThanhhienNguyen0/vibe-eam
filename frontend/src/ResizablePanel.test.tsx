import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ResizablePanel, { clampWidth } from "./ResizablePanel";

describe("ResizablePanel", () => {
  it("clamps widths into the allowed range", () => {
    expect(clampWidth(100, 200, 500)).toBe(200);
    expect(clampWidth(900, 200, 500)).toBe(500);
    expect(clampWidth(320.4, 200, 500)).toBe(320);
    expect(clampWidth(Number.NaN, 200, 500)).toBe(200);
  });

  it("renders the content with an accessible resize handle", () => {
    const html = renderToStaticMarkup(
      <ResizablePanel side="right" storageKey="test-width" defaultWidth={380} minWidth={280} maxWidth={720} label="Eigenschaften">
        <p>Inhalt</p>
      </ResizablePanel>
    );
    expect(html).toContain("Inhalt");
    expect(html).toContain('role="separator"');
    expect(html).toContain("--panel-width:380px");
    expect(html).toContain("panel-resizable--right");
  });
});
