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

  // --- CRIAR MANUTENÇÃO E ATUALIZAR VEÍCULO ---
  async create(dto: CreateMaintenanceDto) {
    // 1. Insere o registro da manutenção
    const payload = {
      vehicle_id: dto.vehicle_id,
      driver_id: dto.driver_id,
      vehicle_plate: dto.vehicle_plate,
      vehicle_model: dto.vehicle_model,
      type: dto.type,
      description: dto.description,
      scheduled_date: dto.scheduled_date,
      cost: dto.cost,
      status: dto.status,
      provider: dto.provider,
      km_at_maintenance: dto.km_at_maintenance,
      invoice_url: dto.invoice_url,
      checklist_data: dto.checklist_data,
    };

    const { data, error } = await this.supabase
      .from('maintenances')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // 2. ATUALIZAÇÃO AUTOMÁTICA DA KM DO VEÍCULO
    // Se veio um ID de veículo e uma KM válida, atualizamos o cadastro do carro
    if (dto.vehicle_id && dto.km_at_maintenance > 0) {
      await this.supabase
        .from('vehicles')
        .update({ km_atual: dto.km_at_maintenance })
        .eq('id', dto.vehicle_id);
    }

    return data;
  }

  async resolve(id: number) {
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

  async findAll() {
    const { data, error } = await this.supabase
      .from('maintenances')
      .select('*')
      .order('scheduled_date', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

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
