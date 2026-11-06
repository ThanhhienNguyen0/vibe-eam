import { PrismaClient } from "@prisma/client";
import type { ComponentInstance } from "../Sidebar/sidebarTypes.js";
import { OptimisticLockError, PrismaSidebarStateRepository } from "./databaseSidebarRepository.js";

interface Work {
  companyId: string;
  component: ComponentInstance;
  expectedVersion: number;
  databaseUrl: string;
}

process.send?.({ type: "ready" });
process.on("message", async (message: Work) => {
  const client = new PrismaClient({ datasourceUrl: message.databaseUrl });
  const repository = new PrismaSidebarStateRepository(client);
  try {
    const value = await repository.updateComponent(message.companyId, message.component, message.expectedVersion);
    process.send?.({ type: "result", status: "updated", version: value.version });
  } catch (error) {
    if (error instanceof OptimisticLockError) process.send?.({ type: "result", status: "conflict" });
    else process.send?.({ type: "result", status: "error", message: error instanceof Error ? error.message : String(error) });
  } finally {
    await repository.disconnect();
    process.disconnect?.();
  }
});
