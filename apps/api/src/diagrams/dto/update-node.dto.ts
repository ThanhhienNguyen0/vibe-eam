import { IsNumber, IsOptional } from 'class-validator';

export class UpdateDiagramNodeDto {
  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;
}

