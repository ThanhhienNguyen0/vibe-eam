import { IsNumber, IsOptional, IsUUID } from 'class-validator';

export class CreateDiagramNodeDto {
  @IsUUID('all')
  diagramId!: string;

  @IsUUID('all')
  elementKey!: string;

  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;
}

