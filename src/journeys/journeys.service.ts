import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateJourneyDto } from './dto/create-journey.dto';
import { CreateJourneyEventDto } from './dto/journey-event.dto';
import { UpdateJourneyStatusDto } from './dto/update-journey-status.dto';

// Interfaces
export interface JourneyData {
  id: number;
  driver_id: number;
  vehicle_id: number;
  start_time: string;
  status: string;
  start_location?: string;
  start_odometer?: number;
  block_reason?: string | null;
  admin_notes?: string | null;
  authorized_with_risk?: boolean | null;
  checklist_photos?: string[];
}

export interface EventData {
  id: number;
  journey_id: number;
  type: string;
  timestamp: string;
}

export interface VehicleChecklistData {
  id?: number;
  journey_id?: number;
  driver_id?: number;
  vehicle_id?: number;
  type?: string;
  items?: Record<string, boolean>;
  notes?: string;
  created_at?: string;
}

export interface JourneyWithChecklist extends JourneyData {
  checklist?: VehicleChecklistData[];
}

const driverSelect =
  'driver:employees(id, name, cpf, cnh, cnh_category, cnh_expiry, phone, email, active, role, photo)';
const vehicleSelect = 'vehicle:vehicles(id, placa, modelo, marca)';

interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

interface SupabaseResponse<T> {
  data: T | null;
  error: SupabaseError | null;
}

