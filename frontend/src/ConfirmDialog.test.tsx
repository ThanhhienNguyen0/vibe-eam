import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("in-app confirmation popup", () => {
  it("renders title, affected diagrams, notes and a safe cancel action", () => {
    const html = renderToStaticMarkup(<ConfirmDialog
      request={{
        title: "Aus Repository löschen?",
        message: "Die Komponente „CRM“ wird endgültig aus dem Repository gelöscht.",
        items: ["Kontext", "Landschaft"],
        itemsLabel: "Noch verwendet in 2 Diagrammen. Sie verschwindet dort ebenfalls:",
        notes: ["1 zugehörige Verbindung wird mit gelöscht."],
        confirmLabel: "Endgültig löschen",
        tone: "danger"
      }}
      onResolve={() => {}}
    />);
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain("confirm-dialog--danger");
    expect(html).toContain("<li>Kontext</li>");
    expect(html).toContain("<li>Landschaft</li>");
    expect(html).toContain("1 zugehörige Verbindung wird mit gelöscht.");
    expect(html).toContain("Abbrechen");
    expect(html).toContain("Endgültig löschen");
  });

  it("omits the usage box when nothing else uses the element", () => {
    const html = renderToStaticMarkup(<ConfirmDialog request={{ title: "Diagramm löschen?", message: "x", tone: "danger" }} onResolve={() => {}} />);
    expect(html).not.toContain("confirm-dialog-usage");
    expect(html).toContain("Bestätigen");
  });
});
