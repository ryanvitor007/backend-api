import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class AuthorizeJourneyDto {
  @IsIn(['active'])
  status: 'active';

  @IsString()
  @IsNotEmpty()
  adminNotes: string;
}

export class BlockJourneyDto {
  @IsIn(['cancelled'])
  status: 'cancelled';

  @IsString()
  @IsNotEmpty()
  blockReason: string;
}
