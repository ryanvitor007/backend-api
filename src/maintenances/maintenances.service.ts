/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { extname } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';

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
    const kmAtMaintenance = dto.km_at_maintenance;
    if (
      dto.vehicle_id &&
      typeof kmAtMaintenance === 'number' &&
      kmAtMaintenance > 0
    ) {
      await this.supabase
        .from('vehicles')
        .update({ km_atual: kmAtMaintenance })
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

  async update(
    id: number,
    updateDto: UpdateMaintenanceDto,
    file?: Express.Multer.File,
  ) {
    const payload: Record<string, unknown> = { ...updateDto };

    if (updateDto.status === 'Concluída' && !updateDto.completed_date) {
      payload.completed_date = new Date();
    }

    if (payload.completed_date instanceof Date) {
      payload.completed_date = payload.completed_date.toISOString();
    }

    if (typeof updateDto.cost === 'string') {
      const parsedCost = Number(updateDto.cost);
      if (!Number.isNaN(parsedCost)) {
        payload.cost = parsedCost;
      }
    }

    if (file) {
      const extension = extname(file.originalname || '');
      const filePath = `maintenance_${id}_${Date.now()}${extension}`;
      const { error: uploadError } = await this.supabase.storage
        .from('invoices')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: publicUrlData } = this.supabase.storage
        .from('invoices')
        .getPublicUrl(filePath);

      payload.invoice_url = publicUrlData.publicUrl;
    }

    const cleanedPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    );

    const { data, error } = await this.supabase
      .from('maintenances')
      .update(cleanedPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
