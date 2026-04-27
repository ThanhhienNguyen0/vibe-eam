import { IsUUID } from 'class-validator';

export class MergeBranchDto {
  @IsUUID('all')
  sourceBranchId!: string;

  @IsUUID('all')
  targetBranchId!: string;

  @IsUUID('all')
  actorUserId!: string;
}

