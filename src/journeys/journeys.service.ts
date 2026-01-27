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
  async create(createJourneyDto: CreateJourneyDto) {
    console.log('--- [DEBUG] INICIANDO JORNADA ---');
    console.log('Payload:', JSON.stringify(createJourneyDto, null, 2));

    // Validação Manual de Segurança
    if (!createJourneyDto.driverId || !createJourneyDto.vehicleId) {
      throw new Error(
        'Dados incompletos: driverId e vehicleId são obrigatórios.',
      );
    }

    // 1. Criar a linha na tabela journeys
    const response = (await this.supabase
      .from('journeys')
      .insert({
        driver_id: createJourneyDto.driverId,
        vehicle_id: createJourneyDto.vehicleId,
        start_location: createJourneyDto.startLocation,
        start_odometer: createJourneyDto.startOdometer,
        status: 'active',
        start_time: new Date().toISOString(),
      })
      .select()
      .single()) as unknown as SupabaseResponse<JourneyData>;

    const { data: journey, error: journeyError } = response;

    if (journeyError) {
      console.error('Erro ao criar jornada:', journeyError);
      throw new Error(journeyError.message);
    }
    if (!journey) throw new Error('Erro desconhecido ao criar jornada');

    // Atualiza KM Veículo
    await this.supabase
      .from('vehicles')
      .update({ km_atual: createJourneyDto.startOdometer })
      .eq('id', createJourneyDto.vehicleId);

    // TRATAMENTO DO CHECKLIST
    const checklistData: { items: Record<string, boolean>; notes?: string } = {
      items: createJourneyDto.checklist?.items ?? {},
      notes: createJourneyDto.checklist?.notes ?? '',
    };
    const checklistItems = checklistData.items;
    const checklistNotes = checklistData.notes ?? '';

    // 2. Registrar o Checklist na tabela própria
    await this.supabase.from('vehicle_checklists').insert({
      journey_id: journey.id,
      driver_id: createJourneyDto.driverId,
      vehicle_id: createJourneyDto.vehicleId,
      type: 'start',
      items: checklistItems,
      notes: checklistNotes,
    });

    // --- LÓGICA DE MANUTENÇÃO AUTOMÁTICA ---
    const hasFailures = Object.values(checklistItems).some(
      (val) => val === false,
    );

    if (hasFailures) {
      console.log('>>> FALHAS DETECTADAS. GERANDO MANUTENÇÃO...');

      const failedItemsList = Object.entries(checklistItems)
        .filter(([, status]) => status === false)
        .map(([item]) => item)
        .join(', ');

      const description = `Manutenção Automática (Checklist Inicial). Itens Reprovados: ${failedItemsList}. Obs: ${checklistNotes}`;

      // Inserção da Manutenção
      const { error: maintError } = await this.supabase
        .from('maintenances')
        .insert({
          vehicle_id: createJourneyDto.vehicleId,
          driver_id: createJourneyDto.driverId,
          type: 'Corretiva - Checklist',
          description: description,
          status: 'Pendente',
          priority: 'Alta',
          created_at: new Date().toISOString(),
          checklist_data: checklistData, // GRAVA O JSON AQUI

          // VALORES PADRÃO (Para evitar erro de NOT NULL no banco)
          cost: 0,
          provider: 'Interno',
        });

      if (maintError) {
        console.error('!!! ERRO AO SALVAR MANUTENÇÃO !!!', maintError);
      } else {
        console.log('>>> SUCESSO: Manutenção criada.');
      }
    }

    // 3. Registrar evento
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
