export class CreateDocumentDto {
  vehicle_id?: number;
  vehicle_plate?: string; // Novo campo
  ipva_status: string;
  ipva_valor: number;
  ipva_vencimento: string;
  licenciamento_status: string;
  licenciamento_valor: number;
  licenciamento_vencimento: string;
  crlv_validade: string;
}
