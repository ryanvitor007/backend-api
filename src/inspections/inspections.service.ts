import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class InspectionsService implements OnModuleInit {
  private supabase: SupabaseClient;

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? '',
    );
  }

  async findAll(
    filters: { status?: string; vehicleId?: number; type?: string },
    page = 1,
    limit = 10,
    sort = 'created_at',
    order: 'asc' | 'desc' = 'desc',
  ) {
    let query = this.supabase
      .from('vehicle_checklists')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.vehicleId) query = query.eq('vehicle_id', filters.vehicleId);
    if (filters.type) query = query.eq('type', filters.type);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
      .order(sort, { ascending: order === 'asc' })
      .range(from, to);

    if (error) throw new Error(error.message);
    return { data: data || [], total: count || 0 };
  }

  async findPending() {
    const { data, error } = await this.supabase
      .from('vehicle_checklists')
      .select('*')
      .is('deleted_at', null);

    if (error) throw new Error(error.message);

    return (data || []).filter((inspection: any) => {
      if (inspection.status === 'PENDING') return true;
      if (inspection.items) {
        return Object.values(inspection.items).includes(false);
      }
      return false;
    });
  }

  async create(body: {
    driverId: number;
    vehicleId: number;
    type: string;
    items: Record<string, boolean>;
    notes?: string;
  }) {
    const { data: driver } = await this.supabase
      .from('employees')
      .select('active')
      .eq('id', body.driverId)
      .is('deleted_at', null)
      .single();

    if (!driver || driver.active === false) {
      throw new BadRequestException('Motorista inválido ou inativo.');
    }

    const { data: vehicle } = await this.supabase
      .from('vehicles')
      .select('status')
      .eq('id', body.vehicleId)
      .is('deleted_at', null)
      .single();

    if (!vehicle || vehicle.status !== 'ACTIVE') {
      throw new BadRequestException('Veículo inválido ou inativo.');
    }

    const hasFailures = Object.values(body.items).includes(false);
    const status = hasFailures ? 'PENDING' : 'APPROVED';

    const { data, error } = await this.supabase
      .from('vehicle_checklists')
      .insert({
        driver_id: body.driverId,
        vehicle_id: body.vehicleId,
        type: body.type || 'manual',
        items: body.items,
        notes: body.notes || '',
        status,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async update(id: number, body: { status: string; notes?: string }) {
    const { data, error } = await this.supabase
      .from('vehicle_checklists')
      .update({
        status: body.status,
        notes: body.notes,
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Inspeção não encontrada.');
    }
    return data;
  }

  async remove(id: number) {
    const { error } = await this.supabase
      .from('vehicle_checklists')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true };
  }

  async getMetrics() {
    const { data, error } = await this.supabase
      .from('vehicle_checklists')
      .select('*')
      .is('deleted_at', null);

    if (error) throw new Error(error.message);

    const total = data?.length || 0;
    if (total === 0) return { complianceRate: 100, pendingCount: 0 };

    const approved = data?.filter((c: any) => {
      if (c.status === 'PENDING') return false;
      if (c.items) {
        return !Object.values(c.items).includes(false);
      }
      return true;
    }).length || 0;

    const pendingCount = data?.filter((c: any) => {
      if (c.status === 'PENDING') return true;
      if (c.items) {
        return Object.values(c.items).includes(false);
      }
      return false;
    }).length || 0;

    return {
      complianceRate: Number(((approved / total) * 100).toFixed(1)),
      pendingCount,
    };
  }
}
