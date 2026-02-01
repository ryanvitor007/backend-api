/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class IncidentsService implements OnModuleInit {
  private supabase: SupabaseClient;
  private readonly bucketName = 'incident-photos';

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? '',
    );
  }

  // ATUALIZAR STATUS (SIMPLES)
  async updateStatus(id: number, status: string) {
    const { data, error } = await this.supabase
      .from('incidents')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar status: ${error.message}`);
    }
    return data;
  }

  // CONCLUIR INCIDENTE COM UPLOAD DE NOTA FISCAL
  async concludeIncident(id: number, file?: Express.Multer.File) {
    let invoiceUrl: string | null = null;

    // 1. Upload da Nota Fiscal (se enviada)
    if (file) {
      const fileExt = file.originalname.split('.').pop();
      const fileName = `invoice-${id}-${Date.now()}.${fileExt}`;
      const filePath = `invoices/${fileName}`;

      const { error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
        });

      if (uploadError) {
        console.error('Erro upload nota fiscal:', uploadError);
      } else {
        const { data } = this.supabase.storage
          .from(this.bucketName)
          .getPublicUrl(filePath);
        invoiceUrl = data.publicUrl;
      }
    }

    // 2. Atualizar registro no banco
    const { data, error } = await this.supabase
      .from('incidents')
      .update({
        status: 'Concluído',
        nota_fiscal_url: invoiceUrl,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // CRIAR INCIDENTE
  async create(
    createIncidentDto: CreateIncidentDto,
    files?: Array<Express.Multer.File>,
  ) {
    const photoUrls: string[] = [];
    const journeyId = createIncidentDto.journeyId;

    if (journeyId !== undefined && journeyId !== null) {
      const { data: journey, error: journeyError } = await this.supabase
        .from('journeys')
        .select('id')
        .eq('id', journeyId)
        .maybeSingle();

      if (journeyError) {
        throw new Error(
          `Erro ao validar jornada vinculada: ${journeyError.message}`,
        );
      }

      if (!journey) {
        throw new Error('Jornada informada não encontrada.');
      }
    }

    // 1. Processar Uploads de Fotos
    if (files && files.length > 0) {
      for (const file of files) {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Date.now()}-${uuidv4()}.${fileExt}`;
        const filePath = `v1/${fileName}`;

        const { error: uploadError } = await this.supabase.storage
          .from(this.bucketName)
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
          });

        if (uploadError) {
          console.error(`Erro no upload: ${file.originalname}`, uploadError);
          continue;
        }

        const {
          data: { publicUrl },
        } = this.supabase.storage.from(this.bucketName).getPublicUrl(filePath);

        photoUrls.push(publicUrl);
      }
    }

    // 2. Salvar no Banco
    const payload = {
      tipo: createIncidentDto.type || 'Sinistro',
      data_ocorrencia: createIncidentDto.date || new Date(),
      hora_ocorrencia: createIncidentDto.time,
      veiculo_placa: createIncidentDto.vehiclePlate,
      veiculo_modelo: createIncidentDto.vehicleModel,
      motorista_nome: createIncidentDto.driverName,
      localizacao: createIncidentDto.location,
      descricao: createIncidentDto.description,
      custo_estimado: createIncidentDto.estimatedCost,
      acionamento_seguro: String(createIncidentDto.insuranceClaim) === 'true',
      status: createIncidentDto.status || 'Aberto',
      fotos: photoUrls,
      journey_id: journeyId ?? null,
    };

    const { data, error } = await this.supabase
      .from('incidents')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar no DB:', error);
      throw new Error(`Erro no Supabase DB: ${error.message}`);
    }

    return data;
  }

  async findAll() {
    const { data, error } = await this.supabase
      .from('incidents')
      .select('*')
      .order('data_ocorrencia', { ascending: false });

    if (error) {
      throw new Error(
        error?.message || 'Erro desconhecido ao buscar incidentes',
      );
    }
    return data || [];
  }
}
