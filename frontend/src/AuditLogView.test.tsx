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

  it("loads the selected element history with an exact entity filter", async () => {
    mocked.auditLog.mockResolvedValue({ items: [entry], nextCursor: null });
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ElementAuditHistory entityId="component-1" />);
      await Promise.resolve();
    });
    expect(mocked.auditLog).toHaveBeenCalledWith({ entityId: "component-1", limit: 20 });
    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).toContain("Geändert");
    expect(rendered).toContain("Titus");
    expect(rendered).toContain("Komponente geändert");
  });
});
