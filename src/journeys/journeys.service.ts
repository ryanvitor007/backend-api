import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateJourneyDto } from './dto/create-journey.dto';
import { CreateJourneyEventDto } from './dto/journey-event.dto';

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
}

export interface EventData {
  id: number;
  journey_id: number;
  type: string;
  timestamp: string;
}

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
  // INICIAR JORNADA
  // INICIAR JORNADA
  async create(createJourneyDto: CreateJourneyDto) {
    try {
      // --- LOGS DE DEBUG ---
      console.log('--- PAYLOAD RECEBIDO NO SERVICE ---');
      // Log seguro mesmo se checklist for undefined
      console.log(
        'checklist (raw):',
        JSON.stringify(createJourneyDto.checklist || {}, null, 2),
      );

      // Tratamento seguro para garantir que items nunca seja undefined
      const checklistData = createJourneyDto.checklist || {
        items: {},
        notes: '',
      };
      // O operador ?? garante um objeto vazio se items for null/undefined
      const checklistItems = checklistData.items ?? {};

      console.log('checklistItems processado:', JSON.stringify(checklistItems));

      // Lógica: Verifica se existem chaves E se algum valor é false (reprovado)
      const hasFailures =
        Object.keys(checklistItems).length > 0 &&
        Object.values(checklistItems).some((val) => val === false);

      console.log('Falhas detectadas (hasFailures)?', hasFailures);

      const journeyStatus = hasFailures ? 'pending_approval' : 'active';

      // 1. Criar a linha na tabela journeys
      const response = (await this.supabase
        .from('journeys')
        .insert({
          driver_id: createJourneyDto.driverId,
          vehicle_id: createJourneyDto.vehicleId,
          start_location: createJourneyDto.startLocation,
          start_odometer: createJourneyDto.startOdometer,
          status: journeyStatus,
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
      throw error instanceof Error ? error : new Error('Erro ao criar jornada.');
    }
  }

  // ... (Mantenha o restante do arquivo igual) ...
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

  async findAllMonitoring() {
    try {
      const response = (await this.supabase
        .from('journeys')
        .select(
          '*, driver:employees(name, photo), vehicle:vehicles(placa, modelo, marca)',
        )
        .in('status', ['active', 'pending_approval', 'resting', 'meal'])
        .order('start_time', { ascending: false })) as SupabaseResponse<
        JourneyData[]
      >;

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data ?? [];
    } catch (error) {
      console.error('Erro ao buscar jornadas para monitoramento:', error);
      throw error instanceof Error
        ? error
        : new Error('Erro ao buscar jornadas para monitoramento.');
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
          '*, driver:employees(name, photo), vehicle:vehicles(placa, modelo, marca)',
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

  async registerEvent(eventDto: CreateJourneyEventDto) {
    try {
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

  async authorize(id: number, body: { status: 'active'; adminNotes: string }) {
    try {
      const response = (await this.supabase
        .from('journeys')
        .update({
          status: body.status,
          admin_notes: body.adminNotes,
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

  async block(id: number, body: { status: 'cancelled'; blockReason: string }) {
    try {
      const response = (await this.supabase
        .from('journeys')
        .update({
          status: body.status,
          block_reason: body.blockReason,
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

      const checklistResponse = (await this.supabase
        .from('vehicle_checklists')
        .select('items, notes')
        .eq('journey_id', id)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()) as SupabaseResponse<{
        items?: Record<string, boolean>;
        notes?: string;
      }>;

      const checklistData = {
        items: checklistResponse.data?.items ?? {},
        notes: checklistResponse.data?.notes ?? '',
      };

      const failedItemsList = Object.entries(checklistData.items)
        .filter(([, status]) => status === false)
        .map(([item]) => item)
        .join(', ');

      const descriptionParts = [
        `Bloqueio de Jornada. Motivo: ${body.blockReason}`,
      ];

      if (failedItemsList) {
        descriptionParts.push(`Itens Reprovados: ${failedItemsList}`);
      }

      if (checklistData.notes) {
        descriptionParts.push(`Obs: ${checklistData.notes}`);
      }

      await this.supabase.from('maintenances').insert({
        vehicle_id: journey.vehicle_id,
        driver_id: journey.driver_id,
        type: 'Corretiva - Checklist',
        description: descriptionParts.join('. '),
        status: 'Pendente',
        priority: 'Alta',
        created_at: new Date().toISOString(),
        checklist_data: checklistData,
        cost: 0,
        provider: 'Interno',
      });

      return journey;
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

      const journey = response.data as JourneyData;

      if (!journey) {
        throw new Error('Jornada não encontrada.');
      }

      const checklistData: { items: Record<string, boolean>; notes?: string } = {
        items: endData.checklist?.items ?? {},
        notes: endData.checklist?.notes ?? '',
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
      return journey;
    } catch (error) {
      console.error('Erro ao finalizar jornada:', error);
      throw error instanceof Error
        ? error
        : new Error('Erro ao finalizar jornada.');
    }
  }
}
