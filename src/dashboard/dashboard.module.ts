import { Module } from '@nestjs/common';
import { DashboardAggregationService } from './dashboard-aggregation.service';
import { DashboardController } from './dashboard.controller';

@Module({
  controllers: [DashboardController],
  providers: [DashboardAggregationService],
  exports: [DashboardAggregationService],
})
export class DashboardModule {}
