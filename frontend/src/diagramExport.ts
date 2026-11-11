/**
 * REQ-11 – Diagramm-Export als PNG und SVG.
 *
 * Die Knoten im Canvas sind HTML-Elemente. Ein Screenshot des DOM würde Beschriftungen als
 * <foreignObject> bzw. Pixel enthalten, die in PowerPoint, Word oder Inkscape nicht als Text
 * erscheinen. Deshalb wird hier aus den Diagrammdaten ein eigenständiges SVG mit echten
 * <text>-Elementen erzeugt. Das PNG entsteht aus genau diesem SVG – beide Formate sehen gleich aus.
 *
 * Typ-Icons sind dieselben Lucide-Icons wie im Canvas (`resolveComponentIcon`); ihr SVG-Markup wird
 * erst beim Export erzeugt (`renderIconMarkup`, lädt react-dom/server nach), damit der App-Start
 * nicht schwerer wird.
 *
 * Alles bis auf `svgToPngBlob`/`downloadBlob` ist rein (ohne DOM) und daher direkt testbar.
 */
import { createElement } from "react";
import type { LucideIcon } from "lucide-react";
import { Position, getBezierPath } from "reactflow";
import { resolveComponentIcon } from "./componentIcons";
import { boundsOf, fallbackPosition, shapeDefaultSize, type Rect } from "./diagramLayout";
import type {
  ComponentInstance,
  ComponentShape,
  ComponentType,
  ConnectionInstance,
  ConnectionType,
  Diagram
} from "./Sidebar/sidebarTypes";

export type ExportFormat = "png" | "svg";
export type ExportArea = "all" | "viewport";

export interface ExportNode extends Rect {
  id: string;
  name: string;
  typeId: string;
  typeName: string;
  color: string;
  shape: ComponentShape;
  /** Dasselbe Typ-Icon wie im Canvas. */
  icon: LucideIcon;
}

export interface ExportEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  typeId: string;
  typeName: string;
  color: string;
  dash?: string;
}

/** Icon-Name (`displayName`) → inneres SVG-Markup (Pfade im 24er-Raster). */
export type IconMarkup = Record<string, string>;

export interface RenderOptions {
  icons?: IconMarkup;
  legend?: boolean;
}

export interface ExportScene {
  nodes: ExportNode[];
  edges: ExportEdge[];
  /** Nur zum Verankern angeschnittener Kanten; diese Knoten werden nicht gezeichnet. */
  anchors?: ExportNode[];
}

/** Auswahl im Export-Dialog für die PNG-Auflösung. */
export const PNG_SCALES = [1, 2, 4] as const;
export const DEFAULT_PNG_SCALE = 2;

/** Rand um das Gesamtdiagramm, damit Kanten-Beschriftungen nicht abgeschnitten werden. */
export const EXPORT_PADDING = 40;

/**
 * Sicheres Pixel-Limit für ein Canvas. Browser brechen bei sehr großen Canvas-Flächen still ab
 * (leeres Bild); darüber wird die Auflösung automatisch reduziert.
 */
export const MAX_PNG_PIXELS = 32_000_000;
export const MAX_PNG_SIDE = 16_000;

const FONT_FAMILY = "Inter, 'Segoe UI', system-ui, -apple-system, Arial, sans-serif";
const TEXT_COLOR = "#172033";
const MUTED_COLOR = "#64748b";
const DEFAULT_NODE_COLOR = "#cbd5e1";
const DEFAULT_EDGE_COLOR = "#475569";
const LINE_DASH: Record<string, string | undefined> = { solid: undefined, dashed: "6 3", dotted: "2 3" };

/* ── Szene aus den Diagrammdaten ─────────────────────────────────────────────── */

/**
 * Baut die Export-Szene nach denselben Regeln wie der Canvas (Positionen, Standardgrößen,
 * nur Kanten zwischen sichtbaren Knoten). `diagram` ist das bereits gefilterte Diagramm, damit
 * ein aktiver Ansichtsfilter (Viewpoint) automatisch berücksichtigt wird.
 */
