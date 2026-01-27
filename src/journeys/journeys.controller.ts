import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { JourneysService } from './journeys.service';
import { CreateJourneyDto } from './dto/create-journey.dto';
import { CreateJourneyEventDto } from './dto/journey-event.dto';
import {
  AuthorizeJourneyDto,
  BlockJourneyDto,
} from './dto/update-journey-status.dto';

@Controller('journeys')
export class JourneysController {
  constructor(private readonly journeysService: JourneysService) {}

  @Post()
  create(@Body() createJourneyDto: CreateJourneyDto) {
    return this.journeysService.create(createJourneyDto);
  }

  @Get('active/:driverId')
  findActive(@Param('driverId') driverId: string) {
    return this.journeysService.findActive(+driverId);
  }

  @Get('monitoring')
  findMonitoring() {
    return this.journeysService.findAllActive();
  }

  @Get('history')
  findHistory(@Query('date') date: string) {
    return this.journeysService.findByDate(date);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.journeysService.getStatus(+id);
  }

  @Post('events')
  registerEvent(@Body() eventDto: CreateJourneyEventDto) {
    return this.journeysService.registerEvent(eventDto);
  }

  @Patch(':id/authorize')
  authorize(
    @Param('id') id: string,
    @Body() body: AuthorizeJourneyDto,
  ) {
    return this.journeysService.authorize(+id, body);
  }

  @Patch(':id/block')
  block(@Param('id') id: string, @Body() body: BlockJourneyDto) {
    return this.journeysService.block(+id, body);
  }

  @Patch(':id/finish')
  finish(
    @Param('id') id: string,
    @Body() body: { endLocation: string; endOdometer: number; checklist: any },
  ) {
    return this.journeysService.finish(+id, body);
  }
}
