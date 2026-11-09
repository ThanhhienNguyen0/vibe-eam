import {
  AppWindow, Box, Boxes, Building2, Cloud, Database, FileText, Network, Plug, Server, Shield, Target, User, Workflow,
  type LucideIcon
} from "lucide-react";

/** Icon keys stored in `ComponentType.icon` (see default metamodel) -> lucide icon. */
const ICON_BY_KEY: Record<string, LucideIcon> = {
  app: AppWindow,
  server: Server,
  db: Database,
  proc: Workflow,
  svc: Cloud,
  user: User,
  target: Target,
  capability: Boxes,
  data: FileText,
  org: Building2,
  network: Network,
  interface: Plug,
  security: Shield
};

/** Fallback for custom types: guess from the type name (German and English). */
const NAME_RULES: Array<[RegExp, LucideIcon]> = [
  [/(applikation|application|anwendung|\bapp\b|software)/i, AppWindow],
  [/(datenbank|database|\bdb\b|datastore|speicher)/i, Database],
  [/(server|technology|technologie|node|knoten|infrastruktur|hardware)/i, Server],
  [/(prozess|process|workflow|aufgabe|task)/i, Workflow],
  [/(service|dienst|cloud|\bapi\b)/i, Cloud],
  [/(stakeholder|person|rolle|role|nutzer|user|akteur)/i, User],
  [/(ziel|goal|objective)/i, Target],
  [/(capability|fähigkeit|faehigkeit)/i, Boxes],
  [/(daten|data|dokument|document)/i, FileText],
  [/(organi|abteilung|unit|team)/i, Building2],
  [/(schnittstelle|interface)/i, Plug],
  [/(netz|network)/i, Network],
  [/(sicherheit|security)/i, Shield]
];

export function resolveComponentIcon(iconKey: string | undefined, typeName: string | undefined, shape?: string): LucideIcon {
  if (iconKey && iconKey !== "box" && ICON_BY_KEY[iconKey]) return ICON_BY_KEY[iconKey];
  const name = typeName ?? "";
  for (const [pattern, icon] of NAME_RULES) {
    if (pattern.test(name)) return icon;
  }
  if (shape === "datastore") return Database;
  if (shape === "process") return Workflow;
  return Box;
}

interface ComponentTypeIconProps {
  icon?: string;
  typeName?: string;
  shape?: string;
  color?: string;
  size?: number;
  className?: string;
}

/** Small icon that tells at a glance whether something is an application, database, server, ... */
export default function ComponentTypeIcon({ icon, typeName, shape, color, size = 14, className }: ComponentTypeIconProps) {
  const Icon = resolveComponentIcon(icon, typeName, shape);
  return <Icon size={size} color={color} className={className} aria-hidden="true" />;
}
