/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateReportDto } from './dto/create-report.dto';
import { v4 as uuidv4 } from 'uuid';

// CORREÇÃO: Adicionado 'export' para que o Controller possa usar esses tipos
export interface IncidenteDB {
  id: number;
  custo_estimado: number | string;
  data_ocorrencia: string;
  veiculo_placa: string;
}

export interface ManutencaoDB {
  id: number;
  cost: number | string;
  scheduled_date: string;
  vehicle_plate: string;
}

export interface MultaDB {
  id: number;
  amount: number | string;
  data_infracao: string;
}

@Injectable()
export class ReportsService implements OnModuleInit {
  private supabase: SupabaseClient;
  private readonly bucketName = 'reports-archive';

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? '',
    );
  }

  // --- 1. SALVAR RELATÓRIO (Arquivo + Metadados) ---
  async saveReport(
    createReportDto: CreateReportDto,
    file: Express.Multer.File,
  ) {
    // A. Upload do PDF
    const fileExt = file.originalname.split('.').pop();
    const fileName = `report-${Date.now()}-${uuidv4()}.${fileExt}`;
    const filePath = `pdfs/${fileName}`;

    const { error: uploadError } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filePath, file.buffer, { contentType: file.mimetype });

    if (uploadError)
      throw new Error(`Erro upload Storage: ${uploadError.message}`);

    const { data: publicUrlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    // B. Salvar no Banco
    const { data, error } = await this.supabase
      .from('reports')
      .insert({
        titulo: createReportDto.title,
        periodo_inicio: createReportDto.startDate,
        periodo_fim: createReportDto.endDate,
        veiculos_ids: createReportDto.vehicleIds
          ? createReportDto.vehicleIds.split(',')
          : [],
        url_arquivo: publicUrlData.publicUrl,
        criado_por: createReportDto.createdBy,
        tipo: createReportDto.type,
      })
      .select()
      .single();

    if (error) throw new Error(`Erro ao salvar no Banco: ${error.message}`);
    return data;
  }

  // --- 2. LISTAR RELATÓRIOS ---
  async findAll() {
    const { data, error } = await this.supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  // --- 3. AGREGADOR DE DADOS PARA O FRONTEND ---
  async getReportData(
    startDate: string,
    endDate: string,
    vehiclePlate?: string,
  ) {
    // Consultas paralelas para performance
    const incidentsQuery = this.supabase
      .from('incidents')
      .select('*')
      .gte('data_ocorrencia', startDate)
      .lte('data_ocorrencia', endDate);

    const finesQuery = this.supabase
      .from('fines')
      .select('*')
      .gte('data_infracao', startDate)
      .lte('data_infracao', endDate);

    const maintenanceQuery = this.supabase
      .from('maintenances')
      .select('*')
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate);

    // Se tiver filtro de placa, aplica em todas
    if (vehiclePlate && vehiclePlate !== 'all') {
      incidentsQuery.eq('veiculo_placa', vehiclePlate);
      // finesQuery.eq('veiculo_placa', vehiclePlate);
      // maintenanceQuery.eq('vehicle_plate', vehiclePlate);
    }

    const [incidentsRes, finesRes, maintenancesRes] = await Promise.all([
      incidentsQuery,
      finesQuery,
      maintenanceQuery,
    ]);

    // Cast seguro para arrays tipados ou vazios
    const incidents = (incidentsRes.data as IncidenteDB[]) || [];
    const fines = (finesRes.data as MultaDB[]) || [];
    const maintenances = (maintenancesRes.data as ManutencaoDB[]) || [];

    // Lógica simples de "Inteligência" para o resumo executivo
    const totalCost =
      incidents.reduce((acc, i) => acc + (Number(i.custo_estimado) || 0), 0) +
      maintenances.reduce((acc, m) => acc + (Number(m.cost) || 0), 0);

    const incidentsCount = incidents.length;
    const maintenancesCount = maintenances.length;

    const analysisText = `No período de ${startDate} a ${endDate}, a frota registrou ${incidentsCount} sinistros e ${maintenancesCount} manutenções. O custo operacional total extra foi de R$ ${totalCost.toFixed(2)}. ${incidentsCount > 0 ? 'Atenção necessária para sinistros recorrentes.' : 'Operação dentro da normalidade.'}`;

    return {
      incidents: incidents,
      fines: fines,
      maintenances: maintenances,
      summary: {
        totalIncidents: incidentsCount,
        totalMaintenances: maintenancesCount,
        totalCost,
        analysisText,
      },
    };
  }
}
