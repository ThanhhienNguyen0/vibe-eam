import { analyzeImpact } from "./metamodel";
import type { EamElement, EamModel, ElementType, Risk } from "./types";

export type ImpactLevel = "low" | "medium" | "high";
export type PortfolioCategory =
  | "High Risk / High Impact"
  | "High Cost / Low Impact"
  | "High Impact / Low Cost"
  | "Low Priority"
  | "Standard";

export interface PortfolioEntry {
  element: EamElement;
  impactScore: number;
  impactLevel: ImpactLevel;
  category: PortfolioCategory;
  rationale: string;
  impactedElementIds: string[];
}

export const layerImpactWeights: Record<ElementType, number> = {
  "Business Capability": 5,
  "Business Process": 4,
  "Application Component": 3,
  "Data Object": 2,
  "Technology Node": 1
};

export function getImpactLevel(score: number): ImpactLevel {
  if (score >= 10) return "high";
  if (score >= 4) return "medium";
  return "low";
}

export function getPortfolioCategory(risk: Risk, cost: number, impactLevel: ImpactLevel): PortfolioCategory {
  if (risk === "high" && impactLevel === "high") return "High Risk / High Impact";
  if (cost >= 180000 && (impactLevel === "low" || impactLevel === "medium")) return "High Cost / Low Impact";
  if (impactLevel === "high" && cost < 100000) return "High Impact / Low Cost";
  if (risk === "low" && cost < 100000 && impactLevel === "low") return "Low Priority";
  return "Standard";
}

export function getRiskBubbleSize(risk: Risk): number {
  if (risk === "high") return 56;
  if (risk === "medium") return 40;
  return 26;
}

export function normalizePortfolioPoint(
  cost: number,
  impactScore: number,
  maxCost: number,
  maxImpact: number,
  paddingPercent = 8
): { xPercent: number; yPercent: number } {
  const usable = 100 - paddingPercent * 2;
  const normalizedCost = maxCost > 0 ? cost / maxCost : 0.5;
  const normalizedImpact = maxImpact > 0 ? impactScore / maxImpact : 0.5;

  return {
    xPercent: paddingPercent + Math.min(1, Math.max(0, normalizedCost)) * usable,
    yPercent: paddingPercent + Math.min(1, Math.max(0, normalizedImpact)) * usable
  };
}

export function calculateImpactScore(model: EamModel, elementId: string): number {
  return analyzeImpact(model, elementId, "downstream").reduce((score, result) => {
    const impactedElement = model.elements.find((element) => element.id === result.elementId);
    return score + (impactedElement ? layerImpactWeights[impactedElement.type] : 0);
  }, 0);
}

export function buildPortfolioEntry(model: EamModel, element: EamElement): PortfolioEntry {
  const downstreamImpact = analyzeImpact(model, element.id, "downstream");
  const impactedElementIds = downstreamImpact.map((result) => result.elementId);
  const impactScore = impactedElementIds.reduce((score, impactedId) => {
    const impactedElement = model.elements.find((candidate) => candidate.id === impactedId);
    return score + (impactedElement ? layerImpactWeights[impactedElement.type] : 0);
  }, 0);
  const impactLevel = getImpactLevel(impactScore);
  const category = getPortfolioCategory(element.risk, element.cost, impactLevel);
  const rationale = `Risk ${element.risk}, cost ${element.cost}, downstream impact ${impactScore} (${impactLevel}).`;

  return {
    element,
    impactScore,
    impactLevel,
    category,
    rationale,
    impactedElementIds
  };
}

export function buildPortfolio(model: EamModel): PortfolioEntry[] {
  return model.elements.map((element) => buildPortfolioEntry(model, element));
}
