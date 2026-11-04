import readXlsxFile from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";

/** Raised for files that cannot be read at all (as opposed to row-level problems). */
export class ImportFormatError extends Error {}

/** A table is an array of rows of plain strings; row 0 is the header. */
export type Table = string[][];

export const MAX_DATA_ROWS = 5000;
export const MAX_COLUMNS = 200;
export const MAX_CELL_LENGTH = 5000;

export type SheetKind = "elements" | "relations";

export interface NamedSheet {
  name: string;
  rows: Table;
  /** Optional column widths in characters. */
  widths?: number[];
}

// ── CSV ──────────────────────────────────────────────────────────────────────

const FORMULA_START = /^[=+\-@\t\r]/;
const ESCAPED_FORMULA_START = /^'[=+\-@\t\r]/;

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", ",", "\t"].map((delimiter) => ({
    delimiter,
    count: firstLine.split(delimiter).length - 1
  }));
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].delimiter : ",";
}

/** RFC 4180 parser with automatic delimiter detection (";" for German Excel, "," or tab). */
export function parseCsv(input: string): Table {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);
  const rows: Table = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let cellStarted = false;

  const endCell = () => {
    row.push(cell);
    cell = "";
    cellStarted = false;
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && !cellStarted) {
      inQuotes = true;
      cellStarted = true;
    } else if (char === delimiter) {
      endCell();
    } else if (char === "\r") {
      if (text[index + 1] === "\n") index += 1;
      endRow();
    } else if (char === "\n") {
      endRow();
    } else {
      cell += char;
      cellStarted = true;
    }
  }
  if (inQuotes) throw new ImportFormatError("CSV enthält ein nicht geschlossenes Anführungszeichen.");
  if (cell !== "" || row.length > 0) endRow();

  return finalizeTable(rows.map((cells) => cells.map(unescapeCsvCell)));
}

function unescapeCsvCell(value: string): string {
  const trimmed = value.trim();
  return ESCAPED_FORMULA_START.test(trimmed) ? trimmed.slice(1) : trimmed;
}

function escapeCsvCell(value: string, delimiter: string): string {
  // Neutralise spreadsheet formula injection; parseCsv() reverses this prefix.
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /["\r\n]/.test(safe) || safe.includes(delimiter) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** UTF-8 with BOM and ";" delimiter so that German Excel opens the file correctly. */
export function serializeCsv(rows: Table, delimiter = ";"): string {
  return `\uFEFF${rows.map((row) => row.map((value) => escapeCsvCell(value, delimiter)).join(delimiter)).join("\r\n")}\r\n`;
}

// ── Shared table hygiene ─────────────────────────────────────────────────────

function finalizeTable(rows: Table): Table {
  const trimmed = rows.map((row) => {
    let end = row.length;
    while (end > 0 && row[end - 1] === "") end -= 1;
    return row.slice(0, end);
  });
  while (trimmed.length > 0 && trimmed[trimmed.length - 1].length === 0) trimmed.pop();
  if (trimmed.length === 0) return trimmed;
  if (trimmed[0].length > MAX_COLUMNS) {
    throw new ImportFormatError(`Die Datei hat mehr als ${MAX_COLUMNS} Spalten.`);
  }
  if (trimmed.length - 1 > MAX_DATA_ROWS) {
    throw new ImportFormatError(`Die Datei hat mehr als ${MAX_DATA_ROWS} Datenzeilen.`);
  }
  for (const row of trimmed) {
    for (const cell of row) {
      if (cell.length > MAX_CELL_LENGTH) {
        throw new ImportFormatError(`Eine Zelle ist länger als ${MAX_CELL_LENGTH} Zeichen.`);
      }
    }
  }
  return trimmed;
}

// ── XLSX ─────────────────────────────────────────────────────────────────────

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export async function parseXlsx(buffer: Buffer): Promise<Array<{ name: string; rows: Table }>> {
  let sheets: Awaited<ReturnType<typeof readXlsxFile>>;
  try {
    sheets = await readXlsxFile(buffer);
  } catch {
    throw new ImportFormatError("Die Datei ist keine gültige XLSX-Datei.");
  }
  return sheets.map((sheet) => ({
    name: sheet.sheet,
    rows: finalizeTable(sheet.data.map((row) => row.map(cellToString)))
  }));
}

export async function buildXlsx(sheets: NamedSheet[]): Promise<Buffer> {
  const data = sheets.map((sheet) => ({
    sheet: sheet.name,
    data: sheet.rows.map((row, rowIndex) => row.map((value) =>
      value === ""
        ? null
        : { value, type: String, ...(rowIndex === 0 ? { fontWeight: "bold" as const } : {}) }
    )),
    columns: (sheet.widths ?? []).map((width) => ({ width })),
    stickyRowsCount: 1
  }));
  return writeXlsxFile(data).toBuffer();
}

// ── Sheet detection ──────────────────────────────────────────────────────────

/** Header normalisation shared by all column lookups: "Externe ID" -> "externeid". */
export const normalizeHeader = (value: string): string => value.toLocaleLowerCase("de").replace(/[^a-z0-9äöüß]/g, "");

const SHEET_NAMES: Record<SheetKind, string[]> = {
  elements: ["elemente", "elements", "komponenten", "components"],
  relations: ["relationen", "relations", "verbindungen", "connections", "beziehungen"]
};

/** Header-based detection for single-table CSV files. */
export function detectSheetKind(table: Table): SheetKind {
  const headers = (table[0] ?? []).map(normalizeHeader);
  const hasSource = headers.some((header) => header === "quelle" || header === "source");
  const hasTarget = headers.some((header) => header === "ziel" || header === "target");
  return hasSource && hasTarget ? "relations" : "elements";
}

export interface ParsedImportFile {
  elements?: Table;
  relations?: Table;
}

export async function parseImportFile(
  buffer: Buffer,
  format: "xlsx" | "csv",
  csvSheet?: SheetKind
): Promise<ParsedImportFile> {
  if (buffer.length === 0) throw new ImportFormatError("Die Datei ist leer.");
  if (format === "csv") {
    const table = parseCsv(buffer.toString("utf-8"));
    if (table.length === 0) throw new ImportFormatError("Die CSV-Datei enthält keine Daten.");
    return { [csvSheet ?? detectSheetKind(table)]: table };
  }
  const sheets = await parseXlsx(buffer);
  const result: ParsedImportFile = {};
  for (const kind of ["elements", "relations"] as const) {
    const match = sheets.find((sheet) => SHEET_NAMES[kind].includes(normalizeHeader(sheet.name)));
    if (match && match.rows.length > 0) result[kind] = match.rows;
  }
  if (!result.elements && !result.relations) {
    throw new ImportFormatError("Die Datei enthält weder ein Blatt „Elemente“ noch ein Blatt „Relationen“.");
  }
  return result;
}