@Injectable()
export class JourneysService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  // INICIAR JORNADA
  async create(createJourneyDto: CreateJourneyDto, photos?: Express.Multer.File[]) {
    try {
      // 1. VALIDAÇÃO: Bloqueia múltiplas jornadas simultâneas para o mesmo motorista
      const { data: existingJourneys, error: checkError } = await this.supabase
        .from('journeys')
        .select('id, status')
        .eq('driver_id', createJourneyDto.driverId)
        .in('status', ['active', 'pending_approval', 'resting', 'meal'])
        .limit(1);

      if (checkError) {
        console.error('Erro ao verificar jornadas existentes:', checkError);
        throw new Error('Erro ao verificar status atual do motorista.');
      }

      if (existingJourneys && existingJourneys.length > 0) {
        throw new BadRequestException('O motorista já possui uma jornada ativa ou em andamento.');
      }

      // --- LOGS DE DEBUG ---
      console.log('--- PAYLOAD RECEBIDO NO SERVICE ---');
      // Log seguro mesmo se checklist for undefined
      console.log(
        'checklist (raw):',
        JSON.stringify(createJourneyDto.checklist || {}, null, 2),
      );

      // Tratamento seguro para garantir que items nunca seja undefined
      let checklistData = createJourneyDto.checklist;
      if (typeof checklistData === 'string') {
        try {
          checklistData = JSON.parse(checklistData);
        } catch (e) {
          console.error('Erro ao fazer parse do checklist:', e);
        }
      }

      // Garante que checklistData seja um objeto válido para o resto da função
      checklistData = checklistData || {
        items: {},
        notes: '',
      };
      
      const checklistItems = checklistData.items ?? {};

      console.log('checklistItems processado:', JSON.stringify(checklistItems));

      // Lógica: Verifica se existem chaves E se algum valor é false (reprovado)
      const hasFailures =
        Object.keys(checklistItems).length > 0 &&
        Object.values(checklistItems).some((val) => val === false);

      console.log('Falhas detectadas (hasFailures)?', hasFailures);

      const journeyStatus = hasFailures ? 'pending_approval' : 'active';
      const failedItems = Object.entries(checklistItems)
        .filter(([, status]) => status === false)
        .map(([item]) => item);
      const blockReason = hasFailures
        ? JSON.stringify({
            failedItems,
            notes: checklistData.notes || '',
          })
        : null;

      let checklistPhotosUrls: string[] = [];
      if (photos && photos.length > 0) {
        const uploadPromises = photos.map(async (photo) => {
          const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const { error } = await this.supabase.storage
            .from('checklists')
            .upload(fileName, photo.buffer, {
              contentType: photo.mimetype,
            });

          if (error) {
            console.error('Erro no upload da foto:', error);
            return null;
          }

          const { data } = this.supabase.storage
            .from('checklists')
            .getPublicUrl(fileName);

          return data.publicUrl;
        });

        const results = await Promise.all(uploadPromises);
        checklistPhotosUrls = results.filter((url): url is string => url !== null);
      }

      // 1. Criar a linha na tabela journeys
      const response = (await this.supabase
        .from('journeys')
        .insert({
          driver_id: createJourneyDto.driverId,
          vehicle_id: createJourneyDto.vehicleId,
          start_location: createJourneyDto.startLocation,
          start_odometer: createJourneyDto.startOdometer,
          status: journeyStatus,
          block_reason: blockReason,
          checklist_photos: checklistPhotosUrls,
          start_time: new Date().toISOString(),
        })
        .select()
        .single()) as unknown as SupabaseResponse<JourneyData>;

      // --- CORREÇÃO DO ERRO: Extraindo 'journey' da resposta ---
      const { data: journey, error: journeyError } = response;

      if (journeyError) {
        console.error('Erro ao criar jornada:', journeyError);
        throw new Error(journeyError.message);
      }

      if (!journey) {
        throw new Error(
          'Erro desconhecido ao criar jornada: Dados de retorno vazios.',
        );
      }

      // Atualiza KM Veículo
      await this.supabase
        .from('vehicles')
        .update({ km_atual: createJourneyDto.startOdometer })
        .eq('id', createJourneyDto.vehicleId);

      // 2. Registrar o Checklist na tabela própria
      await this.supabase.from('vehicle_checklists').insert({
        journey_id: journey.id, // Agora 'journey' existe
        driver_id: createJourneyDto.driverId,
        vehicle_id: createJourneyDto.vehicleId,
        type: 'start',
        items: checklistItems,
        notes: checklistData.notes || '',
      });

      // 3. Registrar evento inicial
      await this.supabase.from('journey_events').insert({
        journey_id: journey.id,
        type: 'start_journey',
        location: createJourneyDto.startLocation,
      });

      return journey;
    } catch (error) {
      console.error('Erro inesperado ao criar jornada:', error);
      throw error instanceof Error
        ? error
        : new Error('Erro ao criar jornada.');
    }
  }

  async findActive(driverId: number) {
    try {
      const response = (await this.supabase
        .from('journeys')
        .select('*, vehicle:vehicles(*)')
        .eq('driver_id', driverId)
        .eq('status', 'active')
        .maybeSingle()) as SupabaseResponse<JourneyData>;

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    } catch (error) {
      console.error('Erro ao buscar jornada ativa:', error);
      throw error instanceof Error
        ? error
        : new Error('Erro ao buscar jornada ativa.');
    }
  }

  async findOne(id: number) {
    try {
      const response = (await this.supabase
        .from('journeys')
        .select(
          `*, checklist:vehicle_checklists(*), ${driverSelect}, ${vehicleSelect}, incidents:incidents(*, photos:incident_photos(*))`,
        )
        .eq('id', id)
        .single()) as SupabaseResponse<JourneyWithChecklist>;

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data) {
        throw new Error('Jornada não encontrada.');
      }

      return response.data;
    } catch (error) {
      console.error('Erro ao buscar detalhes da jornada:', error);
      throw error instanceof Error
        ? error
        : new Error('Erro ao buscar detalhes da jornada.');
    }
  }

  async findAllMonitoring() {
    try {
      const response = (await this.supabase
        .from('journeys')
        .select(
          `*, checklist:vehicle_checklists(*), ${driverSelect}, ${vehicleSelect}, incidents:incidents(*)`,
        )
        .in('status', ['active', 'pending_approval', 'resting', 'meal'])
        .order('start_time', { ascending: false })) as SupabaseResponse<
        JourneyWithChecklist[]
      >;

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data ?? [];
    } catch (error) {
      console.error('Erro ao buscar jornadas para monitoramento:', error);
      return [];
    }
  }

  async findHistoryByDate(date: string) {
    try {
      const startDate = new Date(`${date}T00:00:00.000Z`);
      if (Number.isNaN(startDate.getTime())) {
        throw new Error('Data inválida. Use o formato YYYY-MM-DD.');
      }

      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + 1);

      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();

      const response = (await this.supabase
        .from('journeys')
        .select(
          `*, ${driverSelect},
           ${vehicleSelect}, incidents:incidents(*)`,
        )
        .or(
          [
            `and(status.eq.finished,end_time.gte.${startIso},end_time.lt.${endIso})`,
            `and(status.eq.cancelled,start_time.gte.${startIso},start_time.lt.${endIso})`,
          ].join(','),
        )
        .order('start_time', { ascending: false })) as SupabaseResponse<
        JourneyData[]
      >;

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data ?? [];
    } catch (error) {
      console.error('Erro ao buscar histórico de jornadas:', error);
      throw error instanceof Error
        ? error
        : new Error('Erro ao buscar histórico de jornadas.');
    }
  }

  async findAllActive() {
    const response = (await this.supabase
      .from('journeys')
      .select(`*, ${driverSelect}, ${vehicleSelect}`)
      .in('status', ['active', 'pending_approval', 'resting', 'meal'])
      .order('start_time', { ascending: false })) as SupabaseResponse<
      JourneyData[]
    >;
    return response.data;
  }

  async findHistoryByDriver(driverId: number) {
    try {
      const response = (await this.supabase
        .from('journeys')
        .select(
          `*, vehicle:vehicles(*), checklist:vehicle_checklists(*), incidents:incidents(*)`,
        )
        .eq('driver_id', driverId)
        .order('start_time', { ascending: false })) as SupabaseResponse<
        JourneyData[]
      >;

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data ?? [];
    } catch (error) {
      console.error('Erro ao buscar histórico do motorista:', error);
      return [];
    }
  }

  async findByDate(date: string) {
    const startDate = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(startDate.getTime())) {
      throw new Error('Data inválida. Use o formato YYYY-MM-DD.');
    }

    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const response = (await this.supabase
      .from('journeys')
      .select(`*, ${driverSelect}, ${vehicleSelect}`)
      .or(
        [
          `and(status.eq.finished,end_time.gte.${startIso},end_time.lt.${endIso})`,
          `and(status.eq.cancelled,start_time.gte.${startIso},start_time.lt.${endIso})`,
        ].join(','),
      )
      .order('start_time', { ascending: false })) as SupabaseResponse<
      JourneyData[]
    >;

    return response.data;
  }

  async registerEvent(eventDto: CreateJourneyEventDto) {
    try {
      console.log('--- EVENT PAYLOAD RECEBIDO ---', eventDto);

      if (!eventDto?.journeyId) {
        console.error('journeyId ausente no payload de evento.');
        throw new Error(
          'journeyId é obrigatório para registrar eventos de jornada.',
        );
      }

      const statusByEvent: Record<CreateJourneyEventDto['type'], string> = {
        start_rest: 'resting',
        end_rest: 'active',
        start_meal: 'meal',
        end_meal: 'active',
        stop_wait: 'resting',
        start_wait: 'resting',
        stop: 'resting',
        resume: 'active',
        start_journey: 'active',
        meal: 'meal',
      };

      const nextStatus = statusByEvent[eventDto.type];

      if (nextStatus) {
        console.log(
          `Atualizando status da jornada ${eventDto.journeyId} para ${nextStatus}`,
        );
        console.log('Payload de status:', { status: nextStatus });
        const statusUpdate = (await this.supabase
          .from('journeys')
          .update({ status: nextStatus })
          .eq('id', eventDto.journeyId)
          .select('id')
          .single()) as SupabaseResponse<{ id: number }>;

        if (statusUpdate.error) {
          throw new Error(statusUpdate.error.message);
        }
      }

      console.log('Registrando evento de jornada:', {
        journey_id: eventDto.journeyId,
        type: eventDto.type,
        location: eventDto.location,
        timestamp: eventDto.timestamp || new Date().toISOString(),
      });
      const response = (await this.supabase
        .from('journey_events')
        .insert({
          journey_id: eventDto.journeyId,
          type: eventDto.type,
          location: eventDto.location,
          timestamp: eventDto.timestamp || new Date().toISOString(),
        })
        .select()
        .single()) as SupabaseResponse<EventData>;

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    } catch (error) {
      console.error('Erro ao registrar evento de jornada:', error);
      throw error instanceof Error
        ? error
        : new Error('Erro ao registrar evento de jornada.');
    }
  }

  async getStatus(id: number) {
    try {
      const response = (await this.supabase
        .from('journeys')
        .select('status')
        .eq('id', id)
        .single()) as SupabaseResponse<{ status: string }>;

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data) {
        throw new Error('Jornada não encontrada.');
      }

      return { status: response.data.status };
    } catch (error) {
      console.error('Erro ao buscar status da jornada:', error);
      throw error instanceof Error
        ? error
        : new Error('Erro ao buscar status da jornada.');
    }
  }

  async authorize(id: number, body: UpdateJourneyStatusDto) {
    try {
      const check = (await this.supabase
        .from('journeys')
        .select('status')
        .eq('id', id)
        .single()) as SupabaseResponse<{ status: string }>;

      if (check.error) {
        throw new Error(check.error.message);
      }

      if (check.data?.status === 'cancelled') {
        throw new BadRequestException('Esta viagem já foi cancelada pelo motorista.');
      }

      const response = (await this.supabase
        .from('journeys')
        .update({
          status: 'active',
          admin_notes: body.adminNotes ?? null,
          authorized_with_risk: true,
        })
        .eq('id', id)
        .select()
        .single()) as SupabaseResponse<JourneyData>;

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data) {
        throw new Error('Jornada não encontrada.');
      }

      return response.data;
    } catch (error) {
      console.error('Erro ao autorizar jornada:', error);
      throw error instanceof Error
        ? error
        : new Error('Erro ao autorizar jornada.');
    }
  }

  async block(id: number, body: UpdateJourneyStatusDto) {
    try {
      const journeyResponse = (await this.supabase
        .from('journeys')
        .select('*, checklist:vehicle_checklists(*)')
        .eq('id', id)
        .single()) as SupabaseResponse<JourneyWithChecklist>;

      if (journeyResponse.error) {
        throw new Error(journeyResponse.error.message);
      }

      const journey = journeyResponse.data;

      if (!journey) {
        throw new Error('Jornada não encontrada.');
      }

      if (journey.status === 'cancelled') {
        throw new BadRequestException('Esta viagem já foi cancelada pelo motorista.');
      }

      const updateResponse = (await this.supabase
        .from('journeys')
        .update({
          status: 'cancelled',
          block_reason: body.blockReason ?? null,
        })
        .eq('id', id)
        .select()
        .single()) as SupabaseResponse<JourneyData>;

      if (updateResponse.error) {
        throw new Error(updateResponse.error.message);
      }

      const updatedJourney = updateResponse.data;

      if (!updatedJourney) {
        throw new Error('Jornada não encontrada.');
      }

      const checklistData = journey.checklist?.[0]
        ? {
            ...journey.checklist[0],
            photos: journey.checklist_photos || [],
          }
        : null;
      const maintenancePayload = {
        type: 'Corretiva - Bloqueio',
        status: 'Pendente',
        checklist_data: checklistData,
        driver_id: journey.driver_id,
        vehicle_id: journey.vehicle_id,
      };

      Logger.log(
        `Inserindo manutenção de bloqueio para jornada ${journey.id}`,
        'JourneysService',
      );
      Logger.log(JSON.stringify(maintenancePayload), 'JourneysService');

      const maintenanceResponse = await this.supabase
        .from('maintenances')
        .insert(maintenancePayload)
        .select()
        .single();

      if (maintenanceResponse.error) {
        Logger.log(
          `Erro ao inserir manutenção de bloqueio: ${maintenanceResponse.error.message}`,
          'JourneysService',
        );
        throw new Error(maintenanceResponse.error.message);
      }

      Logger.log(
        `Manutenção de bloqueio inserida com sucesso para jornada ${journey.id}`,
        'JourneysService',
      );

      return updatedJourney;
    } catch (error) {
      console.error('Erro ao bloquear jornada:', error);
      throw error instanceof Error
        ? error
        : new Error('Erro ao bloquear jornada.');
    }
  }

  async finish(
    id: number,
    endData: {
      endLocation: string;
      endOdometer: number;
      checklist?: { items?: Record<string, boolean>; notes?: string };
    },
  ) {
    try {
      const response = (await this.supabase
        .from('journeys')
        .update({
          end_time: new Date().toISOString(),
          end_location: endData.endLocation,
          end_odometer: endData.endOdometer,
          status: 'finished',
        })
        .eq('id', id)
        .select()
        .single()) as SupabaseResponse<JourneyData>;

      if (response.error) {
        throw new Error(response.error.message);
      }

      const journey = response.data;

      if (!journey) {
        throw new Error('Jornada não encontrada.');
      }

      const checklistData: { items: Record<string, boolean>; notes?: string; photos?: string[] } =
        {
          items: endData.checklist?.items ?? {},
          notes: endData.checklist?.notes ?? '',
          photos: journey.checklist_photos || [],
        };
      const checklistItems = checklistData.items;

      // --- LÓGICA DE MANUTENÇÃO AUTOMÁTICA (FINAL) ---
      const hasFailures = Object.values(checklistItems).some(
        (val) => val === false,
      );

      if (hasFailures) {
        const failedItemsList = Object.entries(checklistItems)
          .filter(([, status]) => status === false)
          .map(([item]) => item)
          .join(', ');

        await this.supabase.from('maintenances').insert({
          vehicle_id: journey.vehicle_id,
          driver_id: journey.driver_id,
          type: 'Corretiva - Checklist',
          description: `Manutenção Automática (Final). Reprovados: ${failedItemsList}`,
          status: 'Pendente',
          priority: 'Média',
          created_at: new Date().toISOString(),
          checklist_data: checklistData,
          cost: 0,
          provider: 'Interno',
        });
      }

      await this.supabase
        .from('vehicles')
        .update({ km_atual: endData.endOdometer })
        .eq('id', journey.vehicle_id);

      return journey;
    } catch (error) {
      console.error('Erro ao finalizar jornada:', error);
      throw error instanceof Error
        ? error
        : new Error('Erro ao finalizar jornada.');
    }
  }

  async cancelByDriver(id: number) {
    try {
      const response = (await this.supabase
        .from('journeys')
        .update({
          status: 'cancelled',
          block_reason: 'Cancelada pelo motorista durante a espera de aprovação.',
        })
        .eq('id', id)
        .select()
        .single()) as SupabaseResponse<JourneyData>;

      if (response.error) {
        throw new Error(response.error.message);
      }

      const journey = response.data;

      if (!journey) {
        throw new Error('Jornada não encontrada.');
      }

      const { error: eventError } = await this.supabase
        .from('journey_events')
        .insert({
          journey_id: id,
          type: 'cancelled_by_driver',
        });

      if (eventError) {
        throw new Error(eventError.message);
      }

      return journey;
    } catch (error) {
      console.error('Erro ao cancelar jornada pelo motorista:', error);
      throw error instanceof Error
        ? error
        : new Error('Erro ao cancelar jornada pelo motorista.');
    }
  }
}
