import { describe, expect, it } from "vitest";
import { checkElementName, isPlaceholderName } from "./nameRules.js";

describe("#108/#113 name rule for components and diagrams", () => {
  it("rejects missing, empty and whitespace-only names, even when confirmed", () => {
    for (const value of [undefined, null, 42, "", "   ", "\t\n"]) {
      expect(checkElementName(value)).toEqual(expect.objectContaining({ code: "NAME_REQUIRED", field: "name" }));
      expect(checkElementName(value, { acknowledgePlaceholder: true })).toEqual(expect.objectContaining({ code: "NAME_REQUIRED" }));
    }
  });

  it("recognizes the generated placeholders including numbered variants", () => {
    for (const value of ["Neue Komponente", " neue  komponente ", "Neue Komponente 2", "Neues Diagramm", "NEUES DIAGRAMM (3)"]) {
      expect(isPlaceholderName(value)).toBe(true);
    }
    expect(isPlaceholderName("Neue Komponentenbibliothek")).toBe(false);
    expect(isPlaceholderName("Diagramm Vertrieb")).toBe(false);
  });

  it("requires an explicit confirmation for a placeholder and stores it trimmed afterwards", () => {
    expect(checkElementName("Neue Komponente")).toEqual({
      code: "NAME_PLACEHOLDER",
      field: "name",
      error: "„Neue Komponente“ ist ein Platzhaltername. Bitte einen aussagekräftigen Namen eingeben oder den Platzhalter ausdrücklich bestätigen."
    });
    expect(checkElementName(" Neue Komponente 2 ", { acknowledgePlaceholder: true })).toEqual({ name: "Neue Komponente 2" });
  });

  it("strips only a real trailing number when recognizing placeholders", () => {
    expect(isPlaceholderName("Neue Komponente(12")).toBe(true);
    expect(isPlaceholderName("Neue Komponente 12)")).toBe(true);
    expect(isPlaceholderName("Neue Komponente)")).toBe(false);
    expect(isPlaceholderName("Neue Komponente ()")).toBe(false);
    expect(isPlaceholderName("Neue Komponente 1 2 x")).toBe(false);
  });

  it("stays linear on long digit runs (CodeQL js/polynomial-redos)", () => {
    // The former regex /\(?\d+\)?$/ needed about 0.35 s for 20 000 digits and grew quadratically.
    const hostile = `${"9".repeat(200_000)}x`;
    const started = performance.now();
    expect(isPlaceholderName(hostile)).toBe(false);
    expect(checkElementName(hostile)).toEqual({ name: hostile });
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("accepts real names and returns them trimmed", () => {
    expect(checkElementName("  SAP S/4HANA  ")).toEqual({ name: "SAP S/4HANA" });
  });

  it("needs no new confirmation for an unchanged legacy placeholder, but for a rename to one", () => {
    expect(checkElementName("Neue Komponente", { previousName: "Neue Komponente" })).toEqual({ name: "Neue Komponente" });
    expect(checkElementName("Neue Komponente 2", { previousName: "CRM" })).toEqual(expect.objectContaining({ code: "NAME_PLACEHOLDER" }));
    expect(checkElementName("Neue Komponente 2", { previousName: "CRM", acknowledgePlaceholder: true })).toEqual({ name: "Neue Komponente 2" });
  });
});
