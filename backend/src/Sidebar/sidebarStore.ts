import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ComponentInstance,
  ComponentType,
  ConnectionInstance,
  ConnectionRule,
  ConnectionType,
  Diagram,
  MetamodelDefinition,
  MetamodelImportResult,
  Metamodel,
  SidebarState,
  ValidationRule,
  ViewpointRule,
  Viewpoint
} from "./sidebarTypes.js";
import {
  applyMetamodelDefinition,
  extractMetamodelDefinition,
  validateMetamodelDefinition
} from "./metamodelConfig.js";
import {
  databasePersistenceEnabled,
  databaseSidebarRepository
} from "../persistence/databaseSidebarRepository.js";
import {
  assertValidConnectionEndpoints,
  diagramWithContents,
  removeComponentWithConnections
} from "../persistence/stateOperations.js";
import { cloneSidebarStateForCompany } from "../persistence/tenantState.js";
import { requireCompanyId } from "../tenant.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
const sidebarFile = path.join(dataDir, "sidebar.json");
const defaultMetamodelFile = path.join(dataDir, "default-metamodel.json");
const defaultMetamodelSourceFile = path.resolve(__dirname, "../../src/data/default-metamodel.json");

const DEFAULT_METAMODEL: Metamodel = {
  id: "mm-sme-eam",
  name: "SME EAM Metamodel",
  description: "Configurable metamodel for a lightweight SME Enterprise Architecture Management prototype.",
  version: "0.2.0",
  isActive: true,
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z"
};

const EAM_COMPONENT_TYPES: ComponentType[] = [
  {
    id: "ct-stakeholder",
    name: "Stakeholder",
    color: "#0891b2",
    icon: "user",
    description: "Person or role with an interest in the architecture.",
    customPropertyKeys: ["role", "department"],
    shape: "box",
    category: "EAM",
    layer: "Business",
    isStakeholderRelevant: true
  },
  {
    id: "ct-goal",
    name: "Goal / Objective",
    color: "#16a34a",
    icon: "target",
    description: "Business goal or measurable objective.",
    customPropertyKeys: ["metric", "targetDate"],
    shape: "box",
    category: "EAM",
    layer: "Motivation",
    isStakeholderRelevant: true
  },
  {
    id: "ct-capability",
    name: "Business Capability",
    color: "#0f766e",
    icon: "capability",
    description: "Stable business ability that the organization needs.",
    customPropertyKeys: ["owner", "criticality"],
    shape: "box",
    category: "EAM",
    layer: "Business",
    isStakeholderRelevant: true
  },
  {
    id: "ct-data-object",
    name: "Data Object",
    color: "#7c3aed",
    icon: "data",
    description: "Relevant business or application data object.",
    customPropertyKeys: ["dataOwner", "classification"],
    shape: "datastore",
    category: "EAM",
    layer: "Data"
  },
  {
    id: "ct-technology-node",
    name: "Technology Node",
    color: "#475569",
    icon: "server",
    description: "Infrastructure or runtime node used by applications.",
    customPropertyKeys: ["platform", "environment"],
    shape: "box",
    category: "EAM",
    layer: "Technology"
  },
  {
    id: "ct-org-unit",
    name: "Organizational Unit",
    color: "#c2410c",
    icon: "org",
    description: "Team, department or organizational unit.",
    customPropertyKeys: ["manager"],
    shape: "pool",
    category: "EAM",
    layer: "Business"
  }
];

const EAM_CONNECTION_TYPES: ConnectionType[] = [
  {
    id: "conn-realizes",
    name: "realizes",
    color: "#0f766e",
    lineStyle: "solid",
    allowedSourceTypeIds: ["ct-proc"],
    allowedTargetTypeIds: ["ct-capability"],
    description: "A business process realizes a business capability.",
    category: "EAM",
    directionDescription: "Process to capability"
  },
  {
    id: "conn-serves",
    name: "serves",
    color: "#2563eb",
    lineStyle: "solid",
    allowedSourceTypeIds: ["ct-app"],
    allowedTargetTypeIds: ["ct-proc", "ct-capability"],
    description: "An application serves a process or capability.",
    category: "EAM",
    requiredForSourceTypes: ["ct-app"],
    directionDescription: "Application to business need"
  },
  {
    id: "conn-uses",
    name: "uses",
    color: "#7c3aed",
    lineStyle: "solid",
    allowedSourceTypeIds: ["ct-app"],
    allowedTargetTypeIds: ["ct-data-object"],
    description: "An application uses a data object.",
    category: "EAM",
    directionDescription: "Application to data"
  },
  {
    id: "conn-depends-on",
    name: "depends_on",
    color: "#dc2626",
    lineStyle: "dashed",
    allowedSourceTypeIds: ["ct-app", "ct-data-object", "ct-technology-node"],
    allowedTargetTypeIds: ["ct-app", "ct-technology-node"],
    description: "A component depends on another application or technology node.",
    category: "EAM",
    directionDescription: "Dependent to provider"
  },
  {
    id: "conn-owns",
    name: "owns",
    color: "#c2410c",
    lineStyle: "solid",
    allowedSourceTypeIds: ["ct-stakeholder", "ct-org-unit"],
    allowedTargetTypeIds: ["ct-app", "ct-data-object", "ct-capability"],
    description: "A stakeholder or organizational unit owns an architecture object.",
    category: "EAM",
    directionDescription: "Owner to owned object"
  },
  {
    id: "conn-responsible-for",
    name: "responsible_for",
    color: "#ea580c",
    lineStyle: "solid",
    allowedSourceTypeIds: ["ct-stakeholder", "ct-org-unit"],
    allowedTargetTypeIds: ["ct-app", "ct-proc", "ct-capability"],
    description: "A stakeholder is responsible for an element.",
    category: "EAM",
    directionDescription: "Responsible role to object"
  },
  {
    id: "conn-interested-in",
    name: "interested_in",
    color: "#0891b2",
    lineStyle: "dotted",
    allowedSourceTypeIds: ["ct-stakeholder"],
    allowedTargetTypeIds: ["ct-capability", "ct-goal", "ct-app"],
    description: "A stakeholder is interested in an architecture object.",
    category: "EAM",
    directionDescription: "Stakeholder to interest"
  },
  {
    id: "conn-supports",
    name: "supports",
    color: "#16a34a",
    lineStyle: "solid",
    allowedSourceTypeIds: ["ct-goal", "ct-app"],
    allowedTargetTypeIds: ["ct-capability", "ct-goal"],
    description: "A goal or application supports another goal or capability.",
    category: "EAM",
    directionDescription: "Supporter to supported object"
  },
  {
    id: "conn-reports-to",
    name: "reports_to",
    color: "#64748b",
    lineStyle: "dashed",
    allowedSourceTypeIds: ["ct-stakeholder", "ct-org-unit"],
    allowedTargetTypeIds: ["ct-stakeholder", "ct-org-unit"],
    description: "A reporting relationship between stakeholders or units.",
    category: "EAM",
    directionDescription: "Reporter to accountable role"
  }
];

