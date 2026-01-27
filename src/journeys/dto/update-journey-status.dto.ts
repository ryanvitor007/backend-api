import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { IsBoolean, IsIn, IsNotEmpty, IsString } from 'class-validator';

export class AuthorizeJourneyDto {
  @IsIn(['active'])
  status: 'active';

  @IsString()
  @IsNotEmpty()
  adminNotes: string;

  @IsBoolean()
  authorizedWithRisk: boolean;
}

export class BlockJourneyDto {
  @IsIn(['cancelled'])
  status: 'cancelled';

  @IsString()
  @IsNotEmpty()
  blockReason: string;

  @IsBoolean()
  createMaintenance: boolean;
}
