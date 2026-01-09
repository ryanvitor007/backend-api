import { Controller, Get, Post, Body } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
// CORREÇÃO: Usamos 'import type' para dizer que Vehicle é apenas uma interface
import type { Vehicle } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  create(@Body() createVehicleDto: CreateVehicleDto): Vehicle {
    return this.vehiclesService.create(createVehicleDto);
  }

  @Get()
  findAll(): Vehicle[] {
    return this.vehiclesService.findAll();
  }
}
