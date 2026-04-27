export type ArchiLayer = 'Business' | 'Application' | 'Information' | 'Technology';
export type IconKey =
  | 'user'
  | 'users'
  | 'workflow'
  | 'badge'
  | 'box'
  | 'waypoints'
  | 'plug'
  | 'database'
  | 'server'
  | 'cpu'
  | 'terminal'
  | 'wrench'
  | 'package'
  | 'handshake'
  | 'sparkles'
  | 'link'
  | 'layers'
  | 'git-branch'
  | 'key'
  | 'arrow-right'
  | 'shuffle';

export class ElementType {
  readonly id: string;
  readonly label: string;
  readonly layer: ArchiLayer;
  readonly icon: IconKey;

  constructor(id: string, label: string, layer: ArchiLayer, icon: IconKey) {
    this.id = id;
    this.label = label;
    this.layer = layer;
    this.icon = icon;
  }
}

export class RelationType {
  readonly id: string;
  readonly label: string;
  readonly icon: IconKey;

  constructor(id: string, label: string, icon: IconKey) {
    this.id = id;
    this.label = label;
    this.icon = icon;
  }
}

export class ArchimateCatalog {
  // This is a pragmatic, prototype-level subset inspired by ArchiMate.
  // We can expand this to the full v3.1 metamodel incrementally.
  readonly elementTypes: ElementType[];
  readonly relationTypes: RelationType[];

  constructor() {
    this.elementTypes = [
      new ElementType('BusinessActor', 'Business Actor', 'Business', 'user'),
      new ElementType('BusinessRole', 'Business Role', 'Business', 'badge'),
      new ElementType('BusinessProcess', 'Business Process', 'Business', 'workflow'),
      new ElementType('BusinessService', 'Business Service', 'Business', 'handshake'),

      new ElementType('ApplicationComponent', 'Application Component', 'Application', 'box'),
      new ElementType('ApplicationService', 'Application Service', 'Application', 'sparkles'),
      new ElementType('ApplicationInterface', 'Application Interface', 'Application', 'plug'),

      new ElementType('DataObject', 'Data Object', 'Information', 'database'),

      new ElementType('Node', 'Node / Server', 'Technology', 'server'),
      new ElementType('Device', 'Device', 'Technology', 'cpu'),
      new ElementType('SystemSoftware', 'System Software', 'Technology', 'terminal'),
      new ElementType('TechnologyService', 'Technology Service', 'Technology', 'wrench'),
      new ElementType('Artifact', 'Artifact', 'Technology', 'package'),
    ];

    this.relationTypes = [
      new RelationType('serving', 'Serving', 'arrow-right'),
      new RelationType('realization', 'Realization', 'sparkles'),
      new RelationType('assignment', 'Assignment', 'key'),
      new RelationType('composition', 'Composition', 'layers'),
      new RelationType('aggregation', 'Aggregation', 'layers'),
      new RelationType('access', 'Access', 'key'),
      new RelationType('flow', 'Flow', 'shuffle'),
      new RelationType('triggering', 'Triggering', 'arrow-right'),
      new RelationType('influence', 'Influence', 'sparkles'),
      new RelationType('association', 'Association', 'link'),
    ];
  }

  getElementType(id: string): ElementType | undefined {
    return this.elementTypes.find((e) => e.id === id);
  }
}

export const archimateCatalog = new ArchimateCatalog();

