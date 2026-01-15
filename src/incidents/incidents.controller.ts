import {
  Controller,
  Get,
  Post,
  Body,
  UseInterceptors,
  UploadedFiles,
  Patch,
  Param,
  UploadedFile, // <--- Faltava importar isso
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express'; // <--- Faltava FileInterceptor aqui
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  // Intercepta múltiplos arquivos (fotos do incidente)
  @UseInterceptors(FilesInterceptor('photos', 5))
  create(
    @Body() createIncidentDto: CreateIncidentDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.incidentsService.create(createIncidentDto, files);
  }

  @Get()
  findAll() {
    return this.incidentsService.findAll();
  }

  // Atualizar apenas o status
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.incidentsService.updateStatus(+id, status);
  }

  // Concluir com Upload de Nota Fiscal (Arquivo único)
  @Patch(':id/conclude')
  @UseInterceptors(FileInterceptor('invoice')) // Agora o FileInterceptor vai funcionar
  concludeIncident(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File, // Agora o UploadedFile vai funcionar
  ) {
    return this.incidentsService.concludeIncident(+id, file);
  }
}
