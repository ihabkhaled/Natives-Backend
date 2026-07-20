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
} from '../../model/squads.constants';
import { AvailabilityStatus } from '../../model/squads.enums';

/**
 * Request body for a member to declare their own availability for a squad's
 * competition/period. The membership is resolved from the authenticated token,
 * never this body.
 */
export class DeclareAvailabilityDto {
  @ApiProperty({ enum: AvailabilityStatus })
  @IsEnum(AvailabilityStatus)
  declare readonly availability: AvailabilityStatus;

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