export function buildExportScene(
  diagram: Diagram,
  components: ComponentInstance[],
  componentTypes: ComponentType[],
  connections: ConnectionInstance[],
  connectionTypes: ConnectionType[]
): ExportScene {
  const nodes = diagram.componentIds.flatMap((id, index): ExportNode[] => {
    const comp = components.find((c) => c.id === id);
    if (!comp) return [];
    const type = componentTypes.find((t) => t.id === comp.componentTypeId);
    const shape = type?.shape ?? "box";
    const pos = diagram.positions[id] ?? fallbackPosition(Math.max(index, 0));
    const defaults = shapeDefaultSize(shape);
    return [{
      id,
      name: comp.name,
      typeId: comp.componentTypeId,
      typeName: type?.name ?? "?",
      color: type?.color ?? DEFAULT_NODE_COLOR,
      shape,
      icon: resolveComponentIcon(type?.icon, type?.name, shape),
      x: pos.x,
      y: pos.y,
      width: pos.width ?? defaults.width,
      height: pos.height ?? defaults.height
    }];
  });
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = diagram.connectionIds.flatMap((id): ExportEdge[] => {
    const conn = connections.find((c) => c.id === id);
    if (!conn || !nodeIds.has(conn.sourceComponentId) || !nodeIds.has(conn.targetComponentId)) return [];
    const type = connectionTypes.find((t) => t.id === conn.connectionTypeId);
    return [{
      id,
      sourceId: conn.sourceComponentId,
      targetId: conn.targetComponentId,
      label: conn.name || type?.name || "",
      typeId: conn.connectionTypeId,
      typeName: type?.name ?? "?",
      color: type?.color ?? DEFAULT_EDGE_COLOR,
      dash: LINE_DASH[type?.lineStyle ?? "solid"]
    }];
  });
  return { nodes, edges };
}

/** Bereich des Gesamtdiagramms inkl. Rand, oder null bei leerem Diagramm. */
export function sceneBounds(scene: ExportScene, padding = EXPORT_PADDING): Rect | null {
  const bounds = boundsOf(scene.nodes);
  if (!bounds) return null;
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2
  };
}

/** Nur Knoten, die den Bereich berühren, und Kanten, die an einem davon hängen. */
export function cropScene(scene: ExportScene, area: Rect): ExportScene {
  const nodes = scene.nodes.filter((n) =>
    n.x < area.x + area.width && n.x + n.width > area.x && n.y < area.y + area.height && n.y + n.height > area.y);
  const kept = new Set(nodes.map((n) => n.id));
  // Kanten zu Knoten außerhalb bleiben als angeschnittene Linien erhalten (wie im Canvas). Die
  // Partnerknoten dienen nur als Anker und erscheinen weder als Form noch als Text im Export.
  const edges = scene.edges.filter((e) => kept.has(e.sourceId) || kept.has(e.targetId));
  const partnerIds = new Set(edges.flatMap((e) => [e.sourceId, e.targetId]).filter((id) => !kept.has(id)));
  const anchors = scene.nodes.filter((n) => partnerIds.has(n.id));
  return { nodes, edges, anchors };
}

/** Sichtbarer Canvas-Ausschnitt in Diagramm-Koordinaten. */
export function viewportArea(viewport: { x: number; y: number; zoom: number }, size: { width: number; height: number }): Rect {
  const zoom = viewport.zoom || 1;
  // `0 - …` statt unärem Minus, damit kein -0 entsteht.
  return { x: 0 - viewport.x / zoom, y: 0 - viewport.y / zoom, width: size.width / zoom, height: size.height / zoom };
}

/* ── Dateiname ───────────────────────────────────────────────────────────────── */

/** Lokales Datum als YYYY-MM-DD (nicht UTC – sonst kurz nach Mitternacht der falsche Tag). */
export function localDateStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Macht aus beliebigem Text einen gültigen Dateinamen (ohne Endung); leer, wenn nichts übrig bleibt. */
export function sanitizeFileBase(name: string): string {
  return name
    .replace(/\.(png|svg)$/i, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.]+|[_.]+$/g, "")
    .slice(0, 120);
}

/** Vorschlag ohne Endung: „Systemlandschaft 2026“ → „Systemlandschaft_2026_2026-11-11“. */
export function defaultFileBase(diagramName: string, date: Date = new Date()): string {
  return `${sanitizeFileBase(diagramName).slice(0, 80) || "Diagramm"}_${localDateStamp(date)}`;
}

/**
 * Endgültiger Dateiname. `customBase` ist der im Dialog geänderte Name; ist er leer oder ungültig,
 * gilt der Vorschlag aus Diagrammname und Datum.
 */
