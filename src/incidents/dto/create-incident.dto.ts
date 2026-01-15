export class CreateIncidentDto {
  type: string;
  date: string;
  time: string;
  vehiclePlate: string;
  vehicleModel: string; // Adicionado este campo
  driverName: string;
  location: string;
  description: string;
  estimatedCost: number;
  insuranceClaim: boolean | string; // Aceita string vinda do FormData ou boolean
  status?: string;
}
