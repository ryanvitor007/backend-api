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
  }

  // ... (Mantenha o restante do arquivo igual) ...
  async findActive(driverId: number) {
    const response = (await this.supabase
      .from('journeys')
      .select('*, vehicle:vehicles(*)')
      .eq('driver_id', driverId)
      .eq('status', 'active')
      .maybeSingle()) as SupabaseResponse<JourneyData>;
    return response.data;
  }

  async findAllActive() {
    const response = (await this.supabase
      .from('journeys')
      .select('*, driver:drivers(name, photo), vehicle:vehicles(placa, modelo)')
      .in('status', ['active', 'pending_approval', 'resting', 'meal'])
      .order('start_time', { ascending: false })) as SupabaseResponse<
      JourneyData[]
    >;
    return response.data;
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
      .select('*, driver:drivers(name, photo), vehicle:vehicles(placa, modelo)')
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
    return response.data;
  }

  async getStatus(id: number) {
    const response = (await this.supabase
      .from('journeys')
      .select('status')
      .eq('id', id)
      .single()) as SupabaseResponse<{ status: string }>;

    if (response.error) {
      throw new Error(response.error.message);
    }

    return { status: response.data?.status };
  }

  async authorize(
    id: number,
    body: { status: 'active'; adminNotes: string; authorizedWithRisk: boolean },
  ) {
    const response = (await this.supabase
      .from('journeys')
      .update({
        status: body.status,
        admin_notes: body.adminNotes,
        authorized_with_risk: body.authorizedWithRisk,
      })
      .eq('id', id)
      .select()
      .single()) as SupabaseResponse<JourneyData>;

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.data;
  }

  async block(
    id: number,
    body: { status: 'cancelled'; blockReason: string; createMaintenance: boolean },
  ) {
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

    if (journey && body.createMaintenance) {
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
    }

    return journey;
  }

  async finish(
    id: number,
    endData: {
      endLocation: string;
      endOdometer: number;
      checklist?: { items?: Record<string, boolean>; notes?: string };
    },
  ) {
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

    const journey = response.data as JourneyData;

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
  }
}
