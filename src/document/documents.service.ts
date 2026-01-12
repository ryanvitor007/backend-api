/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService implements OnModuleInit {
  private supabase: SupabaseClient;

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? '',
    );
  }

  async create(createDocumentDto: CreateDocumentDto) {
    const { data, error } = await this.supabase
      .from('documents')
      .insert(createDocumentDto)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async findAll() {
    const { data, error } = await this.supabase.from('documents').select(`
        *,
        vehicles (placa, modelo, renavam)
      `); // O * traz a coluna vehicle_plate que criamos

    if (error) throw new Error(error.message);
    return data;
  }
}
