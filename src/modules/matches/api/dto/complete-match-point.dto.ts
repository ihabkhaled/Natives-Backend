import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  NOTES_MAX_LENGTH,
  OPERATION_ID_MAX_LENGTH,
  OPERATION_ID_MIN_LENGTH,
  POINT_DURATION_MAX,
  POINT_DURATION_MIN,
} from '../../model/matches.constants';
import { ScoringSide } from '../../model/matches.enums';

/**
 * Request body to close the open point. `scoringSide` plus the line the point
 * started on is all the hold/break classification needs — it is derived, never
 * stored. `durationSeconds` is optional and stays NULL when it was not measured;
 * an unmeasured point is never recorded as a zero-second one.
 */
export class CompleteMatchPointDto {
  @ApiProperty({
    minLength: OPERATION_ID_MIN_LENGTH,
    maxLength: OPERATION_ID_MAX_LENGTH,
  })
  @IsString()
  @MinLength(OPERATION_ID_MIN_LENGTH)
  @MaxLength(OPERATION_ID_MAX_LENGTH)
  declare readonly operationId: string;

  @ApiProperty({ enum: ScoringSide })
  @IsEnum(ScoringSide)
  declare readonly scoringSide: ScoringSide;

  @ApiPropertyOptional({
    minimum: POINT_DURATION_MIN,
    maximum: POINT_DURATION_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(POINT_DURATION_MIN)
  @Max(POINT_DURATION_MAX)
  readonly durationSeconds?: number | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  readonly occurredAt?: string | null;

  @ApiPropertyOptional({ maxLength: NOTES_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX_LENGTH)
  readonly notes?: string | null;
}
