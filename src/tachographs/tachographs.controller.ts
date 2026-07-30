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
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { TachographsService } from './tachographs.service';
import { CreateTachographDto } from './dto/create-tachograph.dto';

@ApiTags('Tacografos')
@ApiBearerAuth()
@Controller('tachographs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TachographsController {
  constructor(private readonly tachographsService: TachographsService) {}

  /**
   * Endpoint de submissão de discos de tacógrafo analógico.
   * Recebe os metadados via DTO e o arquivo de imagem via multipart/form-data.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('Admin', 'Motorista')
  @Permissions('tachographs:create')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary: 'Submeter disco de tacografo para auditoria',
    description:
      'Recebe os metadados do disco de tacografo analogico e a imagem do disco via multipart/form-data. Retorna HTTP 202 Accepted enquanto a auditoria e validacao por IA permanecem pendentes.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Metadados e arquivo de imagem do disco de tacografo',
    schema: {
      type: 'object',
      required: [
        'image',
        'driverId',
        'vehicleId',
        'date',
        'startTime',
        'endTime',
        'startKm',
        'endKm',
      ],
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Foto do disco analogico (JPG, JPEG ou PNG, max. 10MB)',
        },
        driverId: {
          type: 'string',
          format: 'uuid',
          example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        },
        vehicleId: {
          type: 'string',
          format: 'uuid',
          example: 'b1fbc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        },
        date: {
          type: 'string',
          format: 'date',
          example: '2026-07-22',
        },
        startTime: {
          type: 'string',
          example: '08:00',
        },
        endTime: {
          type: 'string',
          example: '18:00',
        },
        startKm: {
          type: 'number',
          example: 120000,
        },
        endKm: {
          type: 'number',
          example: 120450,
        },
        observation: {
          type: 'string',
          example: 'Substituicao preventiva do disco.',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description:
      'Submissao aceita com sucesso. Registro de tacografo criado com status pendente de processamento.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Falha de validacao nos metadados ou arquivo com formato/tamanho invalido.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token de autenticacao ausente ou invalido.',
  })
  async create(
    @Body() dto: CreateTachographDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 10 * 1024 * 1024,
            message: 'O tamanho maximo da imagem deve ser de 10MB.',
          }),
          new FileTypeValidator({
            fileType: 'image/(png|jpeg|jpg)',
            skipMagicNumbersValidation: true,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req: any,
  ) {
    const actorId = req.user?.userId;
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';

    return this.tachographsService.create(dto, file, actorId, ip, userAgent);
  }

  @Get()
  @Roles('Admin', 'Operador', 'Motorista')
  @Permissions('tachographs:read', 'tachographs:read-own')
  @ApiOperation({ summary: 'Listar registros de tacografo' })
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
  @ApiOperation({ summary: 'Exportar dados de tacografos (CSV ou XLSX)' })
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
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
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
  @ApiOperation({ summary: 'Obter detalhes de um registro de tacografo por ID' })
  findOne(@Param('id') id: string) {
    return this.tachographsService.findOne(id);
  }

  @Patch(':id')
  @Roles('Admin', 'Operador')
  @Permissions('tachographs:update')
  @ApiOperation({ summary: 'Atualizar um registro de tacografo' })
  update(
    @Param('id') id: string,
    @Body() updateData: any,
    @Req() req: any,
  ) {
    const actorId = req.user.userId;
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';

    return this.tachographsService.update(id, updateData, actorId, ip, userAgent);
  }

  @Delete(':id')
  @Roles('Admin')
  @Permissions('tachographs:delete')
  @ApiOperation({ summary: 'Remover (soft delete) um registro de tacografo' })
  remove(@Param('id') id: string, @Req() req: any) {
    const actorId = req.user.userId;
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';

    return this.tachographsService.remove(id, actorId, ip, userAgent);
  }
}
