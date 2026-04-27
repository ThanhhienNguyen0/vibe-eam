/**
 * Shared types for Enterprise Architecture Management
 */

export interface EAMAsset {
  id: string;
  name: string;
  type: 'Application' | 'Server' | 'Database';
  description?: string;
}

export interface Application extends EAMAsset {
  type: 'Application';
  technology?: string;
  owner?: string;
  dependencies: string[]; // IDs of other assets
}

export interface Server extends EAMAsset {
  type: 'Server';
  os?: string;
  location?: string;
  ipAddress?: string;
}

export interface Database extends EAMAsset {
  type: 'Database';
  dbType?: string;
  version?: string;
}

export type EAMData = {
  applications: Application[];
  servers: Server[];
  databases: Database[];
};
