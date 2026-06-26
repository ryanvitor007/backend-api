import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { DashboardAggregationService } from './dashboard-aggregation.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardAggregationService) {}

  @Get()
  @Roles('Admin', 'Operador')
  @Permissions('dashboard:read')
  getDashboardData() {
    return this.dashboardService.getDashboardData();
  }
}
