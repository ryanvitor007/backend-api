import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class AuditLogEvent {
  constructor(
    public readonly userId: number | null,
    public readonly entity: string,
    public readonly entityId: string | null,
    public readonly action: string,
    public readonly oldData: any | null,
    public readonly newData: any | null,
    public readonly ip: string | null,
    public readonly userAgent: string | null,
  ) {}
}

@Injectable()
export class AuditService implements OnModuleInit {
  private supabase: SupabaseClient;

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? '',
    );
  }

  @OnEvent('audit.log')
  async handleAuditLogEvent(event: AuditLogEvent) {
    try {
      const { error } = await this.supabase
        .from('audit_logs')
        .insert({
          user_id: event.userId,
          entity: event.entity,
          entity_id: event.entityId,
          action: event.action,
          old_data: event.oldData,
          new_data: event.newData,
          ip: event.ip,
          user_agent: event.userAgent,
        });

      if (error) {
        console.error('Failed to save audit log:', error.message);
      }
    } catch (err) {
      console.error('Unexpected error in audit listener:', err);
    }
  }

  async getLogs(page = 1, limit = 20, filters?: any) {
    let query = this.supabase
      .from('audit_logs')
      .select('*', { count: 'exact' });

    if (filters?.userId) query = query.eq('user_id', filters.userId);
    if (filters?.entity) query = query.eq('entity', filters.entity);
    if (filters?.action) query = query.eq('action', filters.action);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);
    return { data, total: count || 0 };
  }
}
