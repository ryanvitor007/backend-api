export class CreateMaintenanceDto {
  vehicle_id: number;
  vehicle_plate: string;
  vehicle_model: string;
  type: string;
  description: string;
  scheduled_date: string; // ISO Date
  cost: number;
  status: string;
  provider: string;
  km_at_maintenance: number;
  invoice_url?: string; // Opcional
}
