/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
export class VehiclesService implements OnModuleInit {
  private supabase: SupabaseClient;

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? '',
    );
  }

  async create(createVehicleDto: CreateVehicleDto): Promise<Vehicle> {
    console.log('Salvando no Supabase:', createVehicleDto);

    const { data, error } = await this.supabase
      .from('vehicles')
      .insert({
        placa: createVehicleDto.placa,
        modelo: createVehicleDto.modelo,
        ano: createVehicleDto.ano,
        km_atual: createVehicleDto.km_atual,
        renavam: createVehicleDto.renavam,
        status: createVehicleDto.status,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar:', error);
      throw new Error('Erro ao salvar veículo no banco de dados');
    }

    return data as Vehicle;
  }

  async findAll(): Promise<Vehicle[]> {
    const { data, error } = await this.supabase
      .from('vehicles')
      .select('*')
      .order('data_cadastro', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as Vehicle[]) || [];
  }
}
