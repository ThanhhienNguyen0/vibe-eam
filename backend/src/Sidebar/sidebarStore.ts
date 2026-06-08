import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ComponentInstance,
  ComponentType,
  ConnectionInstance,
  ConnectionType,
  Diagram,
  SidebarState
} from "./sidebarTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
const sidebarFile = path.join(dataDir, "sidebar.json");

const defaultState: SidebarState = {
  componentTypes: [
    {
      id: "ct-app",
      name: "Application",
      color: "#2563eb",
      icon: "app",
      description: "A software application component.",
      customPropertyKeys: ["version", "owner"]
    },
    {
      id: "ct-server",
      name: "Server",
      color: "#475569",
      icon: "server",
      description: "A physical or virtual server.",
      customPropertyKeys: ["os", "cpu", "ram"]
    },
    {
      id: "ct-db",
      name: "Database",
      color: "#7c3aed",
      icon: "db",
      description: "A database system.",
      customPropertyKeys: ["engine", "version"]
    },
    {
      id: "ct-proc",
      name: "Business Process",
      color: "#0f766e",
      icon: "proc",
      description: "A business process.",
      customPropertyKeys: ["owner", "sla"]
    },
    {
      id: "ct-svc",
      name: "Service",
      color: "#c2410c",
      icon: "svc",
      description: "An external or internal service.",
      customPropertyKeys: ["endpoint", "owner"]
    }
  ],
  connectionTypes: [
    {
      id: "conn-runs",
      name: "runs on",
      color: "#475569",
      lineStyle: "solid",
      allowedSourceTypeIds: ["ct-app"],
      allowedTargetTypeIds: ["ct-server"],
      description: "An application runs on a server."
    },
    {
      id: "conn-dep",
      name: "depends on",
      color: "#dc2626",
      lineStyle: "dashed",
      allowedSourceTypeIds: [],
      allowedTargetTypeIds: [],
      description: "A component depends on another component."
    },
    {
      id: "conn-comm",
      name: "communicates with",
      color: "#2563eb",
      lineStyle: "dotted",
      allowedSourceTypeIds: [],
      allowedTargetTypeIds: [],
      description: "Two components communicate with each other."
    }
  ],
  components: [],
  connections: [],
  diagrams: []
};

let cached: SidebarState | null = null;

async function ensureFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(sidebarFile);
  } catch {
    await fs.writeFile(sidebarFile, JSON.stringify(defaultState, null, 2), "utf-8");
  }
}

export async function readSidebarState(): Promise<SidebarState> {
  if (cached) return structuredClone(cached);
  await ensureFile();
  const raw = await fs.readFile(sidebarFile, "utf-8");
  cached = JSON.parse(raw) as SidebarState;
  return structuredClone(cached);
}

export async function writeSidebarState(state: SidebarState): Promise<SidebarState> {
  cached = structuredClone(state);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(sidebarFile, JSON.stringify(cached, null, 2), "utf-8");
  return structuredClone(cached);
}

// ── Component Types ──────────────────────────────────────────────────────────

export async function getComponentTypes(): Promise<ComponentType[]> {
  return (await readSidebarState()).componentTypes;
}

export async function addComponentType(ct: ComponentType): Promise<ComponentType> {
  const state = await readSidebarState();
  state.componentTypes.push(ct);
  await writeSidebarState(state);
  return ct;
}

export async function updateComponentType(id: string, patch: Partial<ComponentType>): Promise<ComponentType | null> {
  const state = await readSidebarState();
  const idx = state.componentTypes.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  state.componentTypes[idx] = { ...state.componentTypes[idx], ...patch, id };
  await writeSidebarState(state);
  return state.componentTypes[idx];
}

export async function deleteComponentType(id: string): Promise<boolean> {
  const state = await readSidebarState();
  const before = state.componentTypes.length;
  state.componentTypes = state.componentTypes.filter((c) => c.id !== id);
  if (state.componentTypes.length === before) return false;
  await writeSidebarState(state);
  return true;
}

// ── Connection Types ─────────────────────────────────────────────────────────

export async function getConnectionTypes(): Promise<ConnectionType[]> {
  return (await readSidebarState()).connectionTypes;
}

export async function addConnectionType(ct: ConnectionType): Promise<ConnectionType> {
  const state = await readSidebarState();
  state.connectionTypes.push(ct);
  await writeSidebarState(state);
  return ct;
}

