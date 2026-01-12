import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete, // <--- Importe o Delete
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  create(@Body() createVehicleDto: CreateVehicleDto) {
    return this.vehiclesService.create(createVehicleDto);
  }

  @Get()
  findAll() {
    return this.vehiclesService.findAll();
  }

  // --- Adicione este bloco NOVO ---
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      // O '+' converte a string id para number
      return await this.vehiclesService.remove(+id);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro ao excluir veículo';
      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }
  // --------------------------------
}
