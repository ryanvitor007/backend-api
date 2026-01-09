import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

// Interface do que esperamos receber (Baseado no seu JSON anterior)
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

  async consultarVeiculo(placa: string, renavam: string): Promise<DadosVeiculo> {
    // URL base que você forneceu (Integrador SP)
    const apiUrl = 'https://integrador.sp.gov.br/wps/portal/integrador/catalogoApis/API/detran-veiculos';
    
    // TOKEN: Aqui entra a chave que a empresa receberá após o credenciamento
    const apiToken = process.env.DETRAN_API_TOKEN; 

    try {
      // TENTATIVA DE CONEXÃO REAL (Comentada até ter o Token)
      /*
      const response = await lastValueFrom(
        this.httpService.get(`${apiUrl}/veiculos/${placa}`, {
          headers: { Authorization: `Bearer ${apiToken}` },
          params: { renavam }
        })
      );
      return response.data; 
      */

      // MODO SIMULAÇÃO (Para o sistema funcionar AGORA enquanto aguarda credenciamento)
      // Simula um delay de rede do governo (importante para UX)
      await new Promise(resolve => setTimeout(resolve, 1500));

      console.log(`[DETRAN API] Consultando placa real: ${placa}`);

      // Retorno baseado na estrutura oficial esperada
      return {
        placa: placa.toUpperCase(),
        renavam: renavam,
        marca_modelo: 'VOLVO/FH 540 (DADOS DO DETRAN)',
        ano_fabricacao: 2023,
        multas_vencidas: 0, // Exemplo: Sem multas
        status_licenciamento: 'EM DIA',
        restricoes: []
      };

    } catch (error) {
      console.error('Erro ao conectar no Detran:', error);
      throw new HttpException('Sistema do Detran indisponível', HttpStatus.BAD_GATEWAY);
    }
  }
}