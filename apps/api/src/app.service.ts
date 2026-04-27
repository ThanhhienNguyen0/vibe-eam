import { Injectable } from '@nestjs/common';
import { EAMData, Application, Server, Database } from '../../../packages/shared/src/index';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

@Injectable()
export class AppService {
  private eamData: EAMData = {
    applications: [],
    servers: [],
    databases: []
  };

  getInventory(): EAMData {
    return this.eamData;
  }

  processCsv(filePath: string): number {
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
    });

    this.eamData = {
      applications: [],
      servers: [],
      databases: []
    };

    records.forEach((row: any) => {
      const type = row.Type?.toLowerCase() || row.type?.toLowerCase();
      const asset = {
        id: row.ID || row.id || Math.random().toString(36).substr(2, 9),
        name: row.Name || row.name || "Unnamed Asset",
        description: row.Description || row.description || ""
      };

      if (type === "application") {
        this.eamData.applications.push({
          ...asset,
          type: "Application",
          technology: row.Technology || row.technology,
          owner: row.Owner || row.owner,
          dependencies: row.Dependencies?.split(",").map((d: string) => d.trim()) || []
        } as Application);
      } else if (type === "server") {
        this.eamData.servers.push({
          ...asset,
          type: "Server",
          os: row.OS || row.os,
          location: row.Location || row.location,
          ipAddress: row.IP || row.ip
        } as Server);
      } else if (type === "database") {
        this.eamData.databases.push({
          ...asset,
          type: "Database",
          dbType: row.DBType || row.dbtype,
          version: row.Version || row.version
        } as Database);
      }
    });

    return records.length;
  }
}
