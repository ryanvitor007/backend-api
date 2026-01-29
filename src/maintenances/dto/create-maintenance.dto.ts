import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateMaintenanceDto {
  @IsInt()
  @IsNotEmpty()
  vehicle_id: number;

  @IsOptional()
  @IsInt()
  driver_id?: number;

  @IsString()
  @IsNotEmpty()
  vehicle_plate: string;

  @IsString()
  @IsNotEmpty()
  vehicle_model: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  scheduled_date?: string; // ISO Date

  @IsOptional()
  cost?: number;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  km_at_maintenance?: number;

  @IsOptional()
  @IsString()
  invoice_url?: string; // Opcional

  @IsOptional()
  @IsObject()
  checklist_data?: Record<string, unknown>;
}
