import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { MaintenancesService } from './maintenances.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';

@Controller('maintenances')
export class MaintenancesController {
  constructor(private readonly service: MaintenancesService) {}

  @Post()
  create(@Body() dto: CreateMaintenanceDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Patch(':id/complete')
  complete(@Param('id') id: string) {
    return this.service.complete(+id);
  }

  @Patch(':id/resolve')
  resolve(@Param('id') id: string) {
    return this.service.resolve(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceDto) {
    return this.service.update(+id, dto);
  }
}
