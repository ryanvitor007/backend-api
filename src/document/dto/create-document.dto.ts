export class CreateDocumentDto {
  vehicle_id: number;
  type: string; // 'IPVA', 'Licenciamento', etc.
  ipva_status: string;
  ipva_valor: number;
  ipva_vencimento: string;
  licenciamento_status: string;
  licenciamento_valor: number;
  licenciamento_vencimento: string;
  crlv_validade: string;
}
