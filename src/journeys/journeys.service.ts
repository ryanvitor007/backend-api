import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateJourneyDto } from './dto/create-journey.dto';
import { CreateJourneyEventDto } from './dto/journey-event.dto';

// Interfaces exportadas
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
  details: string;
  hint: string;
  code: string;
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
    console.log('--- PAYLOAD CHEGOU NO SERVICE ---');
    console.log(JSON.stringify(createJourneyDto, null, 2));
    console.log('Checklist recebido no service:', createJourneyDto.checklist);

    // TRAVA DE SEGURANÇA: Se o ValidationPipe limpar os dados, isso vai avisar
    if (!createJourneyDto.driverId || !createJourneyDto.vehicleId) {
      console.error(
        'ERRO CRÍTICO: driverId ou vehicleId indefinidos. O DTO pode estar limpando os dados.',
      );
      throw new Error('Dados de motorista ou veículo ausentes.');
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
      .single()) as SupabaseResponse<JourneyData>;
    const { data: journey, error: journeyError } = response;

    if (journeyError) {
      console.error('ERRO AO CRIAR JORNADA (DB):', journeyError.message);
      throw new Error(journeyError.message);
    }

    if (!journey) throw new Error('Erro desconhecido ao criar jornada');

    // ... (Restante do código: atualização de KM e vehicle_checklists) ...

    // --- ATUALIZAÇÃO AUTOMÁTICA DE KM ---
    await this.supabase
      .from('vehicles')
      .update({ km_atual: createJourneyDto.startOdometer })
      .eq('id', createJourneyDto.vehicleId);

    // --- TRATAMENTO DO CHECKLIST ---
    const checklistData = (createJourneyDto.checklist || {}) as {
      items?: Record<string, boolean>;
      notes?: string;
    };
    const checklistItems = checklistData.items || {};
    const checklistNotes = checklistData.notes || '';
    const checklistPayload = { items: checklistItems, notes: checklistNotes };
    console.log('Checklist items normalizados:', checklistItems);

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

    console.log('Tem itens reprovados?', hasFailures); // DEBUG

    if (hasFailures) {
      const failedItemsList = Object.entries(checklistItems)
        .filter(([, status]) => status === false)
        .map(([item]) => item)
        .join(', ');

      console.log('Criando manutenção para falhas:', failedItemsList);

      const description = `Manutenção Automática (Checklist Inicial). Itens Reprovados: ${failedItemsList}. Obs: ${checklistNotes}`;

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
          checklist_data: checklistPayload, // JSON correto

          // VALORES PADRÃO PARA EVITAR ERRO DE NOT NULL
          cost: 0,
          provider: 'Interno',
        });

      if (maintError) {
        console.error('ERRO AO SALVAR MANUTENÇÃO:', maintError);
      } else {
        console.log('SUCESSO: Manutenção criada no banco de dados!');
      }
    }

    // 3. Registrar evento inicial
    await this.supabase.from('journey_events').insert({
      journey_id: journey.id,
      type: 'start_journey',
      location: createJourneyDto.startLocation,
    });

    return journey;
  }

  // ... (Mantenha findActive e registerEvent iguais) ...
  async findActive(driverId: number) {
    const response = (await this.supabase
      .from('journeys')
      .select('*, vehicle:vehicles(*)')
      .eq('driver_id', driverId)
      .eq('status', 'active')
      .maybeSingle()) as SupabaseResponse<JourneyData>;
    const { data, error } = response;
    if (error) throw new Error(error.message);
    return data;
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
      .single()) as unknown as SupabaseResponse<EventData>;
    const { data, error } = response;
    if (error) throw new Error(error.message);
    return data;
  }

  // ENCERRAR JORNADA
  async finish(
    id: number,
    endData: {
      endLocation: string;
      endOdometer: number;
      checklist: unknown;
    },
  ) {
    // 1. Atualiza Jornada
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
      .single()) as unknown as SupabaseResponse<JourneyData>;

    const { data: journey, error } = response;

    if (error) throw new Error(error.message);
    if (!journey) throw new Error('Erro ao finalizar jornada');

    // --- ATUALIZAÇÃO AUTOMÁTICA DE KM ---
    await this.supabase
      .from('vehicles')
      .update({ km_atual: endData.endOdometer })
      .eq('id', journey.vehicle_id);

    // 2. Salva Checklist Final
    const checklistData = (endData.checklist || {}) as {
      items?: Record<string, boolean>;
      notes?: string;
    };
    const checklistItems = checklistData.items || {};
    const checklistNotes = checklistData.notes || '';

    await this.supabase.from('vehicle_checklists').insert({
      journey_id: id,
      driver_id: journey.driver_id,
      vehicle_id: journey.vehicle_id,
      type: 'end',
      items: checklistItems,
      notes: checklistNotes,
    });

    // --- LÓGICA DE MANUTENÇÃO AUTOMÁTICA ---
    // ... código anterior de criação da jornada ...

    // --- LÓGICA DE MANUTENÇÃO AUTOMÁTICA (INÍCIO) ---
    const hasFailures = Object.values(checklistItems).some(
      (val) => val === false,
    );

    if (hasFailures) {
      // Cria string legível para a descrição
      const failedItemsList = Object.entries(checklistItems)
        .filter(([, status]) => status === false)
        .map(([item]) => item)
        .join(', ');

      const description = `Manutenção Automática (Checklist Inicial). Itens Reprovados: ${failedItemsList}. Obs: ${checklistNotes}`;

      // ATUALIZAÇÃO CRÍTICA: Mapeando para a estrutura do banco (bd.txt)
      await this.supabase.from('maintenances').insert({
        vehicle_id: journey.vehicle_id,
        driver_id: journey.driver_id,
        type: 'Corretiva - Checklist',
        description: description,
        status: 'Pendente',
        priority: 'Alta',
        created_at: new Date().toISOString(),
        // AQUI ESTÁ A CORREÇÃO: Salvando o JSON na coluna correta
        checklist_data: checklistData, // Passa o objeto completo { items: {...}, notes: ... } ou apenas checklistItems se preferir só os itens
      });
    }

    // 3. Evento de fim
    await this.supabase.from('journey_events').insert({
      journey_id: id,
      type: 'end_journey',
      location: endData.endLocation,
    });

    return journey;
  }
}
