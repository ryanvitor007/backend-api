/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
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

  // CRIAR MANUTENÇÃO A PARTIR DE INCIDENTE
  async createMaintenanceFromIncident(id: number) {
    const { data: incident, error: incidentError } = await this.supabase
      .from('incidents')
      .select(
        '*, journey:journeys!left(vehicle_id, driver_id, vehicle:vehicles(placa, modelo))',
      )
      .eq('id', id)
      .single();

    if (incidentError) {
      throw new Error(`Erro ao buscar incidente: ${incidentError.message}`);
    }

    const vehicleId = incident.journey?.vehicle_id || incident.vehicle_id;
    const driverId = incident.journey?.driver_id || incident.driver_id;

    if (!vehicleId) {
      throw new BadRequestException(
        'Não foi possível identificar o veículo deste incidente. Verifique se há uma jornada vinculada.',
      );
    }

    const vehiclePlate =
      incident.veiculo_placa ?? incident.journey?.vehicle?.placa ?? null;
    const vehicleModel =
      incident.veiculo_modelo ?? incident.journey?.vehicle?.modelo ?? null;
    const description = `Manutenção gerada automaticamente do Sinistro #${id}. Detalhes: ${incident.descricao}`;

    const { data: maintenance, error: maintenanceError } = await this.supabase
      .from('maintenances')
      .insert({
        incident_id: incident.id,
        vehicle_id: vehicleId,
        driver_id: driverId,
        description,
        type: 'Corretiva - Sinistro',
        status: 'Pendente',
        vehicle_plate: vehiclePlate,
        vehicle_model: vehicleModel,
        cost: 0,
      })
      .select()
      .single();

    if (maintenanceError) {
      throw new Error(
        `Erro ao criar manutenção do incidente: ${maintenanceError.message}`,
      );
    }

    const { error: updateError } = await this.supabase
      .from('incidents')
      .update({ status: 'Em Manutenção' })
      .eq('id', incident.id);

    if (updateError) {
      throw new Error(
        `Erro ao atualizar status do incidente: ${updateError.message}`,
      );
    }

    const { data: maintenanceDetails, error: maintenanceDetailsError } =
      await this.supabase
        .from('maintenances')
        .select(
          '*, vehicle:vehicles(*), driver:employees(*), incident:incidents(id, fotos, descricao, created_at)',
        )
        .eq('id', maintenance.id)
        .single();

    if (maintenanceDetailsError) {
      throw new Error(
        `Erro ao buscar manutenção criada: ${maintenanceDetailsError.message}`,
      );
    }

    return maintenanceDetails;
  }

  // CRIAR INCIDENTE
  async create(
    createIncidentDto: CreateIncidentDto,
    files?: Array<Express.Multer.File>,
  ) {
    const photoUrls: string[] = [];
    const rawJourneyId = createIncidentDto.journeyId;
    const journeyId = rawJourneyId && !isNaN(Number(rawJourneyId)) && Number(rawJourneyId) > 0
      ? Number(rawJourneyId)
      : null;
    let journeyData: {
      vehicle?: { placa?: string | null; modelo?: string | null };
      driver?: { name?: string | null };
      start_location?: string | null;
    } | null = null;

    if (journeyId) {
      const { data: journey, error: journeyError } = await this.supabase
        .from('journeys')
        .select('*, vehicle:vehicles(*), driver:employees(*)')
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

      journeyData = journey;
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
          throw new Error('Falha no upload para o bucket: ' + uploadError.message);
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
      veiculo_placa:
        journeyData !== null
          ? journeyData.vehicle?.placa ?? null
          : createIncidentDto.vehiclePlate,
      veiculo_modelo:
        journeyData !== null
          ? journeyData.vehicle?.modelo ?? null
          : createIncidentDto.vehicleModel,
      motorista_nome:
        journeyData !== null
          ? journeyData.driver?.name ?? null
          : createIncidentDto.driverName,
      localizacao:
        createIncidentDto.location ?? journeyData?.start_location ?? null,
      descricao: createIncidentDto.description,
      custo_estimado: journeyData !== null ? 0 : (createIncidentDto.estimatedCost !== undefined && createIncidentDto.estimatedCost !== null && !isNaN(Number(createIncidentDto.estimatedCost)) ? Number(createIncidentDto.estimatedCost) : 0),
      acionamento_seguro: String(createIncidentDto.insuranceClaim) === 'true' || createIncidentDto.insuranceClaim === true,
      status:
        journeyData !== null
          ? 'Aguardando Manutenção'
          : createIncidentDto.status || 'Aberto',
      fotos: photoUrls,
      journey_id: journeyId,
      houve_vitimas: String(createIncidentDto.hasVictims) === 'true' || createIncidentDto.hasVictims === true || String(createIncidentDto.houve_vitimas) === 'true' || createIncidentDto.houve_vitimas === true,
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
