import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class ImportCsvDto {
  @IsUUID()
  branchId!: string;

  @IsString()
  @Length(0, 5_000_000)
  elementsCsv!: string;

  @IsOptional()
  @IsString()
  @Length(0, 5_000_000)
  relationsCsv?: string;
}

