export class CreateJourneyDto {
  driverId: number;
  vehicleId: number;
  startLocation: string;
  startOdometer: number;

  // Checklist Inicial é obrigatório ao abrir jornada
  checklist: {
    items: any; // JSON com os itens marcados
    notes?: string;
  };
}
