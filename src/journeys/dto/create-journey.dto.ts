import { Type } from 'class-transformer';
import { IsObject, IsOptional } from 'class-validator';

export class CreateJourneyDto {
  driverId: number;
  vehicleId: number;
  startLocation: string;
  startOdometer: number;

  // Checklist Inicial e obrigatorio ao abrir jornada
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  checklist?: {
    items: Record<string, boolean>; // JSON com os itens marcados
    notes?: string;
  };
}
