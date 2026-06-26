import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateTachographDto } from './dto/create-tachograph.dto';
import { StorageService } from '../storage/storage.service';
import { TransactionManager } from '../common/utils/transaction.manager';

@Injectable()
export class TachographsService implements OnModuleInit {
  private supabase: SupabaseClient;

  constructor(
    private readonly storageService: StorageService,
    private readonly transactionManager: TransactionManager,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? '',
    );
  }

  async create(
    dto: CreateTachographDto,
    file: Express.Multer.File,
    actorId: number,
    ip: string,
    userAgent: string,
  ) {
    const kmStart = Number(dto.kmStart);
    const kmEnd = Number(dto.kmEnd);
    if (kmEnd < kmStart) {
      throw new BadRequestException('KM final não pode ser menor que o KM inicial.');
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (endAt <= startAt) {
      throw new BadRequestException('Data/hora final deve ser maior que a data/hora inicial.');
    }

    const diffMs = endAt.getTime() - startAt.getTime();
    const totalHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));

    const { data: driver } = await this.supabase
      .from('employees')
      .select('name, active')
      .eq('id', +dto.driverId)
      .is('deleted_at', null)
      .single();

    if (!driver) {
      throw new NotFoundException('Motorista não encontrado.');
    }
    if (driver.active === false) {
      throw new BadRequestException('Motorista está inativo.');
    }

    const { data: vehicle } = await this.supabase
      .from('vehicles')
      .select('placa, status')
      .eq('id', +dto.vehicleId)
      .is('deleted_at', null)
      .single();

    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }
    if (vehicle.status !== 'ACTIVE') {
      throw new BadRequestException('Veículo está inativo ou em manutenção.');
    }

    const pathPrefix = `driver-${dto.driverId}-vehicle-${dto.vehicleId}`;
    const diskImagePath = await this.storageService.uploadDiskImage(file, pathPrefix);

    const result = await this.transactionManager.execute(async (client) => {
      const queryText = `
        INSERT INTO public.tachograph_records 
        (driver_id, vehicle_id, reading_date, start_at, end_at, km_start, km_end, total_hours, observations, disk_image_path, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', $11)
        RETURNING *
      `;
      const queryValues = [
        +dto.driverId,
        +dto.vehicleId,
        dto.readingDate,
        dto.startAt,
        dto.endAt,
        kmStart,
        kmEnd,
        totalHours,
        dto.observations || '',
        diskImagePath,
        actorId,
      ];
      
      const insertRes = await client.query(queryText, queryValues);
      const newRecord = insertRes.rows[0];

      const auditQuery = `
        INSERT INTO public.audit_logs 
        (user_id, entity, entity_id, action, new_data, ip, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await client.query(auditQuery, [
        actorId,
        'tachograph_records',
        newRecord.id,
        'CREATE',
        JSON.stringify(newRecord),
        ip,
        userAgent,
      ]);

      return newRecord;
    });

    this.eventEmitter.emit('dashboard.invalidate_cache');
    
    return result;
  }

  async findAll(
    filters: { driverId?: number; vehicleId?: number; status?: string; startDate?: string; endDate?: string },
    page = 1,
    limit = 10,
    sort = 'created_at',
    order: 'asc' | 'desc' = 'desc',
  ) {
    let query = this.supabase
      .from('tachograph_records')
      .select('*, driver:employees(name), vehicle:vehicles(placa, modelo)', { count: 'exact' })
      .is('deleted_at', null);

    if (filters.driverId) query = query.eq('driver_id', filters.driverId);
    if (filters.vehicleId) query = query.eq('vehicle_id', filters.vehicleId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.startDate) query = query.gte('reading_date', filters.startDate);
    if (filters.endDate) query = query.lte('reading_date', filters.endDate);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
      .order(sort, { ascending: order === 'asc' })
      .range(from, to);

    if (error) throw new Error(error.message);

    const recordsWithUrls = await Promise.all((data || []).map(async (record: any) => {
      const url = await this.storageService.getSignedUrl(record.disk_image_path);
      return {
        ...record,
        disk_image_url: url,
      };
    }));

    return { data: recordsWithUrls, total: count || 0 };
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .from('tachograph_records')
      .select('*, driver:employees(name), vehicle:vehicles(placa, modelo)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new NotFoundException('Registro de tacógrafo não encontrado.');
    }

    const url = await this.storageService.getSignedUrl(data.disk_image_path);
    return {
      ...data,
      disk_image_url: url,
    };
  }

  async update(
    id: string,
    updateData: any,
    actorId: number,
    ip: string,
    userAgent: string,
  ) {
    const currentRecord = await this.findOne(id);

    if (updateData.kmStart !== undefined || updateData.kmEnd !== undefined) {
      const kmStart = Number(updateData.kmStart !== undefined ? updateData.kmStart : currentRecord.km_start);
      const kmEnd = Number(updateData.kmEnd !== undefined ? updateData.kmEnd : currentRecord.km_end);
      if (kmEnd < kmStart) {
        throw new BadRequestException('KM final não pode ser menor que o KM inicial.');
      }
    }

    let calculatedHours = currentRecord.total_hours;
    if (updateData.startAt || updateData.endAt) {
      const startAt = new Date(updateData.startAt || currentRecord.start_at);
      const endAt = new Date(updateData.endAt || currentRecord.end_at);
      if (endAt <= startAt) {
        throw new BadRequestException('Data/hora final deve ser maior que a data/hora inicial.');
      }
      calculatedHours = Number(((endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60)).toFixed(2));
    }

    const payload: any = {
      reading_date: updateData.readingDate,
      start_at: updateData.startAt,
      end_at: updateData.endAt,
      km_start: updateData.kmStart ? Number(updateData.kmStart) : undefined,
      km_end: updateData.kmEnd ? Number(updateData.kmEnd) : undefined,
      total_hours: calculatedHours,
      observations: updateData.observations,
      status: updateData.status,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    };

    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    const result = await this.transactionManager.execute(async (client) => {
      const { data, error } = await this.supabase
        .from('tachograph_records')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        throw new NotFoundException('Erro ao atualizar registro.');
      }

      const auditQuery = `
        INSERT INTO public.audit_logs 
        (user_id, entity, entity_id, action, old_data, new_data, ip, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      await client.query(auditQuery, [
        actorId,
        'tachograph_records',
        id,
        'UPDATE',
        JSON.stringify(currentRecord),
        JSON.stringify(data),
        ip,
        userAgent,
      ]);

      return data;
    });

    this.eventEmitter.emit('dashboard.invalidate_cache');
    return result;
  }

  async remove(id: string, actorId: number, ip: string, userAgent: string) {
    const currentRecord = await this.findOne(id);

    await this.transactionManager.execute(async (client) => {
      const { error } = await this.supabase
        .from('tachograph_records')
        .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
        .eq('id', id);

      if (error) throw new Error(error.message);

      const auditQuery = `
        INSERT INTO public.audit_logs 
        (user_id, entity, entity_id, action, old_data, ip, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await client.query(auditQuery, [
        actorId,
        'tachograph_records',
        id,
        'DELETE',
        JSON.stringify(currentRecord),
        ip,
        userAgent,
      ]);
    });

    this.eventEmitter.emit('dashboard.invalidate_cache');
    return { success: true };
  }

  async exportData(format: 'csv' | 'xlsx', filters: any) {
    const { data } = await this.findAll(filters, 1, 10000);

    if (format === 'csv') {
      let csv = 'ID,Motorista,Veiculo,Placa,Data Leitura,KM Inicial,KM Final,KM Rodado,Horas Dirigidas,Status,Observacoes\n';
      data.forEach((r: any) => {
        csv += `"${r.id}","${r.driver?.name || ''}","${r.vehicle?.modelo || ''}","${r.vehicle?.placa || ''}","${r.reading_date}","${r.km_start}","${r.km_end}","${Number(r.km_end) - Number(r.km_start)}","${r.total_hours}","${r.status}","${r.observations || ''}"\n`;
      });
      return { data: csv, mime: 'text/csv', filename: 'export-tacografos.csv' };
    } else {
      let html = '<table border="1"><thead><tr><th>ID</th><th>Motorista</th><th>Veículo</th><th>Placa</th><th>Data Leitura</th><th>KM Inicial</th><th>KM Final</th><th>KM Rodado</th><th>Horas Dirigidas</th><th>Status</th><th>Observações</th></tr></thead><tbody>';
      data.forEach((r: any) => {
        html += `<tr><td>${r.id}</td><td>${r.driver?.name || ''}</td><td>${r.vehicle?.modelo || ''}</td><td>${r.vehicle?.placa || ''}</td><td>${r.reading_date}</td><td>${r.km_start}</td><td>${r.km_end}</td><td>${Number(r.km_end) - Number(r.km_start)}</td><td>${r.total_hours}</td><td>${r.status}</td><td>${r.observations || ''}</td></tr>`;
      });
      html += '</tbody></table>';
      return { data: html, mime: 'application/vnd.ms-excel', filename: 'export-tacografos.xls' };
    }
  }
}
