import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
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
  @UseInterceptors(FileInterceptor('file'))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const parsedDto: UpdateMaintenanceDto = {
      ...dto,
      cost:
        typeof dto.cost === 'string' && dto.cost.trim() !== ''
          ? Number(dto.cost)
          : dto.cost,
      incident_id:
        typeof dto.incident_id === 'string' && dto.incident_id.trim() !== ''
          ? Number(dto.incident_id)
          : dto.incident_id,
    };

    if (typeof parsedDto.cost === 'number' && Number.isNaN(parsedDto.cost)) {
      delete parsedDto.cost;
    }

    if (
      typeof parsedDto.incident_id === 'number' &&
      Number.isNaN(parsedDto.incident_id)
    ) {
      delete parsedDto.incident_id;
    }

    return this.service.update(+id, parsedDto, file);
  }
}
