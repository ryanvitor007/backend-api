import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const JOURNEY_EVENT_TYPES = [
  'start_rest',
  'end_rest',
  'start_meal',
  'end_meal',
  'stop_wait',
  'start_wait',
  'stop',
  'resume',
  'start_journey',
  'meal',
] as const;

type JourneyEventType = (typeof JOURNEY_EVENT_TYPES)[number];

export class CreateJourneyEventDto {
  @IsInt()
  @IsNotEmpty()
  journeyId: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(JOURNEY_EVENT_TYPES)
  type: JourneyEventType;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  timestamp?: string; // Opcional, se não enviar usa o NOW() do server
}
