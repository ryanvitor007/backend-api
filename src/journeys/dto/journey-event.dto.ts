export class CreateJourneyEventDto {
  journeyId: number;
  type:
    | 'start_rest'
    | 'end_rest'
    | 'start_meal'
    | 'end_meal'
    | 'stop_wait'
    | 'start_wait';
  location?: string;
  timestamp?: string; // Opcional, se não enviar usa o NOW() do server
}
