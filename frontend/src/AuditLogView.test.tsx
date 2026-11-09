import { renderToStaticMarkup } from "react-dom/server";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry, AuditPage } from "./transferApi";

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

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

  it("ignores a late page from the previously selected entity", async () => {
    const lateA = deferred<AuditPage>();
    const pendingB = deferred<AuditPage>();
    const aFirst = { ...entry, id: "a-1", entityId: "entity-a", summary: "A Seite 1" };
    const aSecond = { ...entry, id: "a-2", entityId: "entity-a", summary: "A Seite 2 verspätet" };
    const bFirst = { ...entry, id: "b-1", entityId: "entity-b", summary: "B Seite 1" };
    const bSecond = { ...entry, id: "b-2", entityId: "entity-b", summary: "B Seite 2" };
    mocked.auditLog
      .mockResolvedValueOnce({ items: [aFirst], nextCursor: "a-next" })
      .mockReturnValueOnce(lateA.promise)
      .mockResolvedValueOnce({ items: [bFirst], nextCursor: "b-next" })
      .mockReturnValueOnce(pendingB.promise);

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ElementAuditHistory entityId="entity-a" entityType="component" />);
      await Promise.resolve();
    });
    const aButton = renderer!.root.findByType("button");
    act(() => { void aButton.props.onClick(); });
    expect(mocked.auditLog).toHaveBeenNthCalledWith(2, {
      entityId: "entity-a",
      entityType: "component",
      limit: 20,
      cursor: "a-next"
    });

    await act(async () => {
      renderer!.update(<ElementAuditHistory entityId="entity-b" entityType="component" />);
      await Promise.resolve();
    });
    expect(JSON.stringify(renderer!.toJSON())).toContain("B Seite 1");
    const bButton = renderer!.root.findByType("button");
    act(() => { void bButton.props.onClick(); });
    expect(mocked.auditLog).toHaveBeenNthCalledWith(4, {
      entityId: "entity-b",
      entityType: "component",
      limit: 20,
      cursor: "b-next"
    });
    expect(renderer!.root.findByType("button").props.disabled).toBe(true);

    await act(async () => {
      lateA.resolve({ items: [aSecond], nextCursor: "a-after" });
      await lateA.promise;
      await Promise.resolve();
    });
    const afterLateA = JSON.stringify(renderer!.toJSON());
    expect(afterLateA).toContain("B Seite 1");
    expect(afterLateA).not.toContain("A Seite 1");
    expect(afterLateA).not.toContain("A Seite 2 verspätet");
    expect(renderer!.root.findByType("button").props.disabled).toBe(true);

    await act(async () => {
      pendingB.resolve({ items: [bSecond], nextCursor: null });
      await pendingB.promise;
      await Promise.resolve();
    });
    const finalRendered = JSON.stringify(renderer!.toJSON());
    expect(finalRendered).toContain("B Seite 1");
    expect(finalRendered).toContain("B Seite 2");
    expect(finalRendered).not.toContain("A Seite 2 verspätet");
  });
});
