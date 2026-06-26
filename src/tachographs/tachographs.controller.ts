import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TachographsService } from './tachographs.service';
import { CreateTachographDto } from './dto/create-tachograph.dto';

@Controller('tachographs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TachographsController {
  constructor(private readonly tachographsService: TachographsService) {}

  @Post()
  @Roles('Admin', 'Motorista')
  @Permissions('tachographs:create')
  @UseInterceptors(FileInterceptor('disk_image'))
  create(
    @Body() dto: CreateTachographDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('A imagem do disco de papel é obrigatória.');
    }
    const actorId = req.user.userId;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';

    return this.tachographsService.create(dto, file, actorId, ip, userAgent);
  }

  @Get()
  @Roles('Admin', 'Operador', 'Motorista')
  @Permissions('tachographs:read', 'tachographs:read-own')
  findAll(
    @Query('driverId') driverId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Req() req?: any,
  ) {
    const user = req.user;
    const resolvedDriverId = user.role === 'Motorista' ? user.userId : (driverId ? +driverId : undefined);

    const filters = {
      driverId: resolvedDriverId,
      vehicleId: vehicleId ? +vehicleId : undefined,
      status,
      startDate,
      endDate,
    };

    return this.tachographsService.findAll(
      filters,
      page ? +page : 1,
      limit ? +limit : 10,
      sort,
      order,
    );
  }

  @Get('export')
  @Roles('Admin', 'Operador')
  @Permissions('tachographs:export')
  async export(
    @Res() res: any,
    @Req() req: any,
    @Query('format') format?: 'csv' | 'xlsx',
    @Query('driverId') driverId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters = {
      driverId: driverId ? +driverId : undefined,
      vehicleId: vehicleId ? +vehicleId : undefined,
      status,
      startDate,
      endDate,
    };

    const actorId = req.user.userId;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';

    const exportResult = await this.tachographsService.exportData(format || 'csv', filters);

    this.tachographsService['eventEmitter'].emit('audit.log', {
      userId: actorId,
      entity: 'tachograph_records',
      entityId: null,
      action: 'EXPORT',
      oldData: null,
      newData: { format, filters },
      ip,
      userAgent,
    });

    res.setHeader('Content-Type', exportResult.mime);
    res.setHeader('Content-Disposition', `attachment; filename=${exportResult.filename}`);
    return res.send(exportResult.data);
  }

  @Get(':id')
  @Roles('Admin', 'Operador', 'Motorista')
  @Permissions('tachographs:read', 'tachographs:read-own')
  findOne(@Param('id') id: string) {
    return this.tachographsService.findOne(id);
  }

  @Patch(':id')
  @Roles('Admin', 'Operador')
  @Permissions('tachographs:update')
  update(
    @Param('id') id: string,
    @Body() updateData: any,
    @Req() req: any,
  ) {
    const actorId = req.user.userId;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';

    return this.tachographsService.update(id, updateData, actorId, ip, userAgent);
  }

  @Delete(':id')
  @Roles('Admin')
  @Permissions('tachographs:delete')
  remove(@Param('id') id: string, @Req() req: any) {
    const actorId = req.user.userId;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';

    return this.tachographsService.remove(id, actorId, ip, userAgent);
  }
}
