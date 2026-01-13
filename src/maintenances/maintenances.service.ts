/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';

@Injectable()
export class MaintenancesService implements OnModuleInit {
  private supabase: SupabaseClient;

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? '',
    );
  }

  // Criar Manutenção
  async create(dto: CreateMaintenanceDto) {
    const { data, error } = await this.supabase
      .from('maintenances')
      .insert(dto)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // Listar Todas
  async findAll() {
    const { data, error } = await this.supabase
      .from('maintenances')
      .select('*')
      .order('scheduled_date', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  // Dar Baixa (Concluir)
  async complete(id: number) {
    const { data, error } = await this.supabase
      .from('maintenances')
      .update({
        status: 'Concluída',
        completed_date: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
