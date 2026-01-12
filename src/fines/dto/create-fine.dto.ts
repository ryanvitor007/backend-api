export class CreateFineDto {
  vehicle_id?: number; // Agora é opcional
  vehicle_plate?: string; // Novo campo
  driver_name: string;
  infraction_date: string;
  description: string;
  amount: number;
  points: number;
  status: string;
  due_date: string;
  location: string;
}
