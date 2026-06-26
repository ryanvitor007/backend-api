import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @Roles('Admin')
  @Permissions('vehicles:create')
  create(@Body() createVehicleDto: CreateVehicleDto) {
    return this.vehiclesService.create(createVehicleDto);
  }

  @Get()
  @Roles('Admin', 'Operador', 'Motorista')
  @Permissions('vehicles:read')
  findAll() {
    return this.vehiclesService.findAll();
  }

  @Get(':id')
  @Roles('Admin', 'Operador')
  @Permissions('vehicles:read')
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(+id);
  }

  @Patch(':id')
  @Roles('Admin')
  @Permissions('vehicles:update')
  update(@Param('id') id: string, @Body() updateVehicleDto: any) {
    return this.vehiclesService.update(+id, updateVehicleDto);
  }

  @Patch(':id/status')
  @Roles('Admin', 'Operador')
  @Permissions('vehicles:update')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.vehiclesService.updateStatus(+id, status);
  }

  @Delete(':id')
  @Roles('Admin')
  @Permissions('vehicles:delete')
  async remove(@Param('id') id: string) {
    try {
      return await this.vehiclesService.remove(+id);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro ao excluir veículo';
      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('consulta/:placa')
  @Roles('Admin')
  @Permissions('vehicles:create')
  async consultarPlaca(@Param('placa') placa: string) {
    try {
      return await this.vehiclesService.consultarPlacaInfosimples(placa);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erro interno ao consultar placa',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
