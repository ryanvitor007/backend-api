import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DetranController } from './detran/detran.controller';
import { DetranService } from './detran/detran.service';
import { VehiclesController } from './vehicles/vehicles.controller';
import { VehiclesService } from './vehicles/vehicles.service';
import { FinesModule } from './fines/fines.module'; // <--- 1. Importe o Módulo Aqui
import { DocumentsModule } from './document/documents.module'; // <--- Importe

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule,
    FinesModule, // <--- 2. Adicione na lista de imports
    DocumentsModule, // <--- 3. Adicione o módulo de documentos
  ],
  controllers: [AppController, DetranController, VehiclesController],
  providers: [AppService, DetranService, VehiclesService],
})
export class AppModule {}
