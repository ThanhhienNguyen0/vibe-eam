import { ImportCsvDto } from './dto/import-csv.dto';
import { IoService } from './io.service';
export declare class IoController {
    private readonly io;
    constructor(io: IoService);
    exportCsv(branchId: string): Promise<{
        elementsCsv: string;
        relationsCsv: string;
    }>;
    importCsv(dto: ImportCsvDto): Promise<{
        upsertedElements: number;
        upsertedRelations: number;
    }>;
}
