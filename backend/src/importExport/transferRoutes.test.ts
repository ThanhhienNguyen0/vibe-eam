import request from "supertest";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../server.js";
import type { AuthRepository, StoredUser, UserRepository } from "../auth/authTypes.js";
import { ROLES } from "../auth/policy.js";
import type { AuditEntryInput } from "../audit/auditTypes.js";
import type { SidebarState } from "../Sidebar/sidebarTypes.js";
import { sampleState } from "./fixtures.js";
import { buildXlsx, parseCsv, parseXlsx, serializeCsv } from "./tabular.js";

const store = vi.hoisted(() => ({
  state: undefined as unknown as SidebarState,
  writes: [] as Array<{ state: SidebarState; audit?: AuditEntryInput }>
}));

vi.mock("../Sidebar/sidebarStore.js", async (original) => ({
  ...await original<typeof import("../Sidebar/sidebarStore.js")>(),
  readSidebarState: vi.fn(async () => structuredClone(store.state)),
  writeSidebarState: vi.fn(async (state: SidebarState, audit?: AuditEntryInput) => {
    store.writes.push({ state: structuredClone(state), audit });
    store.state = structuredClone(state);
    return state;
  }),
  listAuditLog: vi.fn(async () => store.writes.filter((write) => write.audit).map((write, index) => ({
    id: String(index), createdAt: "2026-01-01T00:00:00.000Z", userId: null, userEmail: null,
    entityType: write.audit!.entityType, action: write.audit!.action, summary: write.audit!.summary, details: write.audit!.details ?? {}
  })))
}));

const secret = "req31-test-only-signing-secret-at-least-32-characters";
const token = (subject: string) => jwt.sign({}, secret, { subject, issuer: "eam-tool", audience: "eam-tool", expiresIn: "8h" });
const bearer = (role: string) => `Bearer ${token(role)}`;

function application() {
  const users = ROLES.map((role): StoredUser => ({ id: role, role, companyId: "company-a", companyName: "Test", email: `${role}@example.invalid`, name: null, passwordHash: "unused" }));
  const repository: AuthRepository = { createCompanyUser: vi.fn(), findUserByEmail: vi.fn(), findUserById: async (id) => users.find((user) => user.id === id) ?? null };
  const administration: UserRepository = { listCompanyUsers: vi.fn(async () => []), createLocalUser: vi.fn(), changeRole: vi.fn() };
  return createApp({ jwtSecret: secret, authRepository: repository, userRepository: administration });
}

const binary = (parser: request.Test) => parser.buffer(true).parse((res, callback) => {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
});

const csvFile = (rows: string[][]) => Buffer.from(serializeCsv(rows), "utf-8");

beforeEach(() => {
  store.state = sampleState();
  store.writes = [];
});

describe("catalog export", () => {
  it("exports a catalog selection for every role and rejects unknown catalogs", async () => {
    for (const role of ROLES) {
      const response = await binary(request(application()).get("/api/sidebar/export?format=csv&catalogId=cat-apps").set("Authorization", bearer(role)));
      expect(response.status, role).toBe(200);
      const rows = parseCsv(response.body.toString("utf-8"));
      expect(rows[0]).toEqual(["ID", "Typ", "Name", "Beschreibung", "owner"]);
      expect(rows).toHaveLength(3);
    }
    const missing = await request(application()).get("/api/sidebar/export?catalogId=nope").set("Authorization", bearer("Viewer"));
    expect(missing.status).toBe(404);
  });

  it("only lets writers change catalogs", async () => {
    const body = { name: "Neu", kind: "elements" };
    expect((await request(application()).post("/api/sidebar/catalogs").set("Authorization", bearer("Viewer")).send(body)).status).toBe(403);
    expect((await request(application()).delete("/api/sidebar/catalogs/cat-apps").set("Authorization", bearer("Viewer"))).status).toBe(403);
    // invalid payloads are rejected before anything is stored
    const invalid = await request(application()).post("/api/sidebar/catalogs").set("Authorization", bearer("Architect")).send({ name: "X", componentTypeIds: ["unknown"] });
    expect(invalid.status).toBe(400);
    const badColumn = await request(application()).post("/api/sidebar/catalogs").set("Authorization", bearer("Architect")).send({ name: "X", columns: ["bogus"] });
    expect(badColumn.status).toBe(400);
    expect(store.writes).toHaveLength(0);
  });
});

