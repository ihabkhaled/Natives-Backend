import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from '@core/validation';

import {
  EXPECTED_VERSION_MIN,
  FIELD_MAX_LENGTH,
  REASON_MAX_LENGTH,
} from '../../model/practices.constants';

/** Moves a session to new times and/or a new venue, version-guarded. */
export class RescheduleSessionDto {
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  declare readonly startsAt: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  declare readonly endsAt: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  declare readonly meetAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  declare readonly rsvpCutoffAt?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly venueId?: string;

  @ApiPropertyOptional({ maxLength: FIELD_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_MAX_LENGTH)
  declare readonly field?: string;

  @ApiPropertyOptional({ maxLength: REASON_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(REASON_MAX_LENGTH)
  declare readonly reason?: string;

  @ApiProperty({ minimum: EXPECTED_VERSION_MIN })
  @IsInt()
  @Min(EXPECTED_VERSION_MIN)
  declare readonly expectedVersion: number;
}