const EAM_CONNECTION_RULES: ConnectionRule[] = [
  {
    id: "rule-process-realizes-capability",
    sourceComponentTypeId: "ct-proc",
    connectionTypeId: "conn-realizes",
    targetComponentTypeId: "ct-capability",
    allowed: true,
    required: false,
    severity: "error",
    description: "Business Process realizes Business Capability.",
    rationale: "Capabilities are operationalized through business processes.",
    viewpointIds: ["vp-business-owner", "vp-full-architecture"]
  },
  {
    id: "rule-application-serves-process",
    sourceComponentTypeId: "ct-app",
    connectionTypeId: "conn-serves",
    targetComponentTypeId: "ct-proc",
    allowed: true,
    required: true,
    severity: "error",
    description: "Application serves Business Process.",
    rationale: "Applications should be traceable to the business processes they support.",
    viewpointIds: ["vp-business-owner", "vp-full-architecture"],
    minOccurrences: 1
  },
  {
    id: "rule-application-serves-capability",
    sourceComponentTypeId: "ct-app",
    connectionTypeId: "conn-serves",
    targetComponentTypeId: "ct-capability",
    allowed: true,
    required: false,
    severity: "warning",
    description: "Application serves Business Capability.",
    rationale: "A direct application-to-capability relation is useful in management summaries but less precise than process-level mapping.",
    viewpointIds: ["vp-management", "vp-full-architecture"]
  },
  {
    id: "rule-application-uses-data-object",
    sourceComponentTypeId: "ct-app",
    connectionTypeId: "conn-uses",
    targetComponentTypeId: "ct-data-object",
    allowed: true,
    required: true,
    severity: "error",
    description: "Application uses Data Object.",
    rationale: "Application ownership and data dependencies should be visible for SME governance.",
    viewpointIds: ["vp-application-owner", "vp-it-operations", "vp-full-architecture"],
    minOccurrences: 1
  },
  {
    id: "rule-application-depends-technology",
    sourceComponentTypeId: "ct-app",
    connectionTypeId: "conn-depends-on",
    targetComponentTypeId: "ct-technology-node",
    allowed: true,
    required: false,
    severity: "error",
    description: "Application depends_on Technology Node.",
    rationale: "Operational dependencies connect applications to their runtime or infrastructure.",
    viewpointIds: ["vp-application-owner", "vp-it-operations", "vp-full-architecture"]
  },
  {
    id: "rule-application-depends-application",
    sourceComponentTypeId: "ct-app",
    connectionTypeId: "conn-depends-on",
    targetComponentTypeId: "ct-app",
    allowed: true,
    required: false,
    severity: "error",
    description: "Application depends_on Application.",
    rationale: "Application-to-application dependencies are important for impact analysis.",
    viewpointIds: ["vp-application-owner", "vp-full-architecture"]
  },
  {
    id: "rule-data-depends-technology",
    sourceComponentTypeId: "ct-data-object",
    connectionTypeId: "conn-depends-on",
    targetComponentTypeId: "ct-technology-node",
    allowed: true,
    required: false,
    severity: "error",
    description: "Data Object depends_on Technology Node.",
    rationale: "Data objects may depend on storage or platform technology.",
    viewpointIds: ["vp-it-operations", "vp-full-architecture"]
  },
  {
    id: "rule-technology-depends-technology",
    sourceComponentTypeId: "ct-technology-node",
    connectionTypeId: "conn-depends-on",
    targetComponentTypeId: "ct-technology-node",
    allowed: true,
    required: false,
    severity: "error",
    description: "Technology Node depends_on Technology Node.",
    rationale: "Technology dependencies support operations-focused impact analysis.",
    viewpointIds: ["vp-it-operations", "vp-full-architecture"]
  },
  {
    id: "rule-stakeholder-responsible-application",
    sourceComponentTypeId: "ct-stakeholder",
    connectionTypeId: "conn-responsible-for",
    targetComponentTypeId: "ct-app",
    allowed: true,
    required: false,
    severity: "error",
    description: "Stakeholder responsible_for Application.",
    rationale: "Stakeholders are model elements so responsibility is visible in diagrams.",
    viewpointIds: ["vp-business-owner", "vp-application-owner", "vp-full-architecture"]
  },
  {
    id: "rule-stakeholder-responsible-capability",
    sourceComponentTypeId: "ct-stakeholder",
    connectionTypeId: "conn-responsible-for",
    targetComponentTypeId: "ct-capability",
    allowed: true,
    required: false,
    severity: "error",
    description: "Stakeholder responsible_for Business Capability.",
    rationale: "Capability accountability helps SMEs assign ownership.",
    viewpointIds: ["vp-business-owner", "vp-full-architecture"]
  },
  {
    id: "rule-stakeholder-interested-goal",
    sourceComponentTypeId: "ct-stakeholder",
    connectionTypeId: "conn-interested-in",
    targetComponentTypeId: "ct-goal",
    allowed: true,
    required: false,
    severity: "warning",
    description: "Stakeholder interested_in Goal / Objective.",
    rationale: "Stakeholder interests explain why a goal matters.",
    viewpointIds: ["vp-management", "vp-full-architecture"]
  },
  {
    id: "rule-stakeholder-interested-capability",
    sourceComponentTypeId: "ct-stakeholder",
    connectionTypeId: "conn-interested-in",
    targetComponentTypeId: "ct-capability",
    allowed: true,
    required: false,
    severity: "warning",
    description: "Stakeholder interested_in Business Capability.",
    rationale: "Management and business views benefit from explicit stakeholder interest.",
    viewpointIds: ["vp-management", "vp-full-architecture"]
  },
  {
    id: "rule-org-owns-application",
    sourceComponentTypeId: "ct-org-unit",
    connectionTypeId: "conn-owns",
    targetComponentTypeId: "ct-app",
    allowed: true,
    required: false,
    severity: "error",
    description: "Organizational Unit owns Application.",
    rationale: "Application ownership should be assigned to a real organizational unit.",
    viewpointIds: ["vp-application-owner", "vp-full-architecture"]
  },
  {
    id: "rule-org-owns-process",
    sourceComponentTypeId: "ct-org-unit",
    connectionTypeId: "conn-owns",
    targetComponentTypeId: "ct-proc",
    allowed: true,
    required: false,
    severity: "error",
    description: "Organizational Unit owns Business Process.",
    rationale: "Process ownership helps SMEs keep responsibility explicit.",
    viewpointIds: ["vp-business-owner", "vp-full-architecture"]
  },
  {
    id: "rule-goal-supports-capability",
    sourceComponentTypeId: "ct-goal",
    connectionTypeId: "conn-supports",
    targetComponentTypeId: "ct-capability",
    allowed: true,
    required: false,
    severity: "warning",
    description: "Goal / Objective supports Business Capability.",
    rationale: "Goals explain the business intent behind capabilities.",
    viewpointIds: ["vp-management", "vp-full-architecture"]
  }
];

