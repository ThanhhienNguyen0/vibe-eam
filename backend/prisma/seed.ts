import { Prisma, PrismaClient } from "@prisma/client";
import { buildInitialSidebarStateForCompany } from "../src/Sidebar/sidebarStore.js";
import { PrismaSidebarStateRepository } from "../src/persistence/databaseSidebarRepository.js";
import { DEFAULT_COMPANY_ID, DEFAULT_COMPANY_NAME } from "../src/tenant.js";
import { seedState as architectureSeedState } from "../src/seed.js";
import { demoCredentials, seedDemoUsers } from "../src/auth/demoSeed.js";

const prisma = new PrismaClient();
const repository = new PrismaSidebarStateRepository(prisma);

async function main(): Promise<void> {
  // Validate the explicit dev/test opt-in before any database write.
  const credentials = await demoCredentials(process.env);
  await seedDemoUsers(prisma, credentials);
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

  const withExamples = process.env.SEED_EXAMPLES !== "false";
  // Use the same self-consistent, company-scoped starter as first application access.
  // Mixing legacy instances (including BPMN) with an EAM-only JSON metamodel orphaned references.
  const state = buildInitialSidebarStateForCompany(DEFAULT_COMPANY_ID, withExamples);

  await repository.write(state, DEFAULT_COMPANY_ID);
  console.log(`Seeded metamodel '${state.metamodel.name}'${withExamples ? " with example diagrams" : ""}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => repository.disconnect());
