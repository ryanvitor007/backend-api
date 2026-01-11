export class CreateVehicleDto {
  placa: string;
  modelo: string;
  ano: number;
  km_atual: number;
  renavam: string; // Importante para as consultas futuras
  status: string; // 'Ativo', 'Em Oficina', etc.
  cor: string;
  combustivel: string;
  chassi: string;
}
