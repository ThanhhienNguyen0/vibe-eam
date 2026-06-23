import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { validateMetamodelDefinition } from "../src/Sidebar/metamodelConfig.js";
import { readLegacySidebarState } from "../src/Sidebar/sidebarStore.js";
import type { SidebarState } from "../src/Sidebar/sidebarTypes.js";
import { PrismaSidebarStateRepository } from "../src/persistence/databaseSidebarRepository.js";

const prisma = new PrismaClient();
const repository = new PrismaSidebarStateRepository(prisma);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  if (await prisma.metamodel.count() > 0) {
    console.log("Database already contains a metamodel; seed skipped.");
    return;
  }

  const raw = JSON.parse(await fs.readFile(path.resolve(__dirname, "../src/data/default-metamodel.json"), "utf-8")) as unknown;
  const validation = validateMetamodelDefinition(raw);
  if (!validation.success || !validation.definition) {
    throw new Error(validation.errors[0]?.message ?? "Default metamodel is invalid.");
  }

  const withExamples = process.env.SEED_EXAMPLES !== "false";
  const state: SidebarState = withExamples
    ? { ...(await readLegacySidebarState()), ...validation.definition }
    : { ...validation.definition, components: [], connections: [], diagrams: [] };

  await repository.write(state);
  console.log(`Seeded metamodel '${state.metamodel.name}'${withExamples ? " with example diagrams" : ""}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => repository.disconnect());
