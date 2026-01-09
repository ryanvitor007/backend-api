import { Controller, Get, Query } from '@nestjs/common';
import { DetranService } from './detran.service';

@Controller('detran')
export class DetranController {
  constructor(private readonly detranService: DetranService) {}

  @Get('consultar')
  async consultar(
    @Query('placa') placa: string,
    @Query('renavam') renavam: string,
  ) {
    return this.detranService.consultarVeiculo(placa, renavam);
  }
}