const EAM_VIEWPOINTS: Viewpoint[] = [
  {
    id: "vp-management",
    name: "Management View",
    description: "Executive overview of business-critical architecture elements.",
    stakeholderRole: "Management",
    purpose: "Schnelle Uebersicht ueber geschaeftskritische Architekturteile.",
    allowedComponentTypeIds: ["ct-stakeholder", "ct-goal", "ct-capability", "ct-app"],
    allowedConnectionTypeIds: ["conn-interested-in", "conn-supports", "conn-serves"],
    requiredComponentTypeIds: ["ct-capability"],
    requiredConnectionTypeIds: [],
    maxVisibleLayers: 2
  },
  {
    id: "vp-business-owner",
    name: "Business Owner View",
    description: "Business processes, capabilities and supporting applications.",
    stakeholderRole: "Business Owner",
    purpose: "Geschaeftsprozesse, Capabilities und unterstuetzende Anwendungen verstehen.",
    allowedComponentTypeIds: ["ct-capability", "ct-proc", "ct-app", "ct-stakeholder"],
    allowedConnectionTypeIds: ["conn-realizes", "conn-serves", "conn-responsible-for"],
    requiredComponentTypeIds: ["ct-capability"],
    requiredConnectionTypeIds: ["conn-serves"],
    maxVisibleLayers: 2
  },
  {
    id: "vp-application-owner",
    name: "Application Owner View",
    description: "Application, data and technology dependencies.",
    stakeholderRole: "Application Owner",
    purpose: "Anwendungsabhaengigkeiten und Datenabhaengigkeiten verstehen.",
    allowedComponentTypeIds: ["ct-app", "ct-data-object", "ct-technology-node", "ct-stakeholder"],
    allowedConnectionTypeIds: ["conn-uses", "conn-depends-on", "conn-owns", "conn-responsible-for"],
    requiredComponentTypeIds: ["ct-app"],
    requiredConnectionTypeIds: ["conn-uses"],
    maxVisibleLayers: 3
  },
  {
    id: "vp-it-operations",
    name: "IT Operations View",
    description: "Operational dependencies between applications, data and technology.",
    stakeholderRole: "IT Operations",
    purpose: "Technische Betriebsabhaengigkeiten analysieren.",
    allowedComponentTypeIds: ["ct-app", "ct-technology-node", "ct-data-object"],
    allowedConnectionTypeIds: ["conn-depends-on", "conn-uses"],
    requiredComponentTypeIds: ["ct-technology-node"],
    requiredConnectionTypeIds: ["conn-depends-on"],
    maxVisibleLayers: 3
  },
  {
    id: "vp-full-architecture",
    name: "Full Architecture View",
    description: "Complete architecture view for architects.",
    stakeholderRole: "Architect",
    purpose: "Vollstaendige Sicht fuer Architekt:innen.",
    allowedComponentTypeIds: ["ct-stakeholder", "ct-goal", "ct-capability", "ct-proc", "ct-app", "ct-data-object", "ct-technology-node", "ct-org-unit"],
    allowedConnectionTypeIds: EAM_CONNECTION_TYPES.map((type) => type.id),
    requiredComponentTypeIds: [],
    requiredConnectionTypeIds: []
  }
];

