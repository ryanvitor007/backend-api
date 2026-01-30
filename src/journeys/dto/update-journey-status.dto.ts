import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateJourneyStatusDto {
  @IsOptional()
  @IsIn(['active', 'cancelled'])
  status?: 'active' | 'cancelled';

  @IsOptional()
  @IsString()
  adminNotes?: string;

  @IsOptional()
  @IsString()
  blockReason?: string;

  @IsOptional()
  @IsBoolean()
  createMaintenance?: boolean;
}
