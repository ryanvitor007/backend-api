import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { DashboardAggregationService } from './dashboard-aggregation.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardAggregationService) {}

  @Get()
  @Roles('Admin', 'Operador')
  @Permissions('dashboard:read')
  @ApiOperation({ summary: 'Obter dados gerenciais gerais do dashboard' })
  getDashboardData() {
    return this.dashboardService.getDashboardData();
  }

  /**
   * Endpoint GET /dashboard/tachographs-stats
   * Retorna os KPIs de tacógrafos (pending, alerts, compliant, totalAtivos),
   * o gráfico de conformidade semanal (weeklyCompliance) e a distribuição de alertas (alertsDistribution).
   */
  @Get('tachographs-stats')
  @Roles('Admin', 'Operador', 'Motorista')
  @Permissions('dashboard:read', 'tachographs:read', 'tachographs:read-own')
  @ApiOperation({
    summary: 'Obter estatísticas agregadas de tacógrafos para o painel gerencial',
    description:
      'Retorna um JSON contendo KPIs (pending, alerts, compliant, totalAtivos), array de conformidade semanal para AreaChart do Recharts e distribuição de infrações para BarChart do Recharts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas e métricas de tacógrafos retornadas com sucesso.',
  })
  getTachographStats() {
    return this.dashboardService.getTachographStats();
  }
}
