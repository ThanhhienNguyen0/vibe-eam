import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @IsUUID('all')
  baseBranchId?: string;

  @IsUUID('all')
  createdById!: string;
}

