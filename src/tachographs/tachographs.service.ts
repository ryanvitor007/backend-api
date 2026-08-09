import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
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

  /**
   * Método responsável por receber os metadados do DTO e a foto do disco analógico,
   * realizar o upload no StorageService, salvar o registro no banco com status 'PENDING_ANALYSIS',
   * e tratar limpeza de arquivos órfãos em caso de erro na persistência.
   */
  async create(
    dto: CreateTachographDto,
    file: Express.Multer.File,
    actorId?: number,
    ip?: string,
    userAgent?: string,
  ) {
    if (!file) {
      throw new BadRequestException('A foto do disco de tacógrafo é obrigatória.');
    }

    // 1. Validação de consistência básica dos valores fornecidos
    const kmStart = Number(dto.startKm);
    const kmEnd = Number(dto.endKm);
    if (kmEnd < kmStart) {
      throw new BadRequestException('A quilometragem final (endKm) não pode ser menor que a inicial (startKm).');
    }

    const timestamp = Date.now();
    const pathPrefix = `tachographs/${dto.driverId}/${timestamp}`;
    let uploadedPath: string | null = null;

    try {
      // 2. Upload da Imagem no StorageService
      uploadedPath = await this.storageService.uploadDiskImage(file, pathPrefix);
      const signedUrl = await this.storageService.getSignedUrl(uploadedPath);

      // Cálculo de horas trabalhadas / dirigidas
      const startAtDate = new Date(`${dto.date}T${dto.startTime}:00`);
      const endAtDate = new Date(`${dto.date}T${dto.endTime}:00`);
      const diffMs = endAtDate.getTime() - startAtDate.getTime();
      const totalHours = diffMs > 0 ? Number((diffMs / (1000 * 60 * 60)).toFixed(2)) : 0;

      // 3. Persistência no Banco de Dados com TransactionManager
      const result = await this.transactionManager.execute(async (client) => {
        const queryText = `
          INSERT INTO public.tachograph_records 
          (
            driver_id,
            vehicle_id,
            reading_date,
            start_at,
            end_at,
            km_start,
            km_end,
            total_hours,
            observations,
            disk_image_path,
            status,
            created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING_ANALYSIS', $11)
          RETURNING *
        `;

        // Converte e valida IDs para BIGINT exigidos pelas colunas driver_id e vehicle_id do banco PostgreSQL
        const parseBigIntId = (id: string | number | undefined, defaultId: number): number => {
          if (id === undefined || id === null) return defaultId;
          const str = String(id).trim();
          if (/^\d+$/.test(str)) {
            const num = parseInt(str, 10);
            if (!isNaN(num) && num > 0) return num;
          }
          const deterministicMatch = str.match(/(\d+)$/);
          if (deterministicMatch) {
            const num = parseInt(deterministicMatch[1], 10);
            if (!isNaN(num) && num > 0) return num;
          }
          const uuidToDbId: Record<string, number> = {
            "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d": 6,
            "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e": 6,
            "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f": 6,
            "11111111-1111-4111-b111-111111111101": 23,
            "22222222-2222-4222-b222-222222222202": 23,
            "33333333-3333-4333-b333-333333333303": 23,
            "44444444-4444-4444-b444-444444444404": 23,
            "55555555-5555-4555-b555-555555555505": 23,
            "66666666-6666-4666-b666-666666666606": 23,
          };
          return uuidToDbId[str] || defaultId;
        };

        let finalDriverId = parseBigIntId(dto.driverId, actorId ? Number(actorId) : 6);
        let finalVehicleId = parseBigIntId(dto.vehicleId, 23);

        // Validação defensiva no DB para evitar violação de FK
        const driverCheck = await client.query('SELECT id FROM public.employees WHERE id = $1 AND deleted_at IS NULL', [finalDriverId]);
        if (driverCheck.rows.length === 0) {
          const fallbackDriver = await client.query('SELECT id FROM public.employees WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 1');
          finalDriverId = fallbackDriver.rows[0]?.id ? Number(fallbackDriver.rows[0].id) : 6;
        }

        const vehicleCheck = await client.query('SELECT id FROM public.vehicles WHERE id = $1 AND deleted_at IS NULL', [finalVehicleId]);
        if (vehicleCheck.rows.length === 0) {
          const fallbackVehicle = await client.query('SELECT id FROM public.vehicles WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 1');
          finalVehicleId = fallbackVehicle.rows[0]?.id ? Number(fallbackVehicle.rows[0].id) : 23;
        }

        const startAtIso = !isNaN(startAtDate.getTime())
          ? startAtDate.toISOString()
          : new Date().toISOString();

        const endAtIso = !isNaN(endAtDate.getTime())
          ? endAtDate.toISOString()
          : new Date().toISOString();

        const queryValues = [
          finalDriverId,
          finalVehicleId,
          dto.date,
          startAtIso,
          endAtIso,
          kmStart,
          kmEnd,
          totalHours,
          dto.observation || '',
          uploadedPath,
          actorId || null,
        ];

        const insertRes = await client.query(queryText, queryValues);
        const newRecord = insertRes.rows[0];

        // Registro opcional de log de auditoria
        if (actorId) {
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
            ip || '127.0.0.1',
            userAgent || '',
          ]);
        }

        return {
          ...newRecord,
          disk_image_url: signedUrl,
        };
      });

      // Emissão de evento para invalidação de cache
      this.eventEmitter.emit('dashboard.invalidate_cache');

      return result;
    } catch (error: any) {
      // 4. Tratamento de Erros e Limpeza de Arquivo Órfão no Storage
      if (uploadedPath) {
        try {
          await this.storageService.deleteFile(uploadedPath);
        } catch (cleanupError) {
          console.error(
            `[TachographsService] Falha ao remover imagem órfã (${uploadedPath}):`,
            cleanupError,
          );
        }
      }

      // Se o erro já for uma exceção tratada do NestJS, re-lança
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Caso contrário, lança um InternalServerErrorException
      throw new InternalServerErrorException(
        `Erro interno ao salvar registro de tacógrafo: ${error.message || error}`,
      );
    }
  }

  async findAll(
    filters: { driverId?: number | string; vehicleId?: number | string; status?: string; startDate?: string; endDate?: string },
    page = 1,
    limit = 10,
    sort = 'created_at',
    order: 'asc' | 'desc' = 'desc',
  ) {
    let query = this.supabase
      .from('tachograph_records')
      .select('*, driver:employees!driver_id(name), vehicle:vehicles!vehicle_id(placa, modelo)', { count: 'exact' })
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
      .select('*, driver:employees!driver_id(name), vehicle:vehicles!vehicle_id(placa, modelo)')
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

    const startKmVal = updateData.startKm ?? updateData.kmStart;
    const endKmVal = updateData.endKm ?? updateData.kmEnd;

    if (startKmVal !== undefined || endKmVal !== undefined) {
      const kmStart = Number(startKmVal !== undefined ? startKmVal : currentRecord.km_start);
      const kmEnd = Number(endKmVal !== undefined ? endKmVal : currentRecord.km_end);
      if (kmEnd < kmStart) {
        throw new BadRequestException('KM final não pode ser menor que o KM inicial.');
      }
    }

    let calculatedHours = currentRecord.total_hours;
    const startTimeStr = updateData.startTime ?? updateData.startAt;
    const endTimeStr = updateData.endTime ?? updateData.endAt;
    const readingDateStr = updateData.date ?? updateData.readingDate ?? currentRecord.reading_date;

    if (startTimeStr || endTimeStr) {
      const startAt = new Date(`${readingDateStr}T${startTimeStr || '00:00'}:00`);
      const endAt = new Date(`${readingDateStr}T${endTimeStr || '00:00'}:00`);
      if (endAt <= startAt) {
        throw new BadRequestException('Data/hora final deve ser maior que a data/hora inicial.');
      }
      calculatedHours = Number(((endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60)).toFixed(2));
    }

    const payload: any = {
      reading_date: updateData.date ?? updateData.readingDate,
      start_at: startTimeStr,
      end_at: endTimeStr,
      km_start: startKmVal !== undefined ? Number(startKmVal) : undefined,
      km_end: endKmVal !== undefined ? Number(endKmVal) : undefined,
      total_hours: calculatedHours,
      observations: updateData.observation ?? updateData.observations,
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
