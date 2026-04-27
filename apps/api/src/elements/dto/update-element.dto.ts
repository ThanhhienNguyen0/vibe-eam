import {
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class UpdateElementDto {
  @IsOptional()
  @IsUUID('all')
  diagramId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  archiType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  layer?: string;

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

