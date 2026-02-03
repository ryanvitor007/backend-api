import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateMaintenanceDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  incident_id?: number;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  invoice_url?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  completed_date?: Date;

  @IsOptional()
  @IsString()
  notes?: string;
}