function connectionRuleIdsForViewpoint(viewpointId: string): string[] {
  return EAM_CONNECTION_RULES
    .filter((rule) => !rule.viewpointIds || rule.viewpointIds.length === 0 || rule.viewpointIds.includes(viewpointId))
    .map((rule) => rule.id);
}

function viewpointRuleFromViewpoint(viewpoint: Viewpoint): ViewpointRule {
  return {
    id: `vpr-${viewpoint.id}`,
    viewpointId: viewpoint.id,
    allowedComponentTypeIds: viewpoint.allowedComponentTypeIds,
    allowedConnectionTypeIds: viewpoint.allowedConnectionTypeIds,
    allowedConnectionRuleIds: connectionRuleIdsForViewpoint(viewpoint.id),
    requiredComponentTypeIds: viewpoint.requiredComponentTypeIds,
    requiredConnectionTypeIds: viewpoint.requiredConnectionTypeIds,
    requiredConnectionRuleIds: viewpoint.requiredConnectionRuleIds ?? [],
    description: `${viewpoint.name} rule set derived from the stakeholder viewpoint definition.`,
    visibleComponentTypeIds: viewpoint.allowedComponentTypeIds,
    severity: "error"
  };
}

const EAM_VIEWPOINT_RULES: ViewpointRule[] = EAM_VIEWPOINTS.map(viewpointRuleFromViewpoint);

const EAM_VALIDATION_RULES: ValidationRule[] = [
  {
    id: "vr-application-has-responsible-stakeholder",
    name: "Application has responsible stakeholder",
    description: "Every application should have an accountable stakeholder modelled explicitly.",
    scope: "metamodel",
    sourceComponentTypeId: "ct-app",
    requiredConnectionTypeId: "conn-responsible-for",
    targetComponentTypeId: "ct-stakeholder",
    direction: "incoming",
    minOccurrences: 1,
    severity: "warning",
    message: "Application should have at least one responsible Stakeholder.",
    active: true
  },
  {
    id: "vr-capability-realized-by-process",
    name: "Business Capability is realized",
    description: "Every business capability should be realized by at least one business process.",
    scope: "metamodel",
    sourceComponentTypeId: "ct-capability",
    requiredConnectionTypeId: "conn-realizes",
    targetComponentTypeId: "ct-proc",
    direction: "incoming",
    minOccurrences: 1,
    severity: "warning",
    message: "Business Capability should be realized by at least one Business Process.",
    active: true
  },
  {
    id: "vr-application-serves-process",
    name: "Application serves process",
    description: "Every application should be traceable to at least one supported business process.",
    scope: "metamodel",
    sourceComponentTypeId: "ct-app",
    requiredConnectionTypeId: "conn-serves",
    targetComponentTypeId: "ct-proc",
    direction: "outgoing",
    minOccurrences: 1,
    severity: "warning",
    message: "Application should serve at least one Business Process.",
    active: true
  },
  {
    id: "vr-application-has-technology-dependency",
    name: "Application has technology dependency",
    description: "MVP approximation for data-or-technology dependency quality checks.",
    scope: "metamodel",
    sourceComponentTypeId: "ct-app",
    requiredConnectionTypeId: "conn-depends-on",
    targetComponentTypeId: "ct-technology-node",
    direction: "outgoing",
    minOccurrences: 1,
    severity: "warning",
    message: "Application should depend on at least one Technology Node.",
    active: true
  }
];

const EAM_COMPONENTS: ComponentInstance[] = [
  { id: "comp-head-sales", name: "Head of Sales", componentTypeId: "ct-stakeholder", properties: { role: "Head of Sales" }, description: "Sales leadership stakeholder." },
  { id: "comp-reduce-order-effort", name: "Reduce manual order effort", componentTypeId: "ct-goal", properties: { metric: "Manual effort" }, description: "Goal to reduce manual effort in order handling." },
  { id: "comp-order-management", name: "Order Management", componentTypeId: "ct-capability", properties: { criticality: "high" }, description: "Capability for handling customer orders." },
  { id: "comp-order-to-cash", name: "Order to Cash", componentTypeId: "ct-proc", properties: { owner: "Sales Operations" }, description: "Business process from order entry to payment." },
  { id: "comp-erp-system", name: "ERP System", componentTypeId: "ct-app", properties: { owner: "IT Applications" }, description: "Core ERP application." },
  { id: "comp-invoice-data", name: "Invoice Data", componentTypeId: "ct-data-object", properties: { dataOwner: "Finance" }, description: "Invoice-related data object." },
  { id: "comp-db-cluster", name: "Database Cluster", componentTypeId: "ct-technology-node", properties: { platform: "PostgreSQL" }, description: "Database cluster for ERP data." }
];

const EAM_CONNECTIONS: ConnectionInstance[] = [
  { id: "cx-process-realizes-capability", name: "", connectionTypeId: "conn-realizes", sourceComponentId: "comp-order-to-cash", targetComponentId: "comp-order-management", description: "" },
  { id: "cx-app-serves-process", name: "", connectionTypeId: "conn-serves", sourceComponentId: "comp-erp-system", targetComponentId: "comp-order-to-cash", description: "" },
  { id: "cx-app-uses-data", name: "", connectionTypeId: "conn-uses", sourceComponentId: "comp-erp-system", targetComponentId: "comp-invoice-data", description: "" },
  { id: "cx-app-depends-tech", name: "", connectionTypeId: "conn-depends-on", sourceComponentId: "comp-erp-system", targetComponentId: "comp-db-cluster", description: "" },
  { id: "cx-stakeholder-interested-capability", name: "", connectionTypeId: "conn-interested-in", sourceComponentId: "comp-head-sales", targetComponentId: "comp-order-management", description: "" },
  { id: "cx-stakeholder-responsible-app", name: "", connectionTypeId: "conn-responsible-for", sourceComponentId: "comp-head-sales", targetComponentId: "comp-erp-system", description: "" },
  { id: "cx-goal-supports-capability", name: "", connectionTypeId: "conn-supports", sourceComponentId: "comp-reduce-order-effort", targetComponentId: "comp-order-management", description: "" }
];

