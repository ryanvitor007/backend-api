import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
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
  deleted_at?: string;
}

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
    console.log(`Iniciando exclusão lógica do veículo ID: ${id}`);

    const response = (await this.supabase
      .from('vehicles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)) as unknown as SupabaseResponse<null>;

    const { error } = response;

    if (error) {
      console.error('Erro ao excluir logicamente o veículo:', error);
      throw new Error(error.message);
    }

    console.log('Veículo marcado como excluído (Soft Delete).');
  }

  async create(createVehicleDto: CreateVehicleDto): Promise<Vehicle> {
    console.log('Salvando no Supabase:', createVehicleDto);

    const payload: any = {
      placa: createVehicleDto.placa,
      modelo: createVehicleDto.modelo,
      ano: createVehicleDto.ano,
      km_atual: createVehicleDto.km_atual,
      renavam: createVehicleDto.renavam,
      status: createVehicleDto.status || 'ACTIVE',
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

  async update(id: number, updateVehicleDto: any): Promise<Vehicle> {
    console.log(`Atualizando veículo ID: ${id}`, updateVehicleDto);

    const response = (await this.supabase
      .from('vehicles')
      .update(updateVehicleDto)
      .eq('id', id)
      .select()
      .single()) as unknown as SupabaseResponse<Vehicle>;

    const { data, error } = response;

    if (error || !data) {
      console.error('Erro ao atualizar:', error);
      throw new NotFoundException('Veículo não encontrado para atualização.');
    }

    return data;
  }

  async updateStatus(id: number, status: string): Promise<Vehicle> {
    console.log(`Atualizando status do veículo ID: ${id} para ${status}`);

    const response = (await this.supabase
      .from('vehicles')
      .update({ status })
      .eq('id', id)
      .select()
      .single()) as unknown as SupabaseResponse<Vehicle>;

    const { data, error } = response;

    if (error || !data) {
      console.error('Erro ao atualizar status:', error);
      throw new NotFoundException('Veículo não encontrado para atualização de status.');
    }

    return data;
  }

  async findOne(id: number): Promise<Vehicle> {
    const response = (await this.supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()) as unknown as SupabaseResponse<Vehicle>;

    const { data, error } = response;

    if (error || !data) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    return data;
  }

  async findAll(): Promise<Vehicle[]> {
    const response = (await this.supabase
      .from('vehicles')
      .select('*')
      .is('deleted_at', null)
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

  async consultarPlacaInfosimples(placa: string) {
    const placaLimpa = placa.replace(/[-\s]/g, '').toUpperCase();
    const token = process.env.INFOSIMPLES_API_TOKEN;

    Logger.log(`[Infosimples] Consultando placa: ${placaLimpa}`, 'VehiclesService');

    const response = await fetch(
      `https://api.infosimples.com/api/v2/consultas/senatran/veiculo?token=${token}&placa=${placaLimpa}`,
      { method: 'POST' },
    );

    const data = await response.json();

    Logger.log(`[Infosimples] Resposta code=${data.code}: ${data.code_message || ''}`, 'VehiclesService');

    if (data.code !== 200) {
      throw new BadRequestException(
        data.code_message || `Erro na API da Infosimples (code: ${data.code})`,
      );
    }

    if (!data.data || data.data.length === 0) {
      throw new NotFoundException('Veículo não encontrado no DETRAN/SENATRAN.');
    }

    const v = data.data[0];

    return {
      placa: v.placa || placaLimpa,
      renavam: v.renavam,
      chassi: v.chassi,
      marca: v.marca,
      modelo: v.modelo,
      anoFabricacao: v.ano_fabricacao,
      anoModelo: v.ano_modelo,
      cor: v.cor_veiculo || v.cor,
      combustivel: v.combustivel,
    };
  }
}
