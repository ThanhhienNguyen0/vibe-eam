import { Position } from "reactflow";
import type { Rect } from "./diagramLayout";

export type Side = "top" | "right" | "bottom" | "left";
const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const POSITION: Record<Side, Position> = { top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left };

/**
 * #127: Seite, an der eine Verbindung den Quell- und den Zielknoten verlässt bzw. erreicht.
 * Liegen die Knoten übereinander (z. B. Capabilities untereinander), wird oben/unten angedockt,
 * sonst links/rechts – so laufen Linien nicht um Knoten herum und überlagern sich weniger.
 * Wird von Editor und Bildexport gemeinsam genutzt, damit beide gleich aussehen.
 */
export function edgeSides(source: Rect, target: Rect): { source: Side; target: Side } {
  const scx = source.x + source.width / 2;
  const scy = source.y + source.height / 2;
  const tcx = target.x + target.width / 2;
  const tcy = target.y + target.height / 2;
  const overlapX = target.x < source.x + source.width && target.x + target.width > source.x;
  const overlapY = target.y < source.y + source.height && target.y + target.height > source.y;
  const vertical = overlapX && !overlapY ? true : overlapY && !overlapX ? false : Math.abs(tcy - scy) > Math.abs(tcx - scx);
  const side: Side = vertical ? (tcy >= scy ? "bottom" : "top") : (tcx >= scx ? "right" : "left");
  return { source: side, target: OPPOSITE[side] };
}

/** Mittelpunkt der jeweiligen Knotenseite – dort sitzen auch die Handles im Editor. */
export function sideAnchor(rect: Rect, side: Side): { x: number; y: number; position: Position } {
  const x = side === "left" ? rect.x : side === "right" ? rect.x + rect.width : rect.x + rect.width / 2;
  const y = side === "top" ? rect.y : side === "bottom" ? rect.y + rect.height : rect.y + rect.height / 2;
  return { x, y, position: POSITION[side] };
}
