import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DashboardAggregationService implements OnModuleInit {
  private supabase: SupabaseClient;
  private cache: any = null;
  private lastCachedAt: number = 0;
  private readonly cacheTTL = 5 * 60 * 1000;

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? '',
    );
  }

  @OnEvent('dashboard.invalidate_cache')
  invalidateCache() {
    console.log('Dashboard cache invalidated.');
    this.cache = null;
    this.lastCachedAt = 0;
  }

  async getDashboardData(): Promise<any> {
    const now = Date.now();
    if (this.cache && (now - this.lastCachedAt < this.cacheTTL)) {
      console.log('Returning cached dashboard aggregation data');
      return this.cache;
    }

    console.log('Recomputing dashboard metrics...');
    const result = await this.computeMetrics();
    this.cache = result;
    this.lastCachedAt = now;
    return result;
  }

  private async computeMetrics(): Promise<any> {
    const today = new Date().toISOString().split('T')[0];

    const { data: todayRecords } = await this.supabase
      .from('tachograph_records')
      .select('id')
      .eq('reading_date', today)
      .is('deleted_at', null);

    const registrosHoje = todayRecords?.length || 0;

    const { data: allRecords } = await this.supabase
      .from('tachograph_records')
      .select('total_hours')
      .is('deleted_at', null);

    const horasDirigidas = allRecords?.reduce((sum, r) => sum + Number(r.total_hours || 0), 0) || 0;

    const { data: activeVehicles } = await this.supabase
      .from('vehicles')
      .select('id')
      .eq('status', 'ACTIVE')
      .is('deleted_at', null);

    const veiculosOperacionais = activeVehicles?.length || 0;

    const { data: checklists } = await this.supabase
      .from('vehicle_checklists')
      .select('id, status, items')
      .is('deleted_at', null);

    const inspecoesPendentes = checklists?.filter((c: any) => {
      if (c.status === 'PENDING') return true;
      if (c.items) {
        return Object.values(c.items).includes(false);
      }
      return false;
    }).length || 0;

    const { data: openIncidents } = await this.supabase
      .from('incidents')
      .select('id')
      .eq('status', 'Aberto');

    const { data: activeNotifications } = await this.supabase
      .from('notifications')
      .select('id')
      .eq('read', false);

    const alertasCount = (openIncidents?.length || 0) + (activeNotifications?.length || 0);

    const { data: recordsVehicles } = await this.supabase
      .from('tachograph_records')
      .select('vehicle_id, vehicles(placa)')
      .is('deleted_at', null);

    const recordsPerVehicleMap: Record<string, number> = {};
    recordsVehicles?.forEach((r: any) => {
      const plate = r.vehicles?.placa || 'N/A';
      recordsPerVehicleMap[plate] = (recordsPerVehicleMap[plate] || 0) + 1;
    });

    const recordsPerVehicle = Object.entries(recordsPerVehicleMap).map(([plate, count]) => ({
      plate,
      count,
    }));

    const totalChecklists = checklists?.length || 0;
    const approvedChecklists = checklists?.filter((c: any) => {
      if (c.status === 'PENDING') return false;
      if (c.items) {
        return !Object.values(c.items).includes(false);
      }
      return true;
    }).length || 0;
    const complianceRate = totalChecklists > 0 ? (approvedChecklists / totalChecklists) * 100 : 100;

    return {
      kpis: {
        registrosHoje,
        horasDirigidas: Number(horasDirigidas.toFixed(1)),
        veiculosOperacionais,
        inspecoesPendentes,
        alertas: alertasCount,
      },
      charts: {
        recordsPerVehicle,
        complianceRate: Number(complianceRate.toFixed(1)),
      },
      updatedAt: new Date().toISOString(),
    };
  }
}