export async function updateConnectionType(id: string, patch: Partial<ConnectionType>): Promise<ConnectionType | null> {
  const state = await readSidebarState();
  const idx = state.connectionTypes.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  state.connectionTypes[idx] = { ...state.connectionTypes[idx], ...patch, id };
  await writeSidebarState(state);
  return state.connectionTypes[idx];
}

export async function deleteConnectionType(id: string): Promise<boolean> {
  const state = await readSidebarState();
  const before = state.connectionTypes.length;
  state.connectionTypes = state.connectionTypes.filter((c) => c.id !== id);
  if (state.connectionTypes.length === before) return false;
  await writeSidebarState(state);
  return true;
}

// ── Components ───────────────────────────────────────────────────────────────

export async function getComponents(): Promise<ComponentInstance[]> {
  return (await readSidebarState()).components;
}

export async function addComponent(comp: ComponentInstance): Promise<ComponentInstance> {
  const state = await readSidebarState();
  state.components.push(comp);
  await writeSidebarState(state);
  return comp;
}

export async function updateComponent(id: string, patch: Partial<ComponentInstance>): Promise<ComponentInstance | null> {
  const state = await readSidebarState();
  const idx = state.components.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  state.components[idx] = { ...state.components[idx], ...patch, id };
  await writeSidebarState(state);
  return state.components[idx];
}

export async function deleteComponent(id: string): Promise<boolean> {
  const state = await readSidebarState();
  const before = state.components.length;
  state.components = state.components.filter((c) => c.id !== id);
  state.connections = state.connections.filter(
    (c) => c.sourceComponentId !== id && c.targetComponentId !== id
  );
  state.diagrams = state.diagrams.map((d) => ({
    ...d,
    componentIds: d.componentIds.filter((cid) => cid !== id),
    connectionIds: d.connectionIds.filter((cid) => {
      const conn = state.connections.find((c) => c.id === cid);
      return conn !== undefined;
    }),
    positions: Object.fromEntries(Object.entries(d.positions).filter(([k]) => k !== id))
  }));
  if (state.components.length === before) return false;
  await writeSidebarState(state);
  return true;
}

// ── Connections ──────────────────────────────────────────────────────────────

export async function getConnections(): Promise<ConnectionInstance[]> {
  return (await readSidebarState()).connections;
}

export async function addConnection(conn: ConnectionInstance): Promise<ConnectionInstance> {
  const state = await readSidebarState();
  state.connections.push(conn);
  await writeSidebarState(state);
  return conn;
}

export async function updateConnection(id: string, patch: Partial<ConnectionInstance>): Promise<ConnectionInstance | null> {
  const state = await readSidebarState();
  const idx = state.connections.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  state.connections[idx] = { ...state.connections[idx], ...patch, id };
  await writeSidebarState(state);
  return state.connections[idx];
}

export async function deleteConnection(id: string): Promise<boolean> {
  const state = await readSidebarState();
  const before = state.connections.length;
  state.connections = state.connections.filter((c) => c.id !== id);
  state.diagrams = state.diagrams.map((d) => ({
    ...d,
    connectionIds: d.connectionIds.filter((cid) => cid !== id)
  }));
  if (state.connections.length === before) return false;
  await writeSidebarState(state);
  return true;
}

// ── Diagrams ─────────────────────────────────────────────────────────────────

export async function getDiagrams(): Promise<Diagram[]> {
  return (await readSidebarState()).diagrams;
}

export async function addDiagram(diagram: Diagram): Promise<Diagram> {
  const state = await readSidebarState();
  state.diagrams.push(diagram);
  await writeSidebarState(state);
  return diagram;
}

export async function updateDiagram(id: string, patch: Partial<Diagram>): Promise<Diagram | null> {
  const state = await readSidebarState();
  const idx = state.diagrams.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  state.diagrams[idx] = { ...state.diagrams[idx], ...patch, id };
  await writeSidebarState(state);
  return state.diagrams[idx];
}

export async function deleteDiagram(id: string): Promise<boolean> {
  const state = await readSidebarState();
  const before = state.diagrams.length;
  state.diagrams = state.diagrams.filter((d) => d.id !== id);
  if (state.diagrams.length === before) return false;
  await writeSidebarState(state);
  return true;
}
