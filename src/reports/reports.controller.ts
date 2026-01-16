/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  Controller,
  Get,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Rota para o Front BUSCAR dados para preencher o PDF antes de gerar
  @Get('data')
  async getReportData(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('vehiclePlate') vehiclePlate: string,
  ) {
    return this.reportsService.getReportData(startDate, endDate, vehiclePlate);
  }

  // Rota para o Front ENVIAR o PDF gerado para arquivamento
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadReport(
    @Body() createReportDto: CreateReportDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.reportsService.saveReport(createReportDto, file);
  }

  // Rota para listar histórico de relatórios
  @Get()
  async findAll() {
    return this.reportsService.findAll();
  }
}
