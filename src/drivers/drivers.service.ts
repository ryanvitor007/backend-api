import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DriversService implements OnModuleInit {
  private supabase: SupabaseClient;

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? '',
    );
  }

  async findAll(
    filters: { name?: string; active?: boolean },
    page = 1,
    limit = 10,
    sort = 'name',
    order: 'asc' | 'desc' = 'asc',
  ) {
    let query = this.supabase
      .from('employees')
      .select('*', { count: 'exact' })
      .eq('role', 'Motorista')
      .is('deleted_at', null);

    if (filters.name) {
      query = query.ilike('name', `%${filters.name}%`);
    }
    if (filters.active !== undefined) {
      query = query.eq('active', filters.active);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
      .order(sort, { ascending: order === 'asc' })
      .range(from, to);

    if (error) throw new Error(error.message);
    return { data: data || [], total: count || 0 };
  }

  async findOne(id: number) {
    const { data, error } = await this.supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .eq('role', 'Motorista')
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new NotFoundException('Motorista não encontrado.');
    }
    return data;
  }

  async findHistory(id: number) {
    const { data: journeys, error } = await this.supabase
      .from('journeys')
      .select('*')
      .eq('driver_id', id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return journeys || [];
  }

  async findProductivity(id: number) {
    const { data: journeys, error } = await this.supabase
      .from('journeys')
      .select('*')
      .eq('driver_id', id);

    if (error) throw new Error(error.message);

    const totalJourneys = journeys?.length || 0;
    
    let totalHours = 0;
    journeys?.forEach((j: any) => {
      if (j.start_time && j.end_time) {
        const diff = new Date(j.end_time).getTime() - new Date(j.start_time).getTime();
        totalHours += diff / (1000 * 60 * 60);
      }
    });

    const { data: checklists } = await this.supabase
      .from('vehicle_checklists')
      .select('*')
      .eq('driver_id', id);

    const totalChecklists = checklists?.length || 0;
    const approvedChecklists = checklists?.filter((c: any) => {
      if (!c.items) return true;
      return !Object.values(c.items).includes(false);
    }).length || 0;

    const complianceRate = totalChecklists > 0 ? (approvedChecklists / totalChecklists) * 100 : 100;

    return {
      totalJourneys,
      totalHours: Number(totalHours.toFixed(1)),
      complianceRate: Number(complianceRate.toFixed(1)),
    };
  }

  async findInspections(id: number) {
    const { data, error } = await this.supabase
      .from('vehicle_checklists')
      .select('*')
      .eq('driver_id', id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }
}
