/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateFineDto } from './dto/create-fine.dto';

@Injectable()
export class FinesService implements OnModuleInit {
  private supabase: SupabaseClient;

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? '',
    );
  }

  async create(createFineDto: CreateFineDto) {
    const { data, error } = await this.supabase
      .from('fines')
      .insert(createFineDto)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async findAll() {
    // Agora buscamos também o vehicle_plate direto da tabela fines
    const { data, error } = await this.supabase
      .from('fines')
      .select('*, vehicles(placa, modelo)') // O * já pega o vehicle_plate
      .order('infraction_date', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  // Opcional: Atualizar status (Pagar multa)
  async updateStatus(id: number, status: string) {
    const { data, error } = await this.supabase
      .from('fines')
      .update({ status })
      .eq('id', id)
      .select();

    if (error) throw new Error(error.message);
    return data;
  }
}
