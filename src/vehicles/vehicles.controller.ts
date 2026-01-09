import { Controller, Get, Post, Body } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import type { Vehicle } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  async create(@Body() createVehicleDto: CreateVehicleDto): Promise<Vehicle> {
    return await this.vehiclesService.create(createVehicleDto);
  }

  @Get()
  async findAll(): Promise<Vehicle[]> {
    return await this.vehiclesService.findAll();
  }
}
