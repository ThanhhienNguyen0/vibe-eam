import { promises as fs } from "node:fs";
import path from "node:path";
import type { PersistedState } from "../types.js";

// File names written by the removed JSON storage backend (REQ-28):
// model.<companyId>.json for /api/model and sidebar.<companyId>.json for /api/sidebar.
const COMPANY_FILE_PATTERN = /^(model|sidebar)\.(.+)\.json$/;

export type JsonMigrationKind = "model" | "sidebar";

export interface JsonMigrationSource {
  kind: JsonMigrationKind;
  companyId: string;
  file: string;
}

export function classifyJsonDataFile(fileName: string): Omit<JsonMigrationSource, "file"> | null {
  const match = COMPANY_FILE_PATTERN.exec(fileName);
  if (!match) return null;
  return { kind: match[1] as JsonMigrationKind, companyId: match[2] };
}

export async function findJsonMigrationSources(directories: string[]): Promise<JsonMigrationSource[]> {
  const sources = new Map<string, JsonMigrationSource>();
  for (const directory of directories) {
    let fileNames: string[];
    try {
      fileNames = await fs.readdir(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const fileName of fileNames.sort()) {
      const classified = classifyJsonDataFile(fileName);
      if (!classified) continue;
      const key = `${classified.kind}:${classified.companyId}`;
      const file = path.join(directory, fileName);
      const existing = sources.get(key);
      // Picking one copy silently could lose data, so ambiguous sources must be resolved by hand.
      if (existing) {
        throw new Error(`Found two JSON files for ${classified.kind} data of company '${classified.companyId}': '${existing.file}' and '${file}'. Keep only one and rerun.`);
      }
      sources.set(key, { ...classified, file });
    }
  }
  return [...sources.values()];
}

export function parseModelFile(raw: unknown, file: string): PersistedState {
  const value = raw as Partial<PersistedState> | null;
  if (!value || typeof value !== "object" || !Array.isArray(value.elements) || !Array.isArray(value.relations)) {
    throw new Error(`'${file}' is not a valid model file: 'elements' and 'relations' must be arrays.`);
  }
  if (value.auditLog !== undefined && !Array.isArray(value.auditLog)) {
    throw new Error(`'${file}' is not a valid model file: 'auditLog' must be an array.`);
  }
  return { elements: value.elements, relations: value.relations, auditLog: value.auditLog ?? [] };
}
