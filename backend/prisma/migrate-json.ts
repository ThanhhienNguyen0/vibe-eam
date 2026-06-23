import { PrismaClient } from "@prisma/client";
import { readLegacySidebarState } from "../src/Sidebar/sidebarStore.js";
import { PrismaSidebarStateRepository } from "../src/persistence/databaseSidebarRepository.js";

const prisma = new PrismaClient();
const repository = new PrismaSidebarStateRepository(prisma);

async function main(): Promise<void> {
  const existing = await prisma.metamodel.count();
  if (existing > 0 && process.env.FORCE_JSON_MIGRATION !== "true") {
    throw new Error("Database is not empty. Set FORCE_JSON_MIGRATION=true only after taking a backup if replacement is intentional.");
  }

  const state = await readLegacySidebarState();
  await repository.write(state);
  console.log(`Copied ${state.componentTypes.length} component types, ${state.connectionRules.length} connection rules and ${state.diagrams.length} diagrams from sidebar.json. The JSON source was not changed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => repository.disconnect());
