import {
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateElementDto {
  @IsUUID('all')
  branchId!: string;

  @IsOptional()
  @IsUUID('all')
  diagramId?: string;

  @IsString()
  @Length(1, 200)
  name!: string;

  @IsString()
  @Length(1, 120)
  archiType!: string;

  @IsString()
  @Length(1, 40)
  layer!: string;

  @IsOptional()
  @IsString()
  documentation?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endOfLife?: string;
}

