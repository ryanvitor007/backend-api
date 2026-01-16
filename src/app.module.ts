import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule,
    // Lista de Módulos Registrados
    FinesModule,
    DocumentsModule,
    MaintenancesModule,
    IncidentsModule,
    ReportsModule,
  ],
  controllers: [AppController, DetranController, VehiclesController],
  providers: [AppService, DetranService, VehiclesService],
})
export class AppModule {}
