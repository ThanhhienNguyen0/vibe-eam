import { describe, expect, it } from "vitest";
import {
  ImportFormatError,
  MAX_DATA_ROWS,
  buildXlsx,
  detectSheetKind,
  parseCsv,
  parseImportFile,
  parseXlsx,
  serializeCsv
} from "./tabular.js";

describe("CSV", () => {
  it("parses quotes, escaped quotes, embedded newlines and CRLF", () => {
    const table = parseCsv('ID;Name;Beschreibung\r\n1;"A ""quoted"" name";"line1\nline2"\r\n2;B;\r\n');
    expect(table).toEqual([
      ["ID", "Name", "Beschreibung"],
      ["1", 'A "quoted" name', "line1\nline2"],
      ["2", "B"]
    ]);
  });

  it.each([[";"], [","], ["\t"]])("detects the delimiter %j and strips a UTF-8 BOM", (delimiter) => {
    const table = parseCsv(`\uFEFFID${delimiter}Name\n1${delimiter}Alpha\n`);
    expect(table).toEqual([["ID", "Name"], ["1", "Alpha"]]);
  });

  it("round-trips arbitrary text including delimiters, quotes and newlines", () => {
    const rows = [["ID", "Name"], ["1", 'semi;colon, "quote"\nnewline'], ["2", "ünïcödé ✓"]];
    expect(parseCsv(serializeCsv(rows))).toEqual(rows);
  });

  it("neutralises spreadsheet formulas on export and restores the original value on import", () => {
    const rows = [["Name"], ["=HYPERLINK(\"http://evil\")"], ["+1"], ["@SUM(A1)"], ["-5"]];
    const csv = serializeCsv(rows);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toMatch(/(^|;|\n)=HYPERLINK/);
    expect(parseCsv(csv)).toEqual(rows);
  });

  it("rejects an unterminated quote", () => {
    expect(() => parseCsv('ID;Name\n1;"open')).toThrow(ImportFormatError);
  });

  it("rejects files with too many rows or oversized cells", () => {
    const many = `Name\n${Array.from({ length: MAX_DATA_ROWS + 1 }, (_, i) => `n${i}`).join("\n")}`;
    expect(() => parseCsv(many)).toThrow(/Datenzeilen/);
    expect(() => parseCsv(`Name\n${"x".repeat(5001)}`)).toThrow(/Zelle/);
  });

  it("detects relation tables by their Quelle/Ziel headers", () => {
    expect(detectSheetKind([["ID", "Typ", "Quelle", "Ziel"]])).toBe("relations");
    expect(detectSheetKind([["ID", "Typ", "Name"]])).toBe("elements");
  });
});

describe("XLSX", () => {
  it("round-trips multiple sheets as text, including formula-like values", async () => {
    const buffer = await buildXlsx([
      { name: "Elemente", rows: [["ID", "Name"], ["1", "=1+1"], ["2", "Ä Ö Ü"]], widths: [10, 20] },
      { name: "Relationen", rows: [["ID", "Quelle"], ["r", "1"]] }
    ]);
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
    const sheets = await parseXlsx(buffer);
    expect(sheets.map((sheet) => sheet.name)).toEqual(["Elemente", "Relationen"]);
    expect(sheets[0].rows).toEqual([["ID", "Name"], ["1", "=1+1"], ["2", "Ä Ö Ü"]]);
  });

  it("selects sheets by name and ignores helper sheets", async () => {
    const buffer = await buildXlsx([
      { name: "Hinweise", rows: [["Thema", "Text"], ["a", "b"]] },
      { name: "Relationen", rows: [["ID", "Typ", "Quelle", "Ziel"], ["", "uses", "A", "B"]] }
    ]);
    const parsed = await parseImportFile(buffer, "xlsx");
    expect(parsed.elements).toBeUndefined();
    expect(parsed.relations).toHaveLength(2);
  });

  it("rejects non-XLSX content and files without a usable sheet", async () => {
    await expect(parseImportFile(Buffer.from("not a zip"), "xlsx")).rejects.toThrow(ImportFormatError);
    const unrelated = await buildXlsx([{ name: "Tabelle1", rows: [["a"], ["b"]] }]);
    await expect(parseImportFile(unrelated, "xlsx")).rejects.toThrow(/Blatt/);
    await expect(parseImportFile(Buffer.alloc(0), "csv")).rejects.toThrow(/leer/);
  });
});
