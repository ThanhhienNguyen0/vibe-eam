// @vitest-environment jsdom

import { useState, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccessContext } from "./access";
import DiagramEditor from "./DiagramEditor";

const api = vi.hoisted(() => ({
  createDiagramConnection: vi.fn(),
  updateDiagram: vi.fn(),
  createComponent: vi.fn(),
  validateDiagram: vi.fn()
}));

vi.mock("./Sidebar/sidebarApi", () => ({ sidebarApi: api }));

vi.mock("reactflow", () => ({
  default: ({ nodes, onNodeClick, onNodeContextMenu }: {
    nodes: Array<{ id: string }>;
    onNodeClick?: (event: MouseEvent, node: { id: string }) => void;
    onNodeContextMenu?: (event: MouseEvent, node: { id: string }) => void;
  }) => (
    <div data-testid="react-flow">
      {nodes.map((node) => (
        <button
          key={node.id}
          data-testid={`node-${node.id}`}
          onClick={(event) => onNodeClick?.(event.nativeEvent, node)}
          onContextMenu={(event) => onNodeContextMenu?.(event.nativeEvent, node)}
        >
          {node.id}
        </button>
      ))}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  MiniMap: () => null,
  ReactFlowProvider: ({ children }: { children: ReactNode }) => children,
  MarkerType: { ArrowClosed: "arrowclosed" },
  Position: { Bottom: "bottom", Left: "left", Right: "right", Top: "top" },
  useReactFlow: () => ({ screenToFlowPosition: (position: { x: number; y: number }) => position }),
  useNodesState: <T,>(initial: T[]) => {
    const [nodes, setNodes] = useState(initial);
    return [nodes, setNodes, vi.fn()];
  },
  useEdgesState: <T,>(initial: T[]) => {
    const [edges, setEdges] = useState(initial);
    return [edges, setEdges, vi.fn()];
  }
}));

const props = {
  diagram: {
    id: "diagram",
    name: "Full",
    description: "",
    componentIds: ["p", "c"],
    connectionIds: [],
    positions: {},
    viewpointId: "full"
  },
  metamodel: { id: "mm", name: "Test", description: "", version: "1", isActive: true, createdAt: "", updatedAt: "" },
  componentTypes: [
    { id: "proc", name: "Process", description: "", color: "#fff", icon: "", customPropertyKeys: [] },
    { id: "cap", name: "Capability", description: "", color: "#fff", icon: "", customPropertyKeys: [] }
  ],
  connectionTypes: [
    { id: "realizes", name: "realizes", description: "", color: "#fff", lineStyle: "solid" as const, allowedSourceTypeIds: ["proc"], allowedTargetTypeIds: ["cap"] }
  ],
  connectionRules: [
    { id: "proc-cap", sourceComponentTypeId: "proc", connectionTypeId: "realizes", targetComponentTypeId: "cap", allowed: true, required: false, severity: "error" as const, description: "", rationale: "", viewpointIds: ["business", "full"] }
  ],
  viewpoints: [
    { id: "business", name: "Business", description: "", stakeholderRole: "Owner", purpose: "", allowedComponentTypeIds: ["proc", "cap"], allowedConnectionTypeIds: ["realizes"], requiredComponentTypeIds: [], requiredConnectionTypeIds: [] },
    { id: "full", name: "Full", description: "", stakeholderRole: "Architect", purpose: "", allowedComponentTypeIds: ["proc", "cap"], allowedConnectionTypeIds: ["realizes"], requiredComponentTypeIds: [], requiredConnectionTypeIds: [] }
  ],
  viewpointRules: [
    { id: "vpr-business", viewpointId: "business", allowedComponentTypeIds: ["proc", "cap"], allowedConnectionTypeIds: ["realizes"], allowedConnectionRuleIds: ["proc-cap"], requiredComponentTypeIds: [], requiredConnectionTypeIds: [], requiredConnectionRuleIds: [], visibleComponentTypeIds: ["proc", "cap"], description: "", severity: "error" as const },
    { id: "vpr-full", viewpointId: "full", allowedComponentTypeIds: ["proc", "cap"], allowedConnectionTypeIds: ["realizes"], allowedConnectionRuleIds: ["proc-cap"], requiredComponentTypeIds: [], requiredConnectionTypeIds: [], requiredConnectionRuleIds: [], visibleComponentTypeIds: ["proc", "cap"], description: "", severity: "error" as const }
  ],
  validationRules: [],
  components: [
    { id: "p", name: "Process", componentTypeId: "proc", description: "", properties: {} },
    { id: "c", name: "Capability", componentTypeId: "cap", description: "", properties: {} }
  ],
  connections: [],
  onDiagramChange: vi.fn(),
  onConnectionCreated: vi.fn(),
  onComponentCreated: vi.fn(),
  onSelectComponent: vi.fn(),
  onSelectConnection: vi.fn(),
  onClose: vi.fn()
};

describe("DiagramEditor viewpoint transitions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cancels connection mode when switching to a local preview and does not write on the target click", async () => {
    render(
      <AccessContext.Provider value="Architect">
        <DiagramEditor {...props} />
      </AccessContext.Provider>
    );

    fireEvent.contextMenu(screen.getByTestId("node-p"));
    fireEvent.click(screen.getByRole("button", { name: /Neue Verbindung starten/i }));
    expect(screen.getByText(/Verbindung von/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Diagrammansicht filtern"), { target: { value: "business" } });
    await waitFor(() => expect(screen.queryByText(/Verbindung von/)).toBeNull());

    fireEvent.click(screen.getByTestId("node-c"));
    expect(api.createDiagramConnection).not.toHaveBeenCalled();
    expect(api.updateDiagram).not.toHaveBeenCalled();
  });
});
