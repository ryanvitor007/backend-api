import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsNumber,
  ValidateNested,
} from 'class-validator';

// 1. Criação do DTO específico para o objeto aninhado
export class ChecklistDto {
  @IsOptional()
  @IsObject()
  items?: Record<string, boolean>;

  @IsOptional()
  @IsString()
  notes?: string;
}

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

  @Transform(({ value }) => (typeof value === 'string' ? Number(value) : value))
  @IsNumber()
  @IsNotEmpty()
  startOdometer: number;

  // 2. Uso do ValidateNested para blindar o objeto contra o whitelist
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
    return value;
  })
  @ValidateNested()
  @Type(() => ChecklistDto)
  checklist?: ChecklistDto;
}
