import { IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateRelationDto {
  @IsUUID('all')
  branchId!: string;

  @IsOptional()
  @IsUUID('all')
  diagramId?: string;

  @IsString()
  @Length(1, 120)
  type!: string;

  @IsUUID('all')
  sourceKey!: string;

  @IsUUID('all')
  targetKey!: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

