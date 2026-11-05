import { describe, expect, it } from "vitest";
import type { SidebarState } from "../Sidebar/sidebarTypes.js";
import {
  exportModelTransferDocument,
  materializeModelTransferState,
  ModelTransferError,
  parseModelTransferDocument
} from "./modelTransfer.js";

const state: SidebarState = {
  metamodel: {
    id: "mm",
    name: "Minimal",
    description: "",
    version: "domain-1",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z"
  },
  componentTypes: [],
  connectionTypes: [],
  connectionRules: [],
  viewpointRules: [],
  validationRules: [],
  components: [],
  connections: [],
  diagrams: [],
  viewpoints: [],
  catalogs: []
};

describe("REQ-33 model transfer format", () => {
  it("creates a deterministic schema-versioned document and accepts its own output", () => {
    const first = exportModelTransferDocument(state);
    const second = exportModelTransferDocument(structuredClone(state));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.schemaVersion).toBe(1);
    expect(first.model.metamodel.version).toBe("domain-1");
    expect(parseModelTransferDocument(first)).toEqual(first);
  });

  it("removes tenant prefixes from portable ids and materializes them for the target tenant", () => {
    const tenantState = structuredClone(state);
    tenantState.metamodel.id = "company-a:mm";
    const portable = exportModelTransferDocument(tenantState, "company-a");
    expect(portable.model.metamodel.id).toBe("mm");
    expect(materializeModelTransferState(portable, "company-b").metamodel.id).toBe("company-b:mm");
    expect(exportModelTransferDocument(materializeModelTransferState(portable, "company-b"), "company-b")).toEqual(portable);
  });

  it.each([
    [{ format: "vibe-eam-model", model: state }, "SCHEMA_VERSION_REQUIRED"],
    [{ schemaVersion: 0, format: "vibe-eam-model", model: state }, "SCHEMA_VERSION_UNSUPPORTED_LEGACY"],
    [{ schemaVersion: 2, format: "vibe-eam-model", model: state }, "SCHEMA_VERSION_UNSUPPORTED_FUTURE"],
    [{ schemaVersion: 1.5, format: "vibe-eam-model", model: state }, "SCHEMA_VERSION_INVALID"]
  ])("rejects missing, legacy, future and malformed versions before import", (input, code) => {
    expect(() => parseModelTransferDocument(input)).toThrowError(expect.objectContaining({ code }) as ModelTransferError);
  });

  it("uses the repository JSON Schema strictly", () => {
    const invalid = { ...exportModelTransferDocument(state), unexpected: true };
    expect(() => parseModelTransferDocument(invalid)).toThrowError(expect.objectContaining({ code: "MODEL_SCHEMA_INVALID" }) as ModelTransferError);
  });

  it("rejects dangling references instead of normalizing them away", () => {
    const invalid = exportModelTransferDocument({
      ...state,
      diagrams: [{
        id: "diagram",
        name: "Broken",
        description: "",
        componentIds: ["missing"],
        connectionIds: [],
        positions: {}
      }]
    });
    expect(() => parseModelTransferDocument(invalid)).toThrowError(expect.objectContaining({ code: "MODEL_REFERENCE_INVALID" }) as ModelTransferError);
  });
});
