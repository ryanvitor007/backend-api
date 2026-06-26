import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { InspectionsService } from './inspections.service';

@Controller('inspections')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Get()
  @Roles('Admin', 'Operador')
  @Permissions('inspections:read')
  findAll(
    @Query('status') status?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    const filters = { status, vehicleId: vehicleId ? +vehicleId : undefined, type };
    return this.inspectionsService.findAll(
      filters,
      page ? +page : 1,
      limit ? +limit : 10,
      sort,
      order,
    );
  }

  @Get('pending')
  @Roles('Admin', 'Operador')
  @Permissions('inspections:read')
  findPending() {
    return this.inspectionsService.findPending();
  }

  @Get('metrics')
  @Roles('Admin', 'Operador')
  @Permissions('inspections:read')
  getMetrics() {
    return this.inspectionsService.getMetrics();
  }

  @Post()
  @Roles('Admin', 'Operador', 'Motorista')
  @Permissions('inspections:create')
  create(
    @Body()
    body: {
      driverId: number;
      vehicleId: number;
      type: string;
      items: Record<string, boolean>;
      notes?: string;
    },
  ) {
    return this.inspectionsService.create(body);
  }

  @Patch(':id')
  @Roles('Admin', 'Operador')
  @Permissions('inspections:update')
  update(@Param('id') id: string, @Body() body: { status: string; notes?: string }) {
    return this.inspectionsService.update(+id, body);
  }

  @Delete(':id')
  @Roles('Admin')
  @Permissions('inspections:delete')
  remove(@Param('id') id: string) {
    return this.inspectionsService.remove(+id);
  }
}
