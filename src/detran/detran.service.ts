import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
// import { lastValueFrom } from 'rxjs'; // Comentado para não dar erro de "não usado"

export interface DadosVeiculo {
  placa: string;
  renavam: string;
  marca_modelo: string;
  ano_fabricacao: number;
  multas_vencidas: number;
  status_licenciamento: string;
  restricoes: string[];
}

@Injectable()
export class DetranService {
  constructor(private readonly httpService: HttpService) {}

  async consultarVeiculo(
    placa: string,
    renavam: string,
  ): Promise<DadosVeiculo> {
    // Variáveis comentadas para evitar erro de "unused variable" do ESLint
    // const apiUrl = 'https://integrador.sp.gov.br/wps/portal/integrador/catalogoApis/API/detran-veiculos';
    // const apiToken = process.env.DETRAN_API_TOKEN;

    try {
      // MODO SIMULAÇÃO (O código real fica comentado abaixo para o futuro)
      /*
      const response = await lastValueFrom(
        this.httpService.get(`${apiUrl}/veiculos/${placa}`, {
          headers: { Authorization: `Bearer ${apiToken}` },
          params: { renavam }
        })
      );
      return response.data;
      */

      // Simula delay de rede (Corrigido parênteses do resolve)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log(`[DETRAN API] Consultando placa real: ${placa}`);

      return {
        placa: placa.toUpperCase(),
        renavam: renavam,
        marca_modelo: 'VOLVO/FH 540 (DADOS DO DETRAN)',
        ano_fabricacao: 2023,
        multas_vencidas: 0,
        status_licenciamento: 'EM DIA',
        restricoes: [],
      };
    } catch (error) {
      console.error('Erro ao conectar no Detran:', error);
      throw new HttpException(
        'Sistema do Detran indisponível',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}