const defaultState: SidebarState = {
  metamodel: DEFAULT_METAMODEL,
  componentTypes: [
    ...EAM_COMPONENT_TYPES,
    {
      id: "ct-app",
      name: "Application",
      color: "#2563eb",
      icon: "app",
      description: "A software application component.",
      customPropertyKeys: ["version", "owner"],
      category: "EAM",
      layer: "Application"
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
      customPropertyKeys: ["engine", "version"],
      shape: "datastore"
    },
    {
      id: "ct-proc",
      name: "Business Process",
      color: "#0f766e",
      icon: "proc",
      description: "A business process.",
      customPropertyKeys: ["owner", "sla"],
      shape: "process",
      category: "EAM",
      layer: "Business"
    },
    {
      id: "ct-svc",
      name: "Service",
      color: "#c2410c",
      icon: "svc",
      description: "An external or internal service.",
      customPropertyKeys: ["endpoint", "owner"]
    },
    {
      id: "ct-pool",
      name: "Pool",
      color: "#0e7490",
      icon: "box",
      description: "BPMN-Pool / Container für Verantwortungsbereiche.",
      customPropertyKeys: ["verantwortlich"],
      shape: "pool",
      category: "BPMN"
    },
    {
      id: "ct-task",
      name: "Aufgabe",
      color: "#2563eb",
      icon: "box",
      description: "BPMN-Aufgabe / Task.",
      customPropertyKeys: ["rolle"],
      shape: "process",
      category: "BPMN"
    },
    {
      id: "ct-event-start",
      name: "Start-Ereignis",
      color: "#16a34a",
      icon: "box",
      description: "BPMN-Start-Ereignis (dünner Kreis).",
      customPropertyKeys: ["ausloeser"],
      shape: "event-start",
      category: "BPMN"
    },
    {
      id: "ct-event",
      name: "Zwischenereignis",
      color: "#ca8a04",
      icon: "box",
      description: "BPMN-Zwischenereignis (Doppelkreis).",
      customPropertyKeys: ["ereignisart"],
      shape: "event",
      category: "BPMN"
    },
    {
      id: "ct-event-end",
      name: "End-Ereignis",
      color: "#dc2626",
      icon: "box",
      description: "BPMN-End-Ereignis (dicker Kreis).",
      customPropertyKeys: ["ergebnis"],
      shape: "event-end",
      category: "BPMN"
    },
    {
      id: "ct-gw-xor",
      name: "XOR-Gateway",
      color: "#9333ea",
      icon: "box",
      description: "Exklusives Gateway – genau ein Pfad wird gewählt.",
      customPropertyKeys: ["bedingung"],
      shape: "gateway-xor",
      category: "BPMN"
    },
    {
      id: "ct-gw-and",
      name: "AND-Gateway",
      color: "#9333ea",
      icon: "box",
      description: "Paralleles Gateway – alle Pfade werden ausgeführt.",
      customPropertyKeys: [],
      shape: "gateway-and",
      category: "BPMN"
    },
    {
      id: "ct-gw-or",
      name: "OR-Gateway",
      color: "#9333ea",
      icon: "box",
      description: "Inklusives Gateway – ein oder mehrere Pfade.",
      customPropertyKeys: ["bedingung"],
      shape: "gateway-or",
      category: "BPMN"
    }
  ],
  connectionTypes: [
    ...EAM_CONNECTION_TYPES,
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
    },
    {
      id: "conn-seq",
      name: "Sequenzfluss",
      color: "#172033",
      lineStyle: "solid",
      allowedSourceTypeIds: ["ct-event-start", "ct-task", "ct-event", "ct-gw-xor", "ct-gw-and", "ct-gw-or"],
      allowedTargetTypeIds: ["ct-event-end", "ct-task", "ct-event", "ct-gw-xor", "ct-gw-and", "ct-gw-or"],
      description: "BPMN-Sequenzfluss: Reihenfolge im Prozess. Start hat keinen Eingang, Ende keinen Ausgang, keine Pools.",
      category: "BPMN"
    },
    {
      id: "conn-msg",
      name: "Nachrichtenfluss",
      color: "#0e7490",
      lineStyle: "dashed",
      allowedSourceTypeIds: ["ct-pool", "ct-task", "ct-event-start", "ct-event", "ct-event-end"],
      allowedTargetTypeIds: ["ct-pool", "ct-task", "ct-event-start", "ct-event", "ct-event-end"],
      description: "BPMN-Nachrichtenfluss: Kommunikation zwischen Pools/Teilnehmern.",
      category: "BPMN"
    },
    {
      id: "conn-assoc",
      name: "Assoziation",
      color: "#94a3b8",
      lineStyle: "dotted",
      allowedSourceTypeIds: [],
      allowedTargetTypeIds: [],
      description: "BPMN-Assoziation: verknüpft Artefakte/Daten mit Flusselementen.",
      category: "BPMN"
    }
  ],
  connectionRules: EAM_CONNECTION_RULES,
  viewpointRules: EAM_VIEWPOINT_RULES,
  validationRules: EAM_VALIDATION_RULES,
  components: EAM_COMPONENTS,
  connections: EAM_CONNECTIONS,
  diagrams: [
    {
      id: "diagram-order-management-demo",
      name: "Order Management Metamodel Demo",
      description: "Example diagram for the Metamodel Rule Builder.",
      componentIds: EAM_COMPONENTS.map((component) => component.id),
      connectionIds: EAM_CONNECTIONS.map((connection) => connection.id),
      metamodelId: DEFAULT_METAMODEL.id,
      viewpointId: "vp-full-architecture",
      positions: {
        "comp-head-sales": { x: -420, y: -120 },
        "comp-reduce-order-effort": { x: -420, y: 60 },
        "comp-order-management": { x: -120, y: -20 },
        "comp-order-to-cash": { x: 160, y: -20 },
        "comp-erp-system": { x: 440, y: -20 },
        "comp-invoice-data": { x: 720, y: -120 },
        "comp-db-cluster": { x: 720, y: 80 }
      }
    }
  ],
  viewpoints: EAM_VIEWPOINTS
};

