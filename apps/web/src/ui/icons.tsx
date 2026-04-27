import {
  ArrowRight,
  Badge,
  Box,
  Cpu,
  Database,
  Handshake,
  Key,
  Layers,
  Link,
  Package,
  Plug,
  Server,
  Shuffle,
  Sparkles,
  Terminal,
  User,
  Users,
  Waypoints,
  Workflow,
  Wrench,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { IconKey } from '../catalog/archimateCatalog';

type IconProps = { size?: number; className?: string };

const map: Record<IconKey, ComponentType<IconProps>> = {
  user: User,
  users: Users,
  workflow: Workflow,
  badge: Badge,
  box: Box,
  waypoints: Waypoints,
  plug: Plug,
  database: Database,
  server: Server,
  cpu: Cpu,
  terminal: Terminal,
  wrench: Wrench,
  package: Package,
  handshake: Handshake,
  sparkles: Sparkles,
  link: Link,
  layers: Layers,
  'git-branch': Waypoints,
  key: Key,
  'arrow-right': ArrowRight,
  shuffle: Shuffle,
};

export function Icon({ name, size = 18, className }: { name: IconKey; size?: number; className?: string }) {
  const Cmp = map[name] ?? Box;
  return <Cmp size={size} className={className} />;
}

