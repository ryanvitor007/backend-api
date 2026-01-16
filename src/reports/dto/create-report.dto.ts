export class CreateReportDto {
  title: string;
  startDate: string;
  endDate: string;
  vehicleIds: string; // Virá como string JSON ou separada por vírgula no FormData
  createdBy: string;
  type: string;
}
