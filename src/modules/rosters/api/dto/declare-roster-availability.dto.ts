import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
} from '../../model/rosters.constants';
import { RosterAvailabilityStatus } from '../../model/rosters.enums';

/**
 * Request body for a member's own going / not-going declaration. The membership
 * is resolved from the authenticated token, never from this body.
 */
export class DeclareRosterAvailabilityDto {
  @ApiProperty({ enum: RosterAvailabilityStatus })
  @IsEnum(RosterAvailabilityStatus)
  declare readonly availability: RosterAvailabilityStatus;

  @ApiPropertyOptional({
    minLength: REASON_MIN_LENGTH,
    maxLength: REASON_MAX_LENGTH,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  readonly reason?: string | null;
}
