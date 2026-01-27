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

  @IsString()
  @IsNotEmpty()
  startLocation: string;

  @IsNumber()
  @IsNotEmpty()
  startOdometer: number;

  // Checklist Inicial (Obrigatório validação de Objeto)
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  checklist?: {
    items: Record<string, boolean>;
    notes?: string;
  };
}
