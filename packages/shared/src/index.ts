/**
 * Shared types for Enterprise Architecture Management
 */

export type ArchiMateLayer = 'Business' | 'Application' | 'Technology' | 'Implementation';

export type RelationshipType = 'Serving/Usage' | 'Composition' | 'Flow' | 'Realization' | 'Influence';
export type Criticality = 'Low' | 'Medium' | 'High' | 'Mission Critical';
export type HostType = 'SaaS' | 'On-Premise' | 'Cloud/PaaS';

export interface EAMRelationship {
  targetId: string;
  type: RelationshipType;
  description?: string;
}

export interface Lifecycle {
  startDate: string;
  endOfLife?: string;
  endOfSupport?: string;
  status: 'Planning' | 'Active' | 'Retired';
}

export interface EAMAsset {
  id: string;
  name: string;
  type: string;
  description?: string;
  layer: ArchiMateLayer;
  lifecycle: Lifecycle;
  risk: 'Low' | 'Medium' | 'High';
  cost: number;
  
  // New Ownership fields
  businessOwner?: string;
  itOwner?: string;

  // Business Context
  businessCapability?: string;
  process?: string;
  criticality: Criticality;

  // Technical Stack
  hostType: HostType;
  version?: string;

  // Modernized Relationships
  relationships: EAMRelationship[];
}

export type EAMData = {
  assets: EAMAsset[];
};
