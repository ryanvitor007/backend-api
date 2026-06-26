import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';

// Controllers e Services Principais
import { DetranController } from './detran/detran.controller';
import { DetranService } from './detran/detran.service';
import { VehiclesController } from './vehicles/vehicles.controller';
import { VehiclesService } from './vehicles/vehicles.service';

// Módulos da Aplicação
import { FinesModule } from './fines/fines.module';
import { DocumentsModule } from './document/documents.module';
import { MaintenancesModule } from './maintenances/maintenances.module';
import { IncidentsModule } from './incidents/incidents.module';
import { ReportsModule } from './reports/reports.module';
import { EmployeesModule } from './employees/employees.module';
import { JourneysModule } from './journeys/journeys.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';

// Novos Módulos Evoluídos
import { CommonModule } from './common/common.module';
import { StorageModule } from './storage/storage.module';
import { AuditModule } from './audit/audit.module';
import { DriversModule } from './drivers/drivers.module';
import { InspectionsModule } from './inspections/inspections.module';
import { TachographsModule } from './tachographs/tachographs.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    HttpModule,
    DatabaseModule,
    FinesModule,
    DocumentsModule,
    MaintenancesModule,
    IncidentsModule,
    ReportsModule,
    EmployeesModule,
    AuthModule,
    JourneysModule,
    CommonModule,
    StorageModule,
    AuditModule,
    DriversModule,
    InspectionsModule,
    TachographsModule,
    DashboardModule,
  ],
  controllers: [AppController, DetranController, VehiclesController],
  providers: [
    AppService, 
    DetranService, 
    VehiclesService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
