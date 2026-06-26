import { IsNotEmpty, IsOptional, IsString, IsNumberString, IsDateString } from 'class-validator';

export class CreateTachographDto {
  @IsNotEmpty()
  driverId: string;

  @IsNotEmpty()
  vehicleId: string;

  @IsNotEmpty()
  @IsDateString()
  readingDate: string;

  @IsNotEmpty()
  @IsString()
  startAt: string;

  @IsNotEmpty()
  @IsString()
  endAt: string;

  @IsNotEmpty()
  @IsNumberString()
  kmStart: string;

  @IsNotEmpty()
  @IsNumberString()
  kmEnd: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
