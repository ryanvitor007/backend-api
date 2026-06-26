import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { DriversService } from './drivers.service';

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  @Roles('Admin', 'Operador')
  @Permissions('drivers:read')
  findAll(
    @Query('name') name?: string,
    @Query('active') active?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    const filters = { name, active: active !== undefined ? active === 'true' : undefined };
    return this.driversService.findAll(
      filters,
      page ? +page : 1,
      limit ? +limit : 10,
      sort || 'name',
      order || 'asc',
    );
  }

  @Get(':id')
  @Roles('Admin', 'Operador', 'Motorista')
  @Permissions('drivers:read', 'drivers:read-own')
  findOne(@Param('id') id: string) {
    return this.driversService.findOne(+id);
  }

  @Get(':id/history')
  @Roles('Admin', 'Operador', 'Motorista')
  @Permissions('drivers:read', 'drivers:read-own')
  findHistory(@Param('id') id: string) {
    return this.driversService.findHistory(+id);
  }

  @Get(':id/productivity')
  @Roles('Admin', 'Operador', 'Motorista')
  @Permissions('drivers:read', 'drivers:read-own')
  findProductivity(@Param('id') id: string) {
    return this.driversService.findProductivity(+id);
  }

  @Get(':id/inspections')
  @Roles('Admin', 'Operador', 'Motorista')
  @Permissions('inspections:read', 'inspections:read-own')
  findInspections(@Param('id') id: string) {
    return this.driversService.findInspections(+id);
  }
}
