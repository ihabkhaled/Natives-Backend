import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  RECORD_VERSION_MIN,
} from '../../model/competitions.constants';

/**
 * Request body for rescheduling a fixture to a new UTC instant before play begins,
 * optionally to a new venue and with a reason, under an optimistic version guard.
 */
export class RescheduleFixtureDto {
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  declare readonly scheduledAt: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly venueId?: string | null;

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

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}
