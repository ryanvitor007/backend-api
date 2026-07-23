import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

/**
 * DTO responsável pela validação dos metadados enviados no cadastro
 * e auditoria de um disco de tacógrafo analógico.
 */
export class CreateTachographDto {
  @ApiProperty({
    description: 'Identificador único do motorista (UUID)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID(undefined, { message: 'O driverId deve ser um UUID válido' })
  @IsNotEmpty({ message: 'O driverId é obrigatório' })
  driverId: string;

  @ApiProperty({
    description: 'Identificador único do veículo (UUID)',
    example: 'b1fbc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @IsUUID(undefined, { message: 'O vehicleId deve ser um UUID válido' })
  @IsNotEmpty({ message: 'O vehicleId é obrigatório' })
  vehicleId: string;

  @ApiProperty({
    description: 'Data de registro no formato ISO 8601 (YYYY-MM-DD)',
    example: '2026-07-22',
  })
  @IsDateString({}, { message: 'A data deve estar no formato ISO 8601 válido' })
  @IsNotEmpty({ message: 'A data é obrigatória' })
  date: string;

  @ApiProperty({
    description: 'Horário de início da viagem (formato HH:mm)',
    example: '08:00',
  })
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'O horário de início deve estar no formato HH:mm (ex: 08:00)',
  })
  @IsString({ message: 'O startTime deve ser um texto' })
  @IsNotEmpty({ message: 'O horário de início (startTime) é obrigatório' })
  startTime: string;

  @ApiProperty({
    description: 'Horário de término da viagem (formato HH:mm)',
    example: '18:00',
  })
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'O horário de término deve estar no formato HH:mm (ex: 18:00)',
  })
  @IsString({ message: 'O endTime deve ser um texto' })
  @IsNotEmpty({ message: 'O horário de término (endTime) é obrigatório' })
  endTime: string;

  @ApiProperty({
    description: 'Quilometragem inicial do veículo (número inteiro positivo)',
    example: 120000,
  })
  @Type(() => Number)
  @Min(0, { message: 'A quilometragem inicial deve ser maior ou igual a 0' })
  @IsInt({ message: 'A quilometragem inicial deve ser um número inteiro' })
  @IsNotEmpty({ message: 'A quilometragem inicial (startKm) é obrigatória' })
  startKm: number;

  @ApiProperty({
    description: 'Quilometragem final do veículo (número inteiro maior que 0)',
    example: 120450,
  })
  @Type(() => Number)
  @Min(1, { message: 'A quilometragem final deve ser um número maior que 0' })
  @IsInt({ message: 'A quilometragem final deve ser um número inteiro' })
  @IsNotEmpty({ message: 'A quilometragem final (endKm) é obrigatória' })
  endKm: number;

  @ApiPropertyOptional({
    description: 'Observações adicionais fornecidas pelo motorista',
    example: 'Substituição preventiva do disco durante a parada.',
  })
  @IsOptional()
  @IsString({ message: 'A observação deve ser um texto' })
  observation?: string;
}
