import { Injectable } from '@nestjs/common';
import { EAMData, EAMAsset, ArchiMateLayer, Criticality, HostType, RelationshipType } from '@shared/index';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

@Injectable()
export class AppService {
  private eamData: EAMData = {
    assets: [
      {
        id: 'BIZ-01',
        name: 'Order-to-Cash',
        type: 'Process',
        layer: 'Business',
        description: 'Primary customer fulfillment process',
        risk: 'Medium',
        cost: 12000,
        criticality: 'High',
        hostType: 'SaaS',
        relationships: [],
        lifecycle: { startDate: '2020-01-01', status: 'Active' }
      },
      {
        id: 'APP-01',
        name: 'Order Manager',
        type: 'SaaS',
        layer: 'Application',
        description: 'Core ordering platform',
        risk: 'Low',
        cost: 45000,
        criticality: 'Mission Critical',
        hostType: 'SaaS',
        lifecycle: { startDate: '2022-06-15', status: 'Active' },
        relationships: [
          { targetId: 'SRV-01', type: 'Serving/Usage' },
          { targetId: 'DB-01', type: 'Serving/Usage' }
        ]
      },
      {
        id: 'SRV-01',
        name: 'Production Node 01',
        type: 'Server 2022',
        layer: 'Technology',
        description: 'Cloud computing instance',
        risk: 'High',
        cost: 800,
        criticality: 'Medium',
        hostType: 'Cloud/PaaS',
        relationships: [],
        lifecycle: { startDate: '2023-01-01', status: 'Active' }
      },
      {
        id: 'DB-01',
        name: 'Inventory DB',
        type: 'PostgreSQL',
        layer: 'Technology',
        description: 'PostgreSQL storage Cluster',
        risk: 'Low',
        cost: 5000,
        criticality: 'High',
        hostType: 'On-Premise',
        relationships: [],
        lifecycle: { startDate: '2022-01-01', status: 'Active' }
      }
    ]
  };

  getInventory(): EAMData {
    return this.eamData;
  }

  addAsset(asset: EAMAsset): EAMAsset {
    const existingIndex = this.eamData.assets.findIndex(a => a.id === asset.id);
    if (existingIndex !== -1) {
      this.eamData.assets[existingIndex] = asset;
    } else {
      this.eamData.assets.push(asset);
    }
    return asset;
  }

  deleteAsset(id: string, force = false): { success: boolean; message: string; impacts?: string[] } {
    // Find all assets that target this asset
    const impacts = this.eamData.assets
      .filter(a => a.relationships?.some(r => r.targetId === id))
      .map(a => `${a.name} (${a.id})`);

    if (impacts.length > 0 && !force) {
      return {
        success: false,
        message: `Deletion Halte: This asset is required by ${impacts.length} other components.`,
        impacts
      };
    }

    const index = this.eamData.assets.findIndex(a => a.id === id);
    if (index === -1) return { success: false, message: "Asset not found" };

    this.eamData.assets.splice(index, 1);
    return { success: true, message: "Asset removed from repository" };
  }

  processFile(filePath: string, originalName: string): number {
    const ext = path.extname(originalName).toLowerCase();
    let records: any[] = [];

    try {
      if (ext === '.csv') {
        const content = fs.readFileSync(filePath, 'utf-8');
        records = parse(content, {
          columns: true,
          skip_empty_lines: true,
          relax_column_count: true,
          trim: true
        });
      } else if (ext === '.xlsx' || ext === '.xls') {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        records = XLSX.utils.sheet_to_json(worksheet);
      } else {
        throw new Error(`Unsupported file extension: ${ext}`);
      }
    } catch (err: any) {
      console.error("Parsing error:", err);
      throw new Error(`Failed to parse ${ext} file: ${err.message}`);
    }

    // Normalize records to handle case-insensitive headers and whitespace
    records = records.map(r => {
      const normalized: any = {};
      Object.keys(r).forEach(key => {
        normalized[key.trim().toLowerCase()] = r[key];
      });
      return normalized;
    });

    const newAssets: EAMAsset[] = records.map((record: any) => ({
      id: record.id || `ID-${Math.random().toString(36).substr(2, 9)}`,
      name: record.name || 'Unspecified Asset',
      type: record.type || 'Unspecified',
      layer: (record.layer || 'Application') as ArchiMateLayer,
      description: record.description || '',
      risk: record.risk || 'Low',
      cost: Number(record.cost) || 0,
      businessOwner: record.businessowner || '',
      itOwner: record.itowner || '',
      businessCapability: record.capability || '',
      process: record.process || '',
      criticality: (record.criticality || 'Medium') as Criticality,
      hostType: (record.hosttype || 'On-Premise') as HostType,
      version: record.version || '',
      relationships: record.dependencies ? 
        String(record.dependencies).split(',').map((s: string) => ({
          targetId: s.trim(),
          type: 'Serving/Usage' as RelationshipType
        })) : [],
      lifecycle: {
        startDate: record.startdate || new Date().toISOString().split('T')[0],
        endOfLife: record.eol || undefined,
        endOfSupport: record.eos || undefined,
        status: (record.status || 'Active') as any
      }
    }));

    const mergedAssets = [...this.eamData.assets];
    newAssets.forEach(newAsset => {
      const index = mergedAssets.findIndex(a => a.id === newAsset.id);
      if (index !== -1) {
        mergedAssets[index] = newAsset;
      } else {
        mergedAssets.push(newAsset);
      }
    });

    this.eamData.assets = mergedAssets;
    return newAssets.length;
  }
}