const cachedByCompany = new Map<string, SidebarState>();

async function ensureFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(sidebarFile);
  } catch {
    await fs.writeFile(sidebarFile, JSON.stringify(defaultState, null, 2), "utf-8");
  }
}

function upsertById<T extends { id: string }>(items: T[], seeds: T[]): T[] {
  const existingIds = new Set(items.map((item) => item.id));
  return [...items, ...seeds.filter((seed) => !existingIds.has(seed.id))];
}

function isLegacyConnectionRule(rule: ConnectionRule): boolean {
  return rule.id.startsWith("legacy-rule-");
}

function withoutLegacyConnectionRuleRefs(rule: ViewpointRule): ViewpointRule {
  return {
    ...rule,
    allowedConnectionRuleIds: rule.allowedConnectionRuleIds.filter((id) => !id.startsWith("legacy-rule-")),
    requiredConnectionRuleIds: rule.requiredConnectionRuleIds.filter((id) => !id.startsWith("legacy-rule-"))
  };
}

function normalizeSidebarState(raw: Partial<SidebarState>): SidebarState {
  const metamodel = { ...DEFAULT_METAMODEL, ...(raw.metamodel ?? {}), updatedAt: raw.metamodel?.updatedAt ?? DEFAULT_METAMODEL.updatedAt };
  const componentTypes = upsertById(raw.componentTypes ?? [], EAM_COMPONENT_TYPES).map((type) => {
    if (type.id === "ct-app") return { ...type, category: type.category ?? "EAM", layer: type.layer ?? "Application" };
    if (type.id === "ct-proc") return { ...type, category: type.category ?? "EAM", layer: type.layer ?? "Business", shape: type.shape ?? "process" };
    if (type.id === "ct-server") return { ...type, layer: type.layer ?? "Technology" };
    if (type.id === "ct-db") return { ...type, layer: type.layer ?? "Data" };
    return { ...type, layer: type.layer ?? type.category ?? "Business" };
  });

  const connectionTypes = upsertById(raw.connectionTypes ?? [], EAM_CONNECTION_TYPES).map((type) => {
    if (type.id === "conn-dep") {
      return {
        ...type,
        name: type.name === "depends on" ? "depends_on" : type.name,
        directionDescription: type.directionDescription ?? "Dependent to provider"
      };
    }
    return {
      ...type,
      requiredForSourceTypes: type.requiredForSourceTypes ?? [],
      requiredForTargetTypes: type.requiredForTargetTypes ?? []
    };
  });

  const components = upsertById(raw.components ?? [], EAM_COMPONENTS);
  const connections = upsertById(raw.connections ?? [], EAM_CONNECTIONS);
  const viewpoints = upsertById(raw.viewpoints ?? [], EAM_VIEWPOINTS);
  const persistedConnectionRules = (raw.connectionRules ?? []).filter((rule) => !isLegacyConnectionRule(rule));
  const connectionRules = upsertById(persistedConnectionRules, EAM_CONNECTION_RULES);
  const derivedViewpointRules = viewpoints.map((viewpoint) => ({
    ...viewpointRuleFromViewpoint(viewpoint),
    allowedConnectionRuleIds: connectionRules
      .filter((rule) => !rule.viewpointIds || rule.viewpointIds.length === 0 || rule.viewpointIds.includes(viewpoint.id))
      .map((rule) => rule.id)
  }));
  const persistedViewpointRules = (raw.viewpointRules ?? []).map(withoutLegacyConnectionRuleRefs);
  const viewpointRules = upsertById(upsertById(persistedViewpointRules, EAM_VIEWPOINT_RULES), derivedViewpointRules);
  const validationRules = upsertById(raw.validationRules ?? [], EAM_VALIDATION_RULES);
  const diagrams = (raw.diagrams ?? []).map((diagram) => ({
    ...diagram,
    metamodelId: diagram.metamodelId ?? metamodel.id
  }));
  const demoDiagramExists = diagrams.some((diagram) => diagram.id === "diagram-order-management-demo");

  return {
    metamodel,
    componentTypes,
    connectionTypes,
    connectionRules,
    viewpointRules,
    validationRules,
    components,
    connections,
    viewpoints,
    diagrams: demoDiagramExists
      ? diagrams
      : [
          ...diagrams,
          {
            id: "diagram-order-management-demo",
            name: "Order Management Metamodel Demo",
            description: "Example diagram for the Metamodel Rule Builder.",
            componentIds: EAM_COMPONENTS.map((component) => component.id),
            connectionIds: EAM_CONNECTIONS.map((connection) => connection.id),
            metamodelId: metamodel.id,
            viewpointId: "vp-full-architecture",
            positions: {
              "comp-head-sales": { x: -420, y: -120 },
              "comp-reduce-order-effort": { x: -420, y: 60 },
              "comp-order-management": { x: -120, y: -20 },
              "comp-order-to-cash": { x: 160, y: -20 },
              "comp-erp-system": { x: 440, y: -20 },
              "comp-invoice-data": { x: 720, y: -120 },
              "comp-db-cluster": { x: 720, y: 80 }
            }
          }
        ]
  };
}

