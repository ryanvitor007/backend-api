/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

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
  cor: string;
  combustivel: string;
  chassi: string;
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

  async remove(id: number): Promise<void> {
    console.log(`Iniciando exclusão do veículo ID: ${id}`);

    // O Supabase/Postgres irá disparar o 'ON DELETE CASCADE' se configurado no banco
    const { error } = await this.supabase
      .from('vehicles')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir veículo:', error);
      // Tratamento para erro de chave estrangeira
      if (error.code === '23503') {
        throw new Error(
          'Não é possível excluir: Existem registros vinculados. Configure "ON DELETE CASCADE" no Supabase.',
        );
      }
      throw new Error(error.message);
    }

    console.log('Veículo excluído com sucesso.');
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
        cor: createVehicleDto.cor,
        combustivel: createVehicleDto.combustivel,
        chassi: createVehicleDto.chassi,
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
