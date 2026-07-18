import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  CAPACITY_MAX,
  CAPACITY_MIN,
  FIELD_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  SESSION_TYPE_MAX_LENGTH,
  SESSION_TYPE_MIN_LENGTH,
  TIMEZONE_MAX_LENGTH,
} from '../../model/practices.constants';
import { SessionVisibility } from '../../model/practices.enums';

export class CreateSessionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly seasonId?: string;

  @ApiProperty({
    minLength: SESSION_TYPE_MIN_LENGTH,
    maxLength: SESSION_TYPE_MAX_LENGTH,
  })
  @IsString()
  @MinLength(SESSION_TYPE_MIN_LENGTH)
  @MaxLength(SESSION_TYPE_MAX_LENGTH)
  declare readonly sessionType: string;

  @ApiPropertyOptional({ maxLength: TIMEZONE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(TIMEZONE_MAX_LENGTH)
  declare readonly timezone?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly venueId?: string;

  @ApiPropertyOptional({ maxLength: FIELD_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_MAX_LENGTH)
  declare readonly field?: string;

  @ApiPropertyOptional({ minimum: CAPACITY_MIN, maximum: CAPACITY_MAX })
  @IsOptional()
  @IsInt()
  @Min(CAPACITY_MIN)
  @Max(CAPACITY_MAX)
  declare readonly capacity?: number;

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

  @ApiPropertyOptional({ enum: SessionVisibility })
  @IsOptional()
  @IsEnum(SessionVisibility)
  declare readonly visibility?: SessionVisibility;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly organizerUserId?: string;

  @ApiPropertyOptional({ maxLength: NOTES_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX_LENGTH)
  declare readonly notes?: string;
}
