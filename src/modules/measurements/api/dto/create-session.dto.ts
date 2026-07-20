import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  SESSION_TEXT_MAX_LENGTH,
  SESSION_TITLE_MAX_LENGTH,
  SESSION_TITLE_MIN_LENGTH,
} from '../../model/measurements.constants';

/** Request body for scheduling a measurement session. */
export class CreateMeasurementSessionDto {
  @ApiProperty({
    minLength: SESSION_TITLE_MIN_LENGTH,
    maxLength: SESSION_TITLE_MAX_LENGTH,
  })
  @IsString()
  @MinLength(SESSION_TITLE_MIN_LENGTH)
  @MaxLength(SESSION_TITLE_MAX_LENGTH)
  declare readonly title: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string | null;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  declare readonly scheduledAt: string;

  @ApiPropertyOptional({ maxLength: SESSION_TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(SESSION_TEXT_MAX_LENGTH)
  readonly location?: string | null;

  @ApiPropertyOptional({ maxLength: SESSION_TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(SESSION_TEXT_MAX_LENGTH)
  readonly conditions?: string | null;

  @ApiPropertyOptional({ maxLength: SESSION_TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(SESSION_TEXT_MAX_LENGTH)
  readonly notes?: string | null;
}
