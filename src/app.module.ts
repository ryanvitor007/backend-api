import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DetranController } from './detran/detran.controller';
import { DetranService } from './detran/detran.service';
import { VehiclesController } from './vehicles/vehicles.controller';
import { VehiclesService } from './vehicles/vehicles.service';

@Module({
  imports: [HttpModule],
  controllers: [AppController, DetranController, VehiclesController],
  providers: [AppService, DetranService, VehiclesService],
})
export class AppModule {}
