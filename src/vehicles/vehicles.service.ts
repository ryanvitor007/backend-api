import { Injectable } from '@nestjs/common';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

// CORREÇÃO: Adicionado 'export' para que o Controller possa usar este tipo
export interface Vehicle {
  id: number;
  placa: string;
  modelo: string;
  ano: number;
  km_atual: number;
  renavam: string;
  status: string;
  data_cadastro: Date;
}

@Injectable()
export class VehiclesService {
  private fakeDb: Vehicle[] = [];

  create(createVehicleDto: CreateVehicleDto): Vehicle {
    console.log('Recebendo novo veículo:', createVehicleDto);

    const novoCarro: Vehicle = {
      id: Date.now(),
      ...createVehicleDto,
      data_cadastro: new Date(),
    };

    this.fakeDb.push(novoCarro);
    return novoCarro;
  }

  findAll(): Vehicle[] {
    return this.fakeDb;
  }
}
