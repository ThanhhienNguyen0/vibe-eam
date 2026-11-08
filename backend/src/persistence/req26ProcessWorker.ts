import { PrismaClient } from "@prisma/client";
import type { ComponentInstance, Diagram } from "../Sidebar/sidebarTypes.js";
import { OptimisticLockError, PrismaSidebarStateRepository, ResourceNotFoundError } from "./databaseSidebarRepository.js";

interface Work {
  action?: "update-component" | "delete-component" | "update-diagram";
  companyId: string;
  component?: ComponentInstance;
  diagram?: Diagram;
  id?: string;
  expectedVersion: number;
  databaseUrl: string;
}

process.send?.({ type: "ready" });
process.on("message", async (message: Work) => {
  const client = new PrismaClient({ datasourceUrl: message.databaseUrl });
  const repository = new PrismaSidebarStateRepository(client);
  try {
    if (message.action === "delete-component") {
      await repository.deleteComponent(message.companyId, message.id!, message.expectedVersion);
      process.send?.({ type: "result", status: "deleted" });
    } else if (message.action === "update-diagram") {
      const value = await repository.updateDiagram(message.companyId, message.diagram!, message.expectedVersion);
      process.send?.({ type: "result", status: "updated", version: value.version });
    } else {
      const value = await repository.updateComponent(message.companyId, message.component!, message.expectedVersion);
      process.send?.({ type: "result", status: "updated", version: value.version });
    }
  } catch (error) {
    if (error instanceof OptimisticLockError) process.send?.({ type: "result", status: "conflict" });
    else if (error instanceof ResourceNotFoundError) process.send?.({ type: "result", status: "not-found" });
    else process.send?.({ type: "result", status: "error", message: error instanceof Error ? error.message : String(error) });
  } finally {
    await repository.disconnect();
    process.disconnect?.();
  }
});