export function exportFileName(diagramName: string, format: ExportFormat, date: Date = new Date(), customBase?: string): string {
  const base = (customBase !== undefined && sanitizeFileBase(customBase)) || defaultFileBase(diagramName, date);
  return `${base}.${format}`;
}

/* ── PNG-Größe ───────────────────────────────────────────────────────────────── */

/** Reduziert den Skalierungsfaktor, falls das Bild die Canvas-Grenzen der Browser sprengen würde. */
export function clampPngScale(area: { width: number; height: number }, requested: number): { scale: number; reduced: boolean } {
  const bySide = MAX_PNG_SIDE / Math.max(area.width, area.height, 1);
  const byArea = Math.sqrt(MAX_PNG_PIXELS / Math.max(area.width * area.height, 1));
  const max = Math.min(bySide, byArea);
  if (requested <= max) return { scale: requested, reduced: false };
  return { scale: Math.max(Math.floor(max * 100) / 100, 0.1), reduced: true };
}

/* ── SVG-Erzeugung ───────────────────────────────────────────────────────────── */

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Grobe Textbreite ohne DOM-Messung (Inter/Segoe ≈ 0,56 em, fett ≈ 0,6 em). */
function textWidth(text: string, fontSize: number, bold = false): number {
  return text.length * fontSize * (bold ? 0.6 : 0.56);
}

/**
 * Bricht Text in Zeilen um, die in `maxWidth` passen. Zu lange Texte enden mit „…“, damit nichts
 * über die Form hinausragt – der vollständige Name bleibt im <title> des Knotens erhalten.
 */
