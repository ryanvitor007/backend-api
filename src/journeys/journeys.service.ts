import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateJourneyDto } from './dto/create-journey.dto';
import { CreateJourneyEventDto } from './dto/journey-event.dto';

// CORREÇÃO: Adicionado 'export' para que o Controller possa usar este tipo implicitamente
export interface JourneyData {
  id: number;
  driver_id: number;
  vehicle_id: number;
  start_time: string;
  status: string;
  start_location?: string;
  start_odometer?: number;
}

// CORREÇÃO: Adicionado 'export' aqui também
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

// Interface genérica para resposta do Supabase
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
  async create(createJourneyDto: CreateJourneyDto) {
    console.log('--- INICIANDO NOVA JORNADA ---');
    console.log('Payload recebido:', JSON.stringify(createJourneyDto, null, 2));

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
      console.error('Erro fatal ao criar jornada:', journeyError);
      throw new Error(journeyError.message);
    }
    if (!journey)
      throw new Error('Erro: Jornada criada mas sem dados retornados.');

    console.log('Jornada criada com ID:', journey.id);

    // 2. Registrar o Checklist Inicial (Com tratamento de erro reforçado)
    try {
      // Garante que checklistData existe, mesmo que venha nulo
      const checklistData = createJourneyDto.checklist || {
        items: {},
        notes: '',
      };

      // Força 'items' a ser um objeto (se vier undefined, vira {})
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const checklistItems = (checklistData.items || {}) as object;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const checklistNotes = checklistData.notes || '';

      const { error: checklistError } = await this.supabase
        .from('vehicle_checklists')
        .insert({
          journey_id: journey.id,
          driver_id: createJourneyDto.driverId,
          vehicle_id: createJourneyDto.vehicleId,
          type: 'start',
          items: checklistItems,
          notes: checklistNotes,
        });

      if (checklistError) {
        console.error(
          'ALERTA: Erro ao salvar checklist no banco:',
          JSON.stringify(checklistError, null, 2),
        );
      } else {
        console.log('Checklist salvo com sucesso!');
      }
    } catch (err) {
      console.error('Erro inesperado ao processar checklist:', err);
    }

    // 3. Registrar evento inicial
    await this.supabase.from('journey_events').insert({
      journey_id: journey.id,
      type: 'start_journey',
      location: createJourneyDto.startLocation,
    });

    return journey;
  }

  // BUSCAR JORNADA ATIVA
  // BUSCAR JORNADA ATIVA
  async findActive(driverId: number) {
    // CORREÇÃO: Removemos o casting duplo desnecessário se o TS já infere,
    // ou mantemos apenas o necessário. Aqui simplificamos para evitar o warning.
    const response = await this.supabase
      .from('journeys')
      .select('*, vehicle:vehicles(*)')
      .eq('driver_id', driverId)
      .eq('status', 'active')
      .maybeSingle();

    // Tratamos response.data como unknown primeiro para depois aplicar nosso tipo
    const typedResponse = response as unknown as SupabaseResponse<JourneyData>;
    const { data, error } = typedResponse;

    if (error) throw new Error(error.message);

    return data;
  }

  // REGISTRAR EVENTO
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
    endData: { endLocation: string; endOdometer: number; checklist: any },
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

    // 2. Salva Checklist Final
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const checklistItems = endData.checklist.items as object;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const checklistNotes = (endData.checklist.notes || '') as string;

    await this.supabase.from('vehicle_checklists').insert({
      journey_id: id,
      driver_id: journey.driver_id,
      vehicle_id: journey.vehicle_id,
      type: 'end',
      items: checklistItems,
      notes: checklistNotes,
    });

    // 3. Evento de fim
    await this.supabase.from('journey_events').insert({
      journey_id: id,
      type: 'end_journey',
      location: endData.endLocation,
    });

    return journey;
  }
}
