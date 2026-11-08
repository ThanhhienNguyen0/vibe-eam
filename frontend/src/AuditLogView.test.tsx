import { renderToStaticMarkup } from "react-dom/server";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "./transferApi";

const mocked = vi.hoisted(() => ({ auditLog: vi.fn() }));
vi.mock("./transferApi", async (original) => {
  const module = await original<typeof import("./transferApi")>();
  return { ...module, transferApi: { ...module.transferApi, auditLog: mocked.auditLog } };
});

import { AuditEntryDetails, ElementAuditHistory } from "./AuditLogView";

const entry: AuditEntry = {
  id: "audit-1",
  occurredAt: "2026-11-07T10:00:00.000Z",
  createdAt: "2026-11-07T10:00:00.000Z",
  actorType: "user",
  actorLabel: "Titus",
  userId: "user-1",
  userEmail: "titus@example.invalid",
  action: "update",
  entityType: "component",
  entityId: "component-1",
  summary: "Komponente geändert.",
  changes: [{ field: "name", before: "Alt", after: "Neu" }],
  details: {},
  batchId: null
};

beforeEach(() => mocked.auditLog.mockReset());

describe("REQ-23 audit UI", () => {
  it("renders per-field before/after values", () => {
    const html = renderToStaticMarkup(<AuditEntryDetails entry={entry} />);
    expect(html).toContain("name");
    expect(html).toContain("Alt");
    expect(html).toContain("Neu");
  });

  it("binds history to entity type and makes entries beyond the first 20 reachable", async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => ({
      ...entry,
      id: `audit-${index + 1}`,
      summary: `Komponentenänderung ${index + 1}`
    }));
    const finalEntry = { ...entry, id: "audit-21", summary: "Komponentenänderung 21" };
    mocked.auditLog
      .mockResolvedValueOnce({ items: firstPage, nextCursor: "cursor-20" })
      .mockResolvedValueOnce({ items: [finalEntry], nextCursor: null });
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ElementAuditHistory entityId="shared-id" entityType="component" />);
      await Promise.resolve();
    });
    expect(mocked.auditLog).toHaveBeenNthCalledWith(1, { entityId: "shared-id", entityType: "component", limit: 20 });
    const button = renderer!.root.findAllByType("button").find((item) => item.children.join("").includes("Weitere Historieneinträge"));
    expect(button).toBeDefined();
    await act(async () => { await button!.props.onClick(); });
    expect(mocked.auditLog).toHaveBeenNthCalledWith(2, {
      entityId: "shared-id",
      entityType: "component",
      limit: 20,
      cursor: "cursor-20"
    });
    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).toContain("Komponentenänderung 1");
    expect(rendered).toContain("Komponentenänderung 21");
  });
});