export function wrapText(text: string, maxWidth: number, fontSize: number, maxLines: number, bold = false): string[] {
  const maxChars = Math.max(Math.floor(maxWidth / (fontSize * (bold ? 0.6 : 0.56))), 1);
  // Bindestrich-Wörter („CRM-System“) dürfen nach dem Bindestrich umbrechen statt mitten im Wort.
  const words = [...text.trim().matchAll(/(\s*)([^\s-]+-*|-+)/g)].map((m) => ({ word: m[2], spaced: m[1].length > 0 }));
  const lines: string[] = [];
  let current = "";
  for (const { word, spaced } of words) {
    const candidate = !current ? word : `${current}${spaced ? " " : ""}${word}`;
    if (candidate.length <= maxChars) { current = candidate; continue; }
    if (current) lines.push(current);
    current = word;
    while (current.length > maxChars) { lines.push(current.slice(0, maxChars)); current = current.slice(maxChars); }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  const last = visible[maxLines - 1];
  visible[maxLines - 1] = `${last.slice(0, Math.max(maxChars - 1, 1)).trimEnd()}…`;
  return visible;
}

function truncate(text: string, maxWidth: number, fontSize: number, bold = false): string {
  return wrapText(text, maxWidth, fontSize, 1, bold)[0] ?? "";
}

const num = (value: number) => String(Math.round(value * 100) / 100);

interface TextOptions {
  x: number;
  y: number;
  size: number;
  anchor?: "start" | "middle";
  bold?: boolean;
  color?: string;
  transform?: string;
}

function textLines(lines: string[], { x, y, size, anchor = "start", bold, color = TEXT_COLOR, transform }: TextOptions): string {
  if (lines.length === 0) return "";
  const lineHeight = size * 1.25;
  const tspans = lines
    .map((line, i) => `<tspan x="${num(x)}" dy="${i === 0 ? 0 : num(lineHeight)}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<text x="${num(x)}" y="${num(y)}" font-size="${size}"${bold ? ' font-weight="700"' : ""} fill="${color}" text-anchor="${anchor}" dominant-baseline="middle"${transform ? ` transform="${transform}"` : ""}>${tspans}</text>`;
}

/** Name (fett) + Typ (grau) als Block, vertikal um `centerY` zentriert. */
function labelBlock(node: ExportNode, centerX: number, centerY: number, maxWidth: number, anchor: "start" | "middle", nameSize = 13, maxNameLines = 2): string {
  const nameLines = wrapText(node.name, maxWidth, nameSize, maxNameLines, true);
  const typeSize = 11;
  const nameHeight = nameLines.length * nameSize * 1.25;
  const total = nameHeight + 3 + typeSize * 1.25;
  const top = centerY - total / 2;
  return textLines(nameLines, { x: centerX, y: top + nameSize * 0.625, size: nameSize, anchor, bold: true })
    + textLines([truncate(node.typeName, maxWidth, typeSize)], { x: centerX, y: top + nameHeight + 3 + typeSize * 0.625, size: typeSize, anchor, color: MUTED_COLOR });
}

/* ── Icons ───────────────────────────────────────────────────────────────────── */

export function iconId(icon: LucideIcon): string {
  return icon.displayName ?? "Box";
}

/**
 * Erzeugt das SVG-Markup aller benötigten Lucide-Icons. react-dom/server wird erst hier
 * nachgeladen, also nur wenn jemand tatsächlich exportiert.
 */
export async function renderIconMarkup(icons: LucideIcon[]): Promise<IconMarkup> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const result: IconMarkup = {};
  for (const icon of icons) {
    const id = iconId(icon);
    if (result[id]) continue;
    const markup = renderToStaticMarkup(createElement(icon, { size: 24 }));
    // Nur die inneren Pfade behalten; Farbe, Größe und Position setzt `iconSvg`.
    result[id] = markup.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  }
  return result;
}

/** Alle Icons, die für Knoten und Legende einer Szene gebraucht werden. */
export function sceneIcons(scene: ExportScene): LucideIcon[] {
  return [...new Map(scene.nodes.map((n) => [iconId(n.icon), n.icon])).values()];
}

/** Lucide-Icon (24er-Raster) an Position x/y in Größe `size` und Farbe `color`. */
function iconSvg(icons: IconMarkup | undefined, icon: LucideIcon, x: number, y: number, size: number, color: string): string {
  const inner = icons?.[iconId(icon)];
  if (!inner) return "";
  return `<g transform="translate(${num(x)} ${num(y)}) scale(${num(size / 24)})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" aria-hidden="true">${inner}</g>`;
}

/** Formen, die im Canvas oben rechts ein Typ-Icon tragen. */
const SHAPES_WITH_BADGE = new Set<ComponentShape>(["box", "process", "datastore"]);
const BADGE_SIZE = 14;

function renderNode(node: ExportNode, icons?: IconMarkup): string {
  const { x, y, width: w, height: h, color } = node;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const title = `<title>${escapeXml(`${node.name} (${node.typeName})`)}</title>`;
  // Wie im Canvas: Badge 4 px von oben, 6 px von rechts innerhalb des 2-px-Rahmens.
  const badge = SHAPES_WITH_BADGE.has(node.shape) ? iconSvg(icons, node.icon, x + w - 2 - 6 - BADGE_SIZE, y + 2 + 4, BADGE_SIZE, color) : "";
  const open = `<g data-id="${escapeXml(node.id)}">${title}`;
  const close = `${badge}</g>`;

  switch (node.shape) {
    case "pool": {
      const band = 30;
      return `${open}<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="8" fill="#f8fafc" fill-opacity="0.72" stroke="${color}" stroke-width="2"/>`
        + `<path d="M${num(x + 8)} ${num(y)} H${num(x + band)} V${num(y + h)} H${num(x + 8)} A8 8 0 0 1 ${num(x)} ${num(y + h - 8)} V${num(y + 8)} A8 8 0 0 1 ${num(x + 8)} ${num(y)} Z" fill="${color}"/>`
        + iconSvg(icons, node.icon, x + band / 2 - BADGE_SIZE / 2, y + 8, BADGE_SIZE, "#ffffff")
        + textLines([truncate(node.name, h * 0.9 - 40, 13, true)], { x: x + band / 2, y: cy, size: 13, anchor: "middle", bold: true, color: "#ffffff", transform: `rotate(-90 ${num(x + band / 2)} ${num(cy)})` })
        + textLines([truncate(node.typeName, w - band - 20, 11)], { x: x + band + 10, y: y + 16, size: 11, color: "#94a3b8" })
        + "</g>";
    }
    case "event":
    case "event-start":
    case "event-end": {
      const r = Math.max(Math.min(w - 8, h - 24) / 2, 8);
      const ccy = y + 4 + r;
      const strokeWidth = node.shape === "event-start" ? 2 : node.shape === "event-end" ? 5 : 3;
      const inner = node.shape === "event"
        ? `<circle cx="${num(cx)}" cy="${num(ccy)}" r="${num(Math.max(r - 4.5, 1))}" fill="none" stroke="${color}" stroke-width="1.5"/>`
        : "";
      const nameLines = wrapText(node.name, r * 1.5, 11, 3, true);
      const nameTop = ccy - ((nameLines.length - 1) * 11 * 1.25) / 2;
      return `${open}<circle cx="${num(cx)}" cy="${num(ccy)}" r="${num(r)}" fill="#ffffff" stroke="${color}" stroke-width="${strokeWidth}"/>${inner}`
        + textLines(nameLines, { x: cx, y: nameTop, size: 11, anchor: "middle", bold: true })
        + textLines([truncate(node.typeName, w, 11)], { x: cx, y: ccy + r + 10, size: 11, anchor: "middle", color: MUTED_COLOR })
        + "</g>";
    }
    case "gateway":
    case "gateway-xor":
    case "gateway-and":
    case "gateway-or": {
      const labelSpace = 34;
      const size = Math.max(Math.min(w * 0.7, h - labelSpace - 6), 12);
      const dcy = y + 6 + size / 2;
      const marker = node.shape === "gateway-xor" ? "✕" : node.shape === "gateway-and" ? "+" : node.shape === "gateway-or" ? "○" : "";
      const nameLine = truncate(node.name, w, 12, true);
      return `${open}<polygon points="${num(cx)},${num(dcy - size / 2)} ${num(cx + size / 2)},${num(dcy)} ${num(cx)},${num(dcy + size / 2)} ${num(cx - size / 2)},${num(dcy)}" fill="#ffffff" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`
        + (marker ? textLines([marker], { x: cx, y: dcy, size: Math.min(26, size * 0.45), anchor: "middle", bold: true, color }) : "")
        + textLines([nameLine], { x: cx, y: dcy + size / 2 + 12, size: 12, anchor: "middle", bold: true })
        + textLines([truncate(node.typeName, w, 11)], { x: cx, y: dcy + size / 2 + 27, size: 11, anchor: "middle", color: MUTED_COLOR })
        + "</g>";
    }
    case "datastore": {
      const capH = 16;
      return `${open}<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="12" fill="#ffffff" stroke="${color}" stroke-width="2"/>`
        + `<ellipse cx="${num(cx)}" cy="${num(y + capH / 2)}" rx="${num(w / 2)}" ry="${num(capH / 2)}" fill="#f8fafc" stroke="${color}" stroke-width="2"/>`
        + labelBlock(node, cx, y + capH + (h - capH) / 2, w - 28, "middle")
        + close;
    }
    case "process":
      return `${open}<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="14" fill="#ffffff" stroke="${color}" stroke-width="2"/>`
        + labelBlock(node, cx, cy, w - 32, "middle")
        + close;
    default: {
      // Standard-Rechteck mit farbigem Streifen links (wie im Canvas).
      const stripe = 8;
      return `${open}<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="8" fill="#ffffff" stroke="${color}" stroke-width="2"/>`
        + `<path d="M${num(x + 8)} ${num(y)} H${num(x + stripe)} V${num(y + h)} H${num(x + 8)} A8 8 0 0 1 ${num(x)} ${num(y + h - 8)} V${num(y + 8)} A8 8 0 0 1 ${num(x + 8)} ${num(y)} Z" fill="${color}"/>`
        // Rechts Platz für das Typ-Icon lassen, damit lange Namen nicht darunter laufen.
        + labelBlock(node, x + stripe + 12, cy, w - stripe - 24 - BADGE_SIZE, "start")
        + close;
    }
  }
}

function markerId(color: string): string {
  return `arrow-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
}

function renderEdge(edge: ExportEdge, nodes: Map<string, ExportNode>): string {
  const source = nodes.get(edge.sourceId);
  const target = nodes.get(edge.targetId);
  if (!source || !target) return "";
  // Gleiche Anker wie im Canvas: Ausgang rechts, Eingang links, jeweils mittig.
  const [path, labelX, labelY] = getBezierPath({
    sourceX: source.x + source.width,
    sourceY: source.y + source.height / 2,
    sourcePosition: Position.Right,
    targetX: target.x,
    targetY: target.y + target.height / 2,
    targetPosition: Position.Left
  });
  const line = `<path d="${path}" fill="none" stroke="${edge.color}" stroke-width="2"${edge.dash ? ` stroke-dasharray="${edge.dash}"` : ""} marker-end="url(#${markerId(edge.color)})"/>`;
  if (!edge.label) return `<g data-id="${escapeXml(edge.id)}">${line}</g>`;
  const label = truncate(edge.label, 220, 11, true);
  const boxW = textWidth(label, 11, true) + 12;
  const boxH = 11 * 1.25 + 6;
  return `<g data-id="${escapeXml(edge.id)}">${line}`
    + `<rect x="${num(labelX - boxW / 2)}" y="${num(labelY - boxH / 2)}" width="${num(boxW)}" height="${num(boxH)}" rx="4" fill="#ffffff" fill-opacity="0.9"/>`
    + textLines([label], { x: labelX, y: labelY, size: 11, anchor: "middle", bold: true })
    + "</g>";
}

/* ── Legende ─────────────────────────────────────────────────────────────────── */

const LEGEND = { pad: 16, titleHeight: 26, rowHeight: 24, itemWidth: 210 };
const collator = new Intl.Collator("de", { sensitivity: "base" });

/**
 * Ein Eintrag je Elementtyp, der im Export tatsächlich vorkommt – bei einem Ausschnitt oder
 * aktivem Filter also nur die sichtbaren Typen. Beziehungstypen braucht die Legende nicht: ihr
 * Name steht ohnehin als Beschriftung an jeder Linie.
 */
export function legendEntries(scene: ExportScene): ExportNode[] {
  return [...new Map(scene.nodes.map((n) => [n.typeId, n])).values()]
    .sort((a, b) => collator.compare(a.typeName, b.typeName));
}

function legendColumns(width: number): number {
  return Math.max(Math.floor((width - LEGEND.pad * 2) / LEGEND.itemWidth), 1);
}

/** Höhe der Legende bei gegebener Breite; 0, wenn es nichts zu erklären gibt. */
export function legendHeight(scene: ExportScene, width: number): number {
  const count = legendEntries(scene).length;
  if (count === 0) return 0;
  return LEGEND.pad * 2 + LEGEND.titleHeight + Math.ceil(count / legendColumns(width)) * LEGEND.rowHeight;
}

/** Endgröße des exportierten Bildes (Diagrammbereich plus ggf. Legende darunter). */
export function exportSize(scene: ExportScene, area: Rect, legend: boolean): { width: number; height: number } {
  if (!legend) return { width: area.width, height: area.height };
  const width = Math.max(area.width, LEGEND.itemWidth + LEGEND.pad * 2);
  return { width, height: area.height + legendHeight(scene, width) };
}

/** Kleine Form in Typfarbe, damit man den Legendeneintrag der Form im Diagramm zuordnen kann. */
function legendGlyph(node: ExportNode, x: number, cy: number): string {
  const s = 16;
  const y = cy - s / 2;
  const stroke = `fill="#ffffff" stroke="${node.color}" stroke-width="2"`;
  if (node.shape.startsWith("event")) return `<circle cx="${num(x + s / 2)}" cy="${num(cy)}" r="${num(s / 2 - 1)}" ${stroke}/>`;
  if (node.shape.startsWith("gateway")) return `<polygon points="${num(x + s / 2)},${num(y)} ${num(x + s)},${num(cy)} ${num(x + s / 2)},${num(y + s)} ${num(x)},${num(cy)}" ${stroke} stroke-linejoin="round"/>`;
  const radius = node.shape === "process" ? 5 : 3;
  const stripe = node.shape === "box" || node.shape === "pool"
    ? `<rect x="${num(x)}" y="${num(y)}" width="4" height="${s}" rx="1.5" fill="${node.color}"/>`
    : "";
  return `<rect x="${num(x)}" y="${num(y)}" width="${s}" height="${s}" rx="${radius}" ${stroke}/>${stripe}`;
}

function renderLegend(scene: ExportScene, x: number, y: number, width: number, height: number, icons?: IconMarkup): string {
  const elements = legendEntries(scene);
  if (elements.length === 0) return "";
  const columns = legendColumns(width);
  const top = y + LEGEND.pad + LEGEND.titleHeight;
  const items = elements.map((node, i) => {
    const ix = x + LEGEND.pad + (i % columns) * LEGEND.itemWidth;
    const cy = top + Math.floor(i / columns) * LEGEND.rowHeight + LEGEND.rowHeight / 2;
    const hasIcon = SHAPES_WITH_BADGE.has(node.shape) || node.shape === "pool";
    const textX = ix + (hasIcon ? 42 : 24);
    return legendGlyph(node, ix, cy)
      + (hasIcon ? iconSvg(icons, node.icon, ix + 22, cy - 7, 14, node.color) : "")
      + textLines([truncate(node.typeName, LEGEND.itemWidth - (textX - ix) - 8, 12)], { x: textX, y: cy, size: 12 });
  });
  return [
    `<g data-legend="true">`,
    `<rect x="${num(x)}" y="${num(y)}" width="${num(width)}" height="${num(height)}" fill="#f8fafc"/>`,
    `<line x1="${num(x)}" y1="${num(y)}" x2="${num(x + width)}" y2="${num(y)}" stroke="#e2e8f0" stroke-width="1"/>`,
    textLines(["Legende"], { x: x + LEGEND.pad, y: y + LEGEND.pad + 8, size: 13, bold: true }),
    ...items,
    "</g>"
  ].join("");
}

/* ── Gesamtes SVG ────────────────────────────────────────────────────────────── */

/**
 * Erzeugt ein eigenständiges SVG-Dokument für den Bereich `area` (Diagramm-Koordinaten),
 * optional mit Legende darunter. Alle Beschriftungen sind echte <text>-Elemente und damit
 * durchsuchbar und kopierbar.
 */
export function renderDiagramSvg(scene: ExportScene, area: Rect, title: string, options: RenderOptions = {}): { svg: string; width: number; height: number } {
  const { icons, legend = false } = options;
  const { width, height } = exportSize(scene, area, legend);
  const nodeMap = new Map([...(scene.anchors ?? []), ...scene.nodes].map((n) => [n.id, n]));
  // Pools liegen wie im Canvas hinter allen anderen Elementen.
  const pools = scene.nodes.filter((n) => n.shape === "pool");
  const others = scene.nodes.filter((n) => n.shape !== "pool");
  const colors = [...new Set(scene.edges.map((e) => e.color))];
  const markers = colors
    .map((color) => `<marker id="${markerId(color)}" viewBox="-10 -10 20 20" markerWidth="12.5" markerHeight="12.5" markerUnits="strokeWidth" orient="auto-start-reverse" refX="0" refY="0"><polyline points="-5,-4 0,0 -5,4 -5,-4" fill="${color}" stroke="${color}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></marker>`)
    .join("");
  const areaRect = `x="${num(area.x)}" y="${num(area.y)}" width="${num(area.width)}" height="${num(area.height)}"`;
  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}" height="${num(height)}" viewBox="${num(area.x)} ${num(area.y)} ${num(width)} ${num(height)}" font-family="${FONT_FAMILY}">`,
    `<title>${escapeXml(title)}</title>`,
    // Der Diagrammteil wird auf den gewählten Bereich zugeschnitten (wichtig beim Ausschnitt,
    // damit angeschnittene Elemente nicht in die Legende ragen).
    `<defs>${markers}<clipPath id="export-area"><rect ${areaRect}/></clipPath></defs>`,
    `<rect x="${num(area.x)}" y="${num(area.y)}" width="${num(width)}" height="${num(height)}" fill="#ffffff"/>`,
    `<g clip-path="url(#export-area)">`,
    ...pools.map((node) => renderNode(node, icons)),
    ...scene.edges.map((edge) => renderEdge(edge, nodeMap)),
    ...others.map((node) => renderNode(node, icons)),
    `</g>`,
    legend ? renderLegend(scene, area.x, area.y + area.height, width, height - area.height, icons) : "",
    `</svg>`
  ].filter(Boolean).join("\n");
  return { svg, width, height };
}

/* ── Browser-Teil: PNG rendern und herunterladen ─────────────────────────────── */

/** Rendert das SVG über ein Canvas in ein PNG mit `scale`-facher Auflösung. */
export async function svgToPngBlob(svg: string, area: { width: number; height: number }, scale: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Das Bild konnte nicht erzeugt werden."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(Math.round(area.width * scale), 1);
    canvas.height = Math.max(Math.round(area.height * scale), 1);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Dein Browser unterstützt keinen PNG-Export.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Das Diagramm ist zu groß für den PNG-Export. Versuche SVG oder eine kleinere Auflösung."))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Etwas verzögert freigeben, damit der Download in allen Browsern sicher startet.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
