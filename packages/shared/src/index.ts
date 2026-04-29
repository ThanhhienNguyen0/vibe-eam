/**
 * Shared types for Enterprise Architecture Management
 */

export type ArchiMateLayer = 'Business' | 'Application' | 'Technology' | 'Implementation';

export interface Lifecycle {
  startDate: string;
  endOfLife?: string;
  status: 'Development' | 'Production' | 'Retired';
}

export interface EAMAsset {
  id: string;
  name: string;
  type: string;
  description?: string;
  layer: ArchiMateLayer;
  lifecycle?: Lifecycle;
  risk?: 'Low' | 'Medium' | 'High';
  cost?: number;
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
  assets: EAMAsset[];
};
