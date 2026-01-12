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
    // Traz os documentos JÁ com os dados do veículo (Placa/Modelo)
    // Isso garante que só traga documentos de carros cadastrados na frota
    const { data, error } = await this.supabase
      .from('documents')
      .select('*, vehicles(placa, modelo, renavam)');

    if (error) throw new Error(error.message);
    return data;
  }
}
