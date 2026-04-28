import { describe, expect, it } from "vitest";
import {
  buildPortfolioEntry,
  calculateImpactScore,
  getImpactLevel,
  getPortfolioCategory,
  getRiskBubbleSize,
  normalizePortfolioPoint
} from "./portfolio.js";
import type { EamElement, EamModel } from "./types.js";

function element(id: string, type: EamElement["type"], risk: EamElement["risk"] = "medium", cost = 0): EamElement {
  const layer = type === "Application Component" ? "Application" : type === "Data Object" ? "Data" : type === "Technology Node" ? "Technology" : "Business";
  return {
    id,
    name: id,
    type,
    layer,
    description: "",
    risk,
    cost,
    status: "active",
    startDate: "2026-01-01",
    endOfLifeDate: "2030-01-01",
    customAttributes: {},
    position: { x: 0, y: 0 }
  };
}

const model: EamModel = {
  elements: [
    element("cap", "Business Capability"),
    element("process", "Business Process"),
    element("app", "Application Component", "high", 90000),
    element("data", "Data Object"),
    element("tech", "Technology Node"),
    element("runtime", "Technology Node")
  ],
  relations: [
    { id: "r1", source: "process", target: "cap", type: "realizes", description: "" },
    { id: "r2", source: "app", target: "process", type: "serves", description: "" },
    { id: "r3", source: "app", target: "data", type: "uses", description: "" },
    { id: "r4", source: "data", target: "tech", type: "depends_on", description: "" },
    { id: "r5", source: "app", target: "tech", type: "depends_on", description: "" },
    { id: "r6", source: "tech", target: "runtime", type: "depends_on", description: "" }
  ]
};

describe("portfolio scoring", () => {
  it("calculates weighted downstream impact score", () => {
    expect(calculateImpactScore(model, "tech")).toBe(14);
  });

  it("maps impact scores to levels", () => {
    expect(getImpactLevel(3)).toBe("low");
    expect(getImpactLevel(4)).toBe("medium");
    expect(getImpactLevel(10)).toBe("high");
  });

  it("assigns portfolio categories", () => {
    expect(getPortfolioCategory("high", 90000, "high")).toBe("High Risk / High Impact");
    expect(getPortfolioCategory("medium", 180000, "medium")).toBe("High Cost / Low Impact");
    expect(getPortfolioCategory("medium", 90000, "high")).toBe("High Impact / Low Cost");
    expect(getPortfolioCategory("low", 90000, "low")).toBe("Low Priority");
  });

  it("deduplicates impacted elements reached through multiple paths", () => {
    const entry = buildPortfolioEntry(model, model.elements.find((item) => item.id === "tech")!);
    expect(entry.impactScore).toBe(14);
    expect(entry.impactLevel).toBe("high");
  });

  it("normalizes portfolio points with padding and zero guards", () => {
    expect(normalizePortfolioPoint(50, 5, 100, 10)).toEqual({ xPercent: 50, yPercent: 50 });
    expect(normalizePortfolioPoint(0, 0, 0, 0)).toEqual({ xPercent: 50, yPercent: 50 });
  });

  it("maps risk to visible bubble sizes", () => {
    expect(getRiskBubbleSize("low")).toBeLessThan(getRiskBubbleSize("medium"));
    expect(getRiskBubbleSize("medium")).toBeLessThan(getRiskBubbleSize("high"));
  });
});
