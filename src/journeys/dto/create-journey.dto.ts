import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsNumber,
} from 'class-validator';

export class CreateJourneyDto {
  @IsInt({ message: 'O ID do motorista deve ser um número inteiro' })
  @IsNotEmpty({ message: 'O ID do motorista é obrigatório' })
  driverId: number;

  @IsInt({ message: 'O ID do veículo deve ser um número inteiro' })
  @IsNotEmpty({ message: 'O ID do veículo é obrigatório' })
  vehicleId: number;

  @IsString({ message: 'A localização inicial deve ser um texto' })
  @IsNotEmpty({ message: 'A localização inicial é obrigatória' })
  startLocation: string;

  @IsNumber({}, { message: 'O hodômetro deve ser um número' })
  @IsNotEmpty({ message: 'O hodômetro inicial é obrigatório' })
  startOdometer: number;

  // Checklist Inicial e obrigatório ao abrir jornada
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  checklist?: any;
}
