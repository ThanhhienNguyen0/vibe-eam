import { IsString, IsUUID, Length } from 'class-validator';

export class CreateDiagramDto {
  @IsUUID('all')
  branchId!: string;

  @IsString()
  @Length(1, 120)
  name!: string;
}

