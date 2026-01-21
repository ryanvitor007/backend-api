import { Injectable, Inject } from '@nestjs/common';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { SupabaseClient } from '@supabase/supabase-js';

export interface Vehicle {
  id: number;
  placa: string;
  modelo: string;
  ano: number;
  km_atual: number;
  renavam: string;
  status: string;
  data_cadastro: Date;
  cor: string;
  combustivel: string;
  chassi: string;
}

// Interfaces para tipagem segura do retorno do Supabase (Evita erros de Lint)
interface SupabaseError {
  message: string;
  code: string;
  details: string;
  hint: string;
}

interface SupabaseResponse<T> {
  data: T | null;
  error: SupabaseError | null;
}

@Injectable()
export class VehiclesService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  async remove(id: number): Promise<void> {
    console.log(`Iniciando exclusão do veículo ID: ${id}`);

    const response = (await this.supabase
      .from('vehicles')
      .delete()
      .eq('id', id)) as unknown as SupabaseResponse<null>;

    const { error } = response;

    if (error) {
      console.error('Erro ao excluir veículo:', error);
      if (error.code === '23503') {
        throw new Error(
          'Não é possível excluir: Existem registros vinculados (multas, manutenções, etc).',
        );
      }
      throw new Error(error.message);
    }

    console.log('Veículo excluído com sucesso.');
  }

  async create(createVehicleDto: CreateVehicleDto): Promise<Vehicle> {
    console.log('Salvando no Supabase:', createVehicleDto);

    // Casting para any no payload para evitar erro de tipagem na entrada, se houver discrepância
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
      placa: createVehicleDto.placa,
      modelo: createVehicleDto.modelo,
      ano: createVehicleDto.ano,
      km_atual: createVehicleDto.km_atual,
      renavam: createVehicleDto.renavam,
      status: createVehicleDto.status,
      cor: createVehicleDto.cor,
      combustivel: createVehicleDto.combustivel,
      chassi: createVehicleDto.chassi,
    };

    const response = (await this.supabase
      .from('vehicles')
      .insert(payload)
      .select()
      .single()) as unknown as SupabaseResponse<Vehicle>;

    const { data, error } = response;

    if (error) {
      console.error('Erro ao salvar:', error);
      throw new Error('Erro ao salvar veículo no banco de dados');
    }

    if (!data) {
      throw new Error('Erro: Dados do veículo não retornados após salvar.');
    }

    return data;
  }

  async findAll(): Promise<Vehicle[]> {
    // CORREÇÃO DO ERRO: Casting explícito para SupabaseResponse<Vehicle[]>
    const response = (await this.supabase
      .from('vehicles')
      .select('*')
      .order('id', { ascending: true })) as unknown as SupabaseResponse<
      Vehicle[]
    >;

    const { data, error } = response;

    if (error) {
      console.error('Erro ao buscar veículos:', error);
      throw new Error(error.message);
    }

    return data || [];
  }
}
