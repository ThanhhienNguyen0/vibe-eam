import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { classifyJsonDataFile, findJsonMigrationSources, parseModelFile } from "./jsonMigration.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "eam-json-migration-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("JSON to PostgreSQL migration sources", () => {
  it("recognizes per-company model and sidebar files and ignores seed files", () => {
    expect(classifyJsonDataFile("model.company-a.json")).toEqual({ kind: "model", companyId: "company-a" });
    expect(classifyJsonDataFile("sidebar.3f2a-uuid.json")).toEqual({ kind: "sidebar", companyId: "3f2a-uuid" });
    expect(classifyJsonDataFile("sidebar.json")).toBeNull();
    expect(classifyJsonDataFile("default-metamodel.json")).toBeNull();
    expect(classifyJsonDataFile("model.company-a.json.bak")).toBeNull();
  });

  it("collects files from several directories and skips missing ones", async () => {
    const root = await temporaryDirectory();
    const modelDirectory = path.join(root, "data");
    const sidebarDirectory = path.join(root, "src-data");
    await mkdir(modelDirectory);
    await mkdir(sidebarDirectory);
    await writeFile(path.join(modelDirectory, "model.company-a.json"), "{}");
    await writeFile(path.join(sidebarDirectory, "sidebar.company-a.json"), "{}");
    await writeFile(path.join(sidebarDirectory, "sidebar.json"), "{}");

    const sources = await findJsonMigrationSources([modelDirectory, sidebarDirectory, path.join(root, "missing")]);

    expect(sources).toEqual([
      { kind: "model", companyId: "company-a", file: path.join(modelDirectory, "model.company-a.json") },
      { kind: "sidebar", companyId: "company-a", file: path.join(sidebarDirectory, "sidebar.company-a.json") }
    ]);
  });

  it("refuses ambiguous duplicates instead of silently dropping one copy", async () => {
    const root = await temporaryDirectory();
    const first = path.join(root, "first");
    const second = path.join(root, "second");
    await mkdir(first);
    await mkdir(second);
    await writeFile(path.join(first, "sidebar.company-a.json"), "{}");
    await writeFile(path.join(second, "sidebar.company-a.json"), "{}");

    await expect(findJsonMigrationSources([first, second])).rejects.toThrow(/two JSON files/);
  });

  it("keeps model elements, relations and the audit log unchanged", () => {
    const raw = {
      elements: [{ id: "app", name: "ERP" }],
      relations: [{ id: "rel", source: "app", target: "app", type: "uses" }],
      auditLog: [{ id: "log", timestamp: "2026-01-01T00:00:00.000Z", action: "create", entityId: "app", description: "Created" }]
    };
    expect(parseModelFile(raw, "model.a.json")).toEqual(raw);
    expect(parseModelFile({ elements: [], relations: [] }, "model.a.json").auditLog).toEqual([]);
    expect(() => parseModelFile({ elements: [] }, "model.a.json")).toThrow(/relations/);
    expect(() => parseModelFile({ elements: [], relations: [], auditLog: {} }, "model.a.json")).toThrow(/auditLog/);
  });
});