describe("export routes", () => {
  it("lets every role download the model as XLSX with both sheets", async () => {
    for (const role of ROLES) {
      const response = await binary(request(application()).get("/api/sidebar/export").set("Authorization", bearer(role)));
      expect(response.status, role).toBe(200);
      expect(response.headers["content-type"]).toContain("spreadsheetml");
      expect(response.headers["content-disposition"]).toMatch(/attachment; filename="eam-modell-\d{4}-\d{2}-\d{2}\.xlsx"/);
      expect(response.headers["cache-control"]).toBe("no-store");
      const sheets = await parseXlsx(response.body as Buffer);
      expect(sheets.map((sheet) => sheet.name)).toEqual(["Elemente", "Relationen"]);
      expect(sheets[0].rows).toHaveLength(4);
    }
  });

  it("exports the filtered selection as CSV and requires a sheet for CSV", async () => {
    const app = application();
    const response = await request(app).get("/api/sidebar/export?format=csv&sheet=elements&typeIds=ct-data&q=inv").set("Authorization", bearer("Viewer"));
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(parseCsv(response.text).map((row) => row[0])).toEqual(["ID", "data-1"]);
    expect((await request(app).get("/api/sidebar/export?format=csv").set("Authorization", bearer("Viewer"))).status).toBe(400);
    expect((await request(app).get("/api/sidebar/export?format=pdf").set("Authorization", bearer("Viewer"))).status).toBe(400);
    expect((await request(app).get("/api/sidebar/export?sheet=nothing").set("Authorization", bearer("Viewer"))).status).toBe(400);
  });

  it("serves a template with an instruction sheet", async () => {
    const response = await binary(request(application()).get("/api/sidebar/import/template").set("Authorization", bearer("Viewer")));
    expect(response.status).toBe(200);
    expect((await parseXlsx(response.body as Buffer)).map((sheet) => sheet.name)).toEqual(["Elemente", "Relationen", "Hinweise"]);
  });

  it("requires authentication", async () => {
    expect((await request(application()).get("/api/sidebar/export")).status).toBe(401);
  });
});

