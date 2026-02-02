import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateIncidentDto {
  @IsString()
  type: string;

  @IsString()
  date: string;

  @IsString()
  time: string;

  @IsString()
  vehiclePlate: string;

  @IsString()
  vehicleModel: string; // Adicionado este campo

  @IsString()
  driverName: string;

  @IsString()
  location: string;

  @IsString()
  description: string;

  @IsNumber()
  @Type(() => Number)
  estimatedCost: number;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  insuranceClaim: boolean;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  journeyId?: number;
}
