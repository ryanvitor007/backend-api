import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { JourneysService } from './journeys.service';
import { CreateJourneyDto } from './dto/create-journey.dto';
import { CreateJourneyEventDto } from './dto/journey-event.dto';

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

  @Post('events')
  registerEvent(@Body() eventDto: CreateJourneyEventDto) {
    return this.journeysService.registerEvent(eventDto);
  }

  @Patch(':id/finish')
  finish(
    @Param('id') id: string,
    @Body() body: { endLocation: string; endOdometer: number; checklist: any },
  ) {
    return this.journeysService.finish(+id, body);
  }
}
