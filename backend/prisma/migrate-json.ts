import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";
import { normalizeSidebarStateForCompany, readLegacySidebarState } from "../src/Sidebar/sidebarStore.js";
import type { SidebarState } from "../src/Sidebar/sidebarTypes.js";
import { PrismaSidebarStateRepository } from "../src/persistence/databaseSidebarRepository.js";
import { findJsonMigrationSources, parseModelFile, type JsonMigrationSource } from "../src/persistence/jsonMigration.js";
import { DEFAULT_COMPANY_ID, DEFAULT_COMPANY_NAME } from "../src/tenant.js";

// One-off transfer of data written by the removed JSON storage backend (REQ-28) into PostgreSQL.
// Source files are only read, never changed. Companies that already have data are skipped
// unless FORCE_JSON_MIGRATION=true is set after taking a backup.

const prisma = new PrismaClient();
const repository = new PrismaSidebarStateRepository(prisma);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const force = process.env.FORCE_JSON_MIGRATION === "true";

// The old backend wrote model files next to src/ and sidebar files into src/data (dev) or dist/data (build).
const defaultDirectories = [
  path.resolve(__dirname, "../data"),
  path.resolve(__dirname, "../src/data"),
  path.resolve(__dirname, "../dist/data")
];

function sourceDirectories(): string[] {
  const configured = process.env.JSON_DATA_DIRS?.split(path.delimiter).map((item) => item.trim()).filter(Boolean);
  return configured && configured.length > 0 ? configured.map((item) => path.resolve(item)) : defaultDirectories;
}

async function ensureCompany(companyId: string): Promise<void> {
  await prisma.company.upsert({
    where: { id: companyId },
    create: { id: companyId, name: companyId === DEFAULT_COMPANY_ID ? DEFAULT_COMPANY_NAME : companyId },
    update: {}
  });
}

async function migrateModel(source: JsonMigrationSource): Promise<string> {
  if (!force && await prisma.architectureModel.count({ where: { companyId: source.companyId } }) > 0) {
    return `skipped ${source.file}: company '${source.companyId}' already has /api/model data.`;
  }
  const state = parseModelFile(JSON.parse(await fs.readFile(source.file, "utf-8")) as unknown, source.file);
  const data = {
    elements: state.elements as unknown as Prisma.InputJsonValue,
    relations: state.relations as unknown as Prisma.InputJsonValue,
    auditLog: state.auditLog as unknown as Prisma.InputJsonValue
  };
  await ensureCompany(source.companyId);
  await prisma.architectureModel.upsert({
    where: { companyId: source.companyId },
    create: { companyId: source.companyId, ...data },
    update: data
  });
  return `copied ${source.file}: ${state.elements.length} elements, ${state.relations.length} relations, ${state.auditLog.length} audit entries.`;
}

async function migrateSidebar(companyId: string, file: string, readState: () => Promise<SidebarState>): Promise<string> {
  if (!force && await prisma.metamodel.count({ where: { companyId } }) > 0) {
    return `skipped ${file}: company '${companyId}' already has a metamodel.`;
  }
  const state = await readState();
  await ensureCompany(companyId);
  await repository.write(state, companyId);
  return `copied ${file}: ${state.componentTypes.length} component types, ${state.components.length} components, ${state.diagrams.length} diagrams.`;
}

async function main(): Promise<void> {
  const directories = sourceDirectories();
  const sources = await findJsonMigrationSources(directories);
  const results: string[] = [];

  for (const source of sources) {
    if (source.kind === "model") {
      results.push(await migrateModel(source));
    } else {
      results.push(await migrateSidebar(source.companyId, source.file, async () => normalizeSidebarStateForCompany(
        JSON.parse(await fs.readFile(source.file, "utf-8")) as Partial<SidebarState>,
        source.companyId
      )));
    }
  }

  // The historic single-tenant sidebar.json belongs to the default company unless a company file exists.
  const legacyFile = path.resolve(__dirname, "../src/data/sidebar.json");
  const hasDefaultSidebar = sources.some((source) => source.kind === "sidebar" && source.companyId === DEFAULT_COMPANY_ID);
  if (!hasDefaultSidebar) {
    results.push(await migrateSidebar(DEFAULT_COMPANY_ID, legacyFile, readLegacySidebarState));
  }

  console.log(`Searched ${directories.join(", ")}.`);
  for (const result of results) console.log(`- ${result}`);
  console.log("JSON source files were not changed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => repository.disconnect());
