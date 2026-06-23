import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";
import { validateMetamodelDefinition } from "../src/Sidebar/metamodelConfig.js";
import { readLegacySidebarState } from "../src/Sidebar/sidebarStore.js";
import type { SidebarState } from "../src/Sidebar/sidebarTypes.js";
import { PrismaSidebarStateRepository } from "../src/persistence/databaseSidebarRepository.js";
import { DEFAULT_COMPANY_ID, DEFAULT_COMPANY_NAME } from "../src/tenant.js";
import { seedState as architectureSeedState } from "../src/seed.js";

const prisma = new PrismaClient();
const repository = new PrismaSidebarStateRepository(prisma);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  await prisma.company.upsert({
    where: { id: DEFAULT_COMPANY_ID },
    create: { id: DEFAULT_COMPANY_ID, name: DEFAULT_COMPANY_NAME },
    update: {}
  });
  await prisma.architectureModel.upsert({
    where: { companyId: DEFAULT_COMPANY_ID },
    create: {
      companyId: DEFAULT_COMPANY_ID,
      elements: architectureSeedState.elements as unknown as Prisma.InputJsonValue,
      relations: architectureSeedState.relations as unknown as Prisma.InputJsonValue,
      auditLog: architectureSeedState.auditLog as unknown as Prisma.InputJsonValue
    },
    update: {}
  });
  if (await prisma.metamodel.count({ where: { companyId: DEFAULT_COMPANY_ID } }) > 0) {
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

  await repository.write(state, DEFAULT_COMPANY_ID);
  console.log(`Seeded metamodel '${state.metamodel.name}'${withExamples ? " with example diagrams" : ""}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => repository.disconnect());