describe("import routes", () => {
  const newApp = csvFile([["Typ", "Name", "owner"], ["Application", "Billing", "Finance"]]);

  it("forbids Viewers from previewing or committing and does not write", async () => {
    const app = application();
    for (const path of ["preview", "commit"]) {
      const response = await request(app).post(`/api/sidebar/import/${path}?fileName=a.csv`).set("Authorization", bearer("Viewer")).set("Content-Type", "application/octet-stream").send(newApp);
      expect(response.status).toBe(403);
    }
    expect(store.writes).toHaveLength(0);
  });

  it("previews without writing anything", async () => {
    const response = await request(application()).post("/api/sidebar/import/preview?fileName=elements.csv").set("Authorization", bearer("Architect")).set("Content-Type", "application/octet-stream").send(newApp);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ fileName: "elements.csv", format: "csv", errorCount: 0, canCommit: true, summary: { elements: { new: 1 } } });
    expect(response.body.rows[0]).toMatchObject({ status: "new", label: "Billing" });
    expect(response.body).not.toHaveProperty("nextState");
    expect(store.writes).toHaveLength(0);
  });

  it("commits valid files, writes one audit entry and returns the summary", async () => {
    const response = await request(application()).post("/api/sidebar/import/commit?fileName=C%3A%5Cfakepath%5Celements.csv&expectedRevision=0").set("Authorization", bearer("Architect")).set("Content-Type", "application/octet-stream").send(newApp);
    expect(response.status).toBe(200);
    expect(response.body.applied).toBe(true);
    expect(store.writes).toHaveLength(1);
    expect(store.state.components.some((item) => item.name === "Billing")).toBe(true);
    expect(store.writes[0].audit).toMatchObject({
      action: "import.commit",
      entityType: "model",
      details: { fileName: "elements.csv", format: "csv", skippedInvalidRows: 0, elements: { new: 1 } }
    });
    expect(store.writes[0].audit?.details?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(store.writes[0].audit?.summary).toContain("1 neu");
  });

  it("imports XLSX files that were detected by content, not by name", async () => {
    const workbook = await buildXlsx([{ name: "Elemente", rows: [["Typ", "Name"], ["Application", "From Excel"]] }]);
    const response = await request(application()).post("/api/sidebar/import/commit?expectedRevision=0").set("Authorization", bearer("Admin")).set("Content-Type", "application/octet-stream").send(workbook);
    expect(response.status).toBe(200);
    expect(response.body.format).toBe("xlsx");
    expect(store.state.components.some((item) => item.name === "From Excel")).toBe(true);
  });

  it("blocks a commit with errors unless the invalid rows are skipped explicitly", async () => {
    const file = csvFile([["Typ", "Name"], ["Application", "Good"], ["Banana", "Bad"]]);
    const app = application();
    const blocked = await request(app).post("/api/sidebar/import/commit?fileName=x.csv&expectedRevision=0").set("Authorization", bearer("Architect")).set("Content-Type", "application/octet-stream").send(file);
    expect(blocked.status).toBe(422);
    expect(blocked.body).toMatchObject({ errorCount: 1, canCommit: false, canCommitValidOnly: true });
    expect(blocked.body.rows.find((row: { status: string }) => row.status === "error").errors[0]).toMatch(/Banana/);
    expect(store.writes).toHaveLength(0);

    const skipped = await request(app).post("/api/sidebar/import/commit?fileName=x.csv&skipInvalid=true&expectedRevision=0").set("Authorization", bearer("Architect")).set("Content-Type", "application/octet-stream").send(file);
    expect(skipped.status).toBe(200);
    expect(store.state.components.map((item) => item.name)).toContain("Good");
    expect(store.state.components.map((item) => item.name)).not.toContain("Bad");
    expect(store.writes[0].audit).toMatchObject({ details: { skippedInvalidRows: 1 } });
    expect(store.writes[0].audit?.summary).toContain("1 fehlerhafte Zeilen übersprungen");
  });

  it("does not write or audit when nothing would change", async () => {
    const unchanged = csvFile([["ID", "Typ", "Name"], ["app-2", "", "CRM"]]);
    const response = await request(application()).post("/api/sidebar/import/commit?fileName=same.csv&expectedRevision=0").set("Authorization", bearer("Architect")).set("Content-Type", "application/octet-stream").send(unchanged);
    expect(response.status).toBe(200);
    expect(response.body.applied).toBe(false);
    expect(store.writes).toHaveLength(0);
  });

  it("answers bad uploads with 4xx messages", async () => {
    const app = application();
    const post = (body: Buffer | string, query = "") => request(app).post(`/api/sidebar/import/preview${query}`).set("Authorization", bearer("Architect")).set("Content-Type", "application/octet-stream").send(body);
    expect((await post(Buffer.alloc(0))).status).toBe(400);
    const notAZip = await post(Buffer.from("PK nonsense"), "?fileName=x.xlsx");
    expect(notAZip.status).toBe(400);
    expect(notAZip.body.error).toMatch(/keine gültige XLSX/);
    const jsonBody = await request(app).post("/api/sidebar/import/preview").set("Authorization", bearer("Architect")).send({ elements: [] });
    expect(jsonBody.status).toBe(400);
    expect((await post(Buffer.from("a;b\n1;2"), "?format=pdf")).status).toBe(400);
  });

  it("rejects uploads above 10 MB", async () => {
    const response = await request(application()).post("/api/sidebar/import/preview?fileName=big.csv").set("Authorization", bearer("Architect")).set("Content-Type", "application/octet-stream").send(Buffer.alloc(10 * 1024 * 1024 + 1, "a"));
    expect(response.status).toBe(413);
  });
});

describe("audit log route", () => {
  it("is available to Admin and Architect but not to Viewer", async () => {
    const app = application();
    expect((await request(app).get("/api/sidebar/audit-log").set("Authorization", bearer("Viewer"))).status).toBe(403);
    for (const role of ["Admin", "Architect"]) {
      const response = await request(app).get("/api/sidebar/audit-log").set("Authorization", bearer(role));
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    }
  });

  it("lists recorded imports", async () => {
    const app = application();
    await request(app).post("/api/sidebar/import/commit?fileName=a.csv&expectedRevision=0").set("Authorization", bearer("Architect")).set("Content-Type", "application/octet-stream").send(csvFile([["Typ", "Name"], ["Application", "Logged"]]));
    const response = await request(app).get("/api/sidebar/audit-log").set("Authorization", bearer("Admin"));
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ action: "import.commit", entityType: "model" });
  });
});