export async function readSidebarState(): Promise<SidebarState> {
  const companyId = requireCompanyId();
  const cached = cachedByCompany.get(companyId);
  if (cached) return structuredClone(cached);
  if (databasePersistenceEnabled()) {
    const persisted = await databaseSidebarRepository().read(companyId);
    if (persisted) {
      cachedByCompany.set(companyId, persisted);
      return structuredClone(persisted);
    }

    const legacy = await readLegacySidebarState();
    const initial = cloneSidebarStateForCompany(
      process.env.SEED_EXAMPLES === "false" ? { ...legacy, components: [], connections: [], diagrams: [] } : legacy,
      companyId
    );
    const stored = await databaseSidebarRepository().write(initial, companyId);
    cachedByCompany.set(companyId, stored);
    return structuredClone(stored);
  }

  const companyFile = path.join(dataDir, `sidebar.${companyId}.json`);
  let state: SidebarState;
  try {
    state = normalizeSidebarState(JSON.parse(await fs.readFile(companyFile, "utf-8")) as Partial<SidebarState>);
  } catch {
    state = cloneSidebarStateForCompany(await readLegacySidebarState(), companyId);
  }
  cachedByCompany.set(companyId, state);
  await writeSidebarState(state);
  return structuredClone(state);
}

export async function readLegacySidebarState(): Promise<SidebarState> {
  await ensureFile();
  const raw = await fs.readFile(sidebarFile, "utf-8");
  return normalizeSidebarState(JSON.parse(raw) as Partial<SidebarState>);
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as unknown;
}

export async function exportMetamodelDefinition(): Promise<MetamodelDefinition> {
  const state = await readSidebarState();
  return extractMetamodelDefinition(state);
}

export async function readDefaultMetamodelDefinition(): Promise<MetamodelDefinition> {
  let raw: unknown;
  try {
    raw = await readJsonFile(defaultMetamodelFile);
  } catch {
    raw = await readJsonFile(defaultMetamodelSourceFile);
  }
  const validation = validateMetamodelDefinition(raw);
  if (!validation.success || !validation.definition) {
    const first = validation.errors[0]?.message ?? "Default metamodel JSON is invalid.";
    throw new Error(first);
  }
  return validation.definition;
}

export async function importMetamodelDefinition(input: unknown): Promise<MetamodelImportResult> {
  const validation = validateMetamodelDefinition(input);
  if (!validation.success || !validation.definition) {
    return validation;
  }
  const state = await readSidebarState();
  const importedComponentTypeIds = new Set(validation.definition.componentTypes.map((item) => item.id));
  const importedConnectionTypeIds = new Set(validation.definition.connectionTypes.map((item) => item.id));
  const incompatibleComponents = state.components.filter((item) => !importedComponentTypeIds.has(item.componentTypeId));
  const incompatibleConnections = state.connections.filter((item) => !importedConnectionTypeIds.has(item.connectionTypeId));
  if (incompatibleComponents.length > 0 || incompatibleConnections.length > 0) {
    return {
      success: false,
      errors: [{
        code: "IMPORT_WOULD_ORPHAN_INSTANCES",
        message: `Import rejected because it would orphan ${incompatibleComponents.length} component instance(s) and ${incompatibleConnections.length} connection instance(s).`,
        path: "metamodel"
      }],
      warnings: validation.warnings,
      importedCounts: validation.importedCounts
    };
  }
  await writeSidebarState(applyMetamodelDefinition(state, validation.definition));
  return {
    success: true,
    errors: [],
    warnings: validation.warnings,
    importedCounts: validation.importedCounts
  };
}

