import { IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class UpdateRelationDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  type?: string;

  @IsOptional()
  @IsUUID()
  sourceKey?: string;

  @IsOptional()
  @IsUUID()
  targetKey?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