export async function writeSidebarState(state: SidebarState): Promise<SidebarState> {
  const companyId = requireCompanyId();
  let cached = structuredClone(state);
  if (databasePersistenceEnabled()) {
    cached = await databaseSidebarRepository().write(cached, companyId);
    cachedByCompany.set(companyId, cached);
    return structuredClone(cached);
  }
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, `sidebar.${companyId}.json`), JSON.stringify(cached, null, 2), "utf-8");
  cachedByCompany.set(companyId, cached);
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
  state.connectionTypes = state.connectionTypes.map((connectionType) => ({
    ...connectionType,
    allowedSourceTypeIds: connectionType.allowedSourceTypeIds.filter((typeId) => typeId !== id),
    allowedTargetTypeIds: connectionType.allowedTargetTypeIds.filter((typeId) => typeId !== id),
    requiredForSourceTypes: connectionType.requiredForSourceTypes?.filter((typeId) => typeId !== id),
    requiredForTargetTypes: connectionType.requiredForTargetTypes?.filter((typeId) => typeId !== id)
  }));
  state.connectionRules = state.connectionRules.filter(
    (rule) => rule.sourceComponentTypeId !== id && rule.targetComponentTypeId !== id
  );
  state.viewpointRules = state.viewpointRules.map((rule) => ({
    ...rule,
    allowedComponentTypeIds: rule.allowedComponentTypeIds.filter((typeId) => typeId !== id),
    requiredComponentTypeIds: rule.requiredComponentTypeIds.filter((typeId) => typeId !== id),
    editableComponentTypeIds: rule.editableComponentTypeIds?.filter((typeId) => typeId !== id),
    visibleComponentTypeIds: rule.visibleComponentTypeIds?.filter((typeId) => typeId !== id)
  }));
  state.validationRules = state.validationRules.filter(
    (rule) => rule.sourceComponentTypeId !== id && rule.targetComponentTypeId !== id
  );
  state.viewpoints = state.viewpoints.map((viewpoint) => ({
    ...viewpoint,
    allowedComponentTypeIds: viewpoint.allowedComponentTypeIds.filter((typeId) => typeId !== id),
    requiredComponentTypeIds: viewpoint.requiredComponentTypeIds.filter((typeId) => typeId !== id)
  }));
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
  state.connectionRules = state.connectionRules.filter((rule) => rule.connectionTypeId !== id);
  state.viewpointRules = state.viewpointRules.map((rule) => ({
    ...rule,
    allowedConnectionTypeIds: rule.allowedConnectionTypeIds.filter((connectionTypeId) => connectionTypeId !== id),
    requiredConnectionTypeIds: rule.requiredConnectionTypeIds.filter((connectionTypeId) => connectionTypeId !== id)
  }));
  state.validationRules = state.validationRules.filter((rule) => rule.requiredConnectionTypeId !== id);
  state.viewpoints = state.viewpoints.map((viewpoint) => ({
    ...viewpoint,
    allowedConnectionTypeIds: viewpoint.allowedConnectionTypeIds.filter((connectionTypeId) => connectionTypeId !== id),
    requiredConnectionTypeIds: viewpoint.requiredConnectionTypeIds.filter((connectionTypeId) => connectionTypeId !== id)
  }));
  if (state.connectionTypes.length === before) return false;
  await writeSidebarState(state);
  return true;
}

// Connection Rules

export async function getConnectionRules(): Promise<ConnectionRule[]> {
  return (await readSidebarState()).connectionRules;
}

export async function addConnectionRule(rule: ConnectionRule): Promise<ConnectionRule> {
  const state = await readSidebarState();
  state.connectionRules.push(rule);
  await writeSidebarState(state);
  return rule;
}

export async function updateConnectionRule(id: string, patch: Partial<ConnectionRule>): Promise<ConnectionRule | null> {
  const state = await readSidebarState();
  const idx = state.connectionRules.findIndex((rule) => rule.id === id);
  if (idx === -1) return null;
  state.connectionRules[idx] = { ...state.connectionRules[idx], ...patch, id };
  await writeSidebarState(state);
  return state.connectionRules[idx];
}

export async function deleteConnectionRule(id: string): Promise<boolean> {
  const state = await readSidebarState();
  const before = state.connectionRules.length;
  state.connectionRules = state.connectionRules.filter((rule) => rule.id !== id);
  state.viewpointRules = state.viewpointRules.map((rule) => ({
    ...rule,
    allowedConnectionRuleIds: rule.allowedConnectionRuleIds.filter((ruleId) => ruleId !== id),
    requiredConnectionRuleIds: rule.requiredConnectionRuleIds.filter((ruleId) => ruleId !== id)
  }));
  state.viewpoints = state.viewpoints.map((viewpoint) => ({
    ...viewpoint,
    requiredConnectionRuleIds: viewpoint.requiredConnectionRuleIds?.filter((ruleId) => ruleId !== id)
  }));
  if (state.connectionRules.length === before) return false;
  await writeSidebarState(state);
  return true;
}

// Viewpoints

export async function getViewpoints(): Promise<Viewpoint[]> {
  return (await readSidebarState()).viewpoints;
}

export async function addViewpoint(viewpoint: Viewpoint): Promise<Viewpoint> {
  const state = await readSidebarState();
  state.viewpoints.push(viewpoint);
  await writeSidebarState(state);
  return viewpoint;
}

export async function updateViewpoint(id: string, patch: Partial<Viewpoint>): Promise<Viewpoint | null> {
  const state = await readSidebarState();
  const idx = state.viewpoints.findIndex((viewpoint) => viewpoint.id === id);
  if (idx === -1) return null;
  state.viewpoints[idx] = { ...state.viewpoints[idx], ...patch, id };
  await writeSidebarState(state);
  return state.viewpoints[idx];
}

export async function deleteViewpoint(id: string): Promise<boolean> {
  const state = await readSidebarState();
  const before = state.viewpoints.length;
  state.viewpoints = state.viewpoints.filter((viewpoint) => viewpoint.id !== id);
  state.viewpointRules = state.viewpointRules.filter((rule) => rule.viewpointId !== id);
  state.validationRules = state.validationRules.filter((rule) => rule.viewpointId !== id);
  state.componentTypes = state.componentTypes.map((type) => ({
    ...type,
    allowedInViewpointIds: type.allowedInViewpointIds?.filter((viewpointId) => viewpointId !== id)
  }));
  state.diagrams = state.diagrams.map((diagram) => (
    diagram.viewpointId === id ? { ...diagram, viewpointId: undefined } : diagram
  ));
  if (state.viewpoints.length === before) return false;
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
  if (!state.components.some((component) => component.id === id)) return false;
  await writeSidebarState(removeComponentWithConnections(state, id));
  return true;
}

// ── Connections ──────────────────────────────────────────────────────────────

export async function getConnections(): Promise<ConnectionInstance[]> {
  return (await readSidebarState()).connections;
}

export async function addConnection(conn: ConnectionInstance): Promise<ConnectionInstance> {
  const state = await readSidebarState();
  assertValidConnectionEndpoints(state, conn);
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

export async function getDiagramWithContents(id: string): Promise<{
  diagram: Diagram;
  components: ComponentInstance[];
  connections: ConnectionInstance[];
} | null> {
  return diagramWithContents(await readSidebarState(), id);
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